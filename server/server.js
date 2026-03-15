import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Ensure uploads directory
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = getDb();

// ─── AUTH ──────────────────────────────────────────────
app.post('/api/auth/signup', (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: 'Email already exists' });
        const password_hash = bcrypt.hashSync(password, 10);
        const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, password_hash, role);
        const userId = result.lastInsertRowid;
        if (role === 'student') {
            db.prepare('INSERT INTO students (user_id) VALUES (?)').run(userId);
        } else {
            db.prepare('INSERT INTO companies (user_id, company_name, recruiter_name, recruiter_email) VALUES (?, ?, ?, ?)').run(userId, name, name, email);
        }
        const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
        let profile = null;
        if (role === 'student') profile = db.prepare('SELECT * FROM students WHERE user_id = ?').get(userId);
        else profile = db.prepare('SELECT * FROM companies WHERE user_id = ?').get(userId);
        res.json({ user, profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
        const { password_hash, ...safeUser } = user;
        let profile = null;
        if (user.role === 'student') profile = db.prepare('SELECT * FROM students WHERE user_id = ?').get(user.id);
        else profile = db.prepare('SELECT * FROM companies WHERE user_id = ?').get(user.id);
        res.json({ user: safeUser, profile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── STUDENT ──────────────────────────────────────────
app.get('/api/students/:userId', (req, res) => {
    try {
        const student = db.prepare('SELECT s.*, u.name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?').get(req.params.userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        student.skills = JSON.parse(student.skills || '[]');
        student.projects = JSON.parse(student.projects || '[]');
        student.certifications = JSON.parse(student.certifications || '[]');
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/students/:userId', (req, res) => {
    try {
        const { phone, college, degree, graduation_year, skills, linkedin, github, projects, certifications } = req.body;
        db.prepare(`UPDATE students SET phone=?, college=?, degree=?, graduation_year=?, skills=?, linkedin=?, github=?, projects=?, certifications=? WHERE user_id=?`)
            .run(phone, college, degree, graduation_year, JSON.stringify(skills || []), linkedin, github, JSON.stringify(projects || []), JSON.stringify(certifications || []), req.params.userId);
        if (req.body.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(req.body.name, req.params.userId);
        const student = db.prepare('SELECT s.*, u.name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?').get(req.params.userId);
        student.skills = JSON.parse(student.skills || '[]');
        student.projects = JSON.parse(student.projects || '[]');
        student.certifications = JSON.parse(student.certifications || '[]');
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students/:userId/resume', upload.single('resume'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const filePath = req.file.filename;
        // Simulate AI resume analysis
        const student = db.prepare('SELECT skills FROM students WHERE user_id = ?').get(req.params.userId);
        const skills = JSON.parse(student?.skills || '[]');
        const baseScore = Math.min(95, 50 + skills.length * 5 + Math.floor(Math.random() * 15));
        db.prepare('UPDATE students SET resume_file = ?, resume_score = ? WHERE user_id = ?').run(filePath, baseScore, req.params.userId);
        const analysis = {
            score: baseScore,
            file: filePath,
            sections: {
                formatting: Math.min(100, 70 + Math.floor(Math.random() * 25)),
                skills_coverage: Math.min(100, 60 + skills.length * 6),
                experience: Math.min(100, 55 + Math.floor(Math.random() * 30)),
                education: Math.min(100, 75 + Math.floor(Math.random() * 20)),
                projects: Math.min(100, 65 + Math.floor(Math.random() * 25))
            },
            suggestions: [
                skills.length < 5 ? 'Add more relevant technical skills to your resume' : 'Great skill variety on your resume',
                'Consider adding quantifiable achievements to your experience section',
                'Include keywords from target job descriptions',
                'Add a professional summary at the top of your resume',
                'Ensure consistent formatting and font usage throughout'
            ],
            skill_gaps: ['System Design', 'CI/CD', 'Cloud Architecture'].filter(() => Math.random() > 0.4)
        };
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
        // Return the path so the frontend can store it
        res.json({ file: `/uploads/${req.file.filename}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/:userId/resume-analysis', (req, res) => {
    try {
        const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(req.params.userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const skills = JSON.parse(student.skills || '[]');
        const analysis = {
            score: student.resume_score || 0,
            file: student.resume_file,
            sections: {
                formatting: Math.min(100, 70 + Math.floor(Math.random() * 25)),
                skills_coverage: Math.min(100, 60 + skills.length * 6),
                experience: Math.min(100, 55 + Math.floor(Math.random() * 30)),
                education: Math.min(100, 75 + Math.floor(Math.random() * 20)),
                projects: Math.min(100, 65 + Math.floor(Math.random() * 25))
            },
            suggestions: [
                'Add more relevant technical skills aligned with target roles',
                'Consider adding quantifiable achievements',
                'Include keywords from target job descriptions',
                'Add a professional summary at the top',
                'Ensure consistent formatting throughout'
            ],
            skill_gaps: ['System Design', 'CI/CD', 'Cloud Architecture', 'Testing'].filter(() => Math.random() > 0.4)
        };
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── INTERVIEWS ──────────────────────────────────────
app.get('/api/students/:userId/interviews', (req, res) => {
    try {
        const student = db.prepare('SELECT student_id FROM students WHERE user_id = ?').get(req.params.userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const interviews = db.prepare('SELECT i.*, j.job_title FROM interviews i LEFT JOIN jobs j ON i.job_id = j.job_id WHERE i.candidate_id = ? ORDER BY i.recorded_at DESC').all(student.student_id);
        interviews.forEach(i => {
            i.feedback = JSON.parse(i.feedback || '{}');
            i.questions = JSON.parse(i.questions || '[]');
        });
        res.json(interviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── NLP SCORING ENGINE (V3 — Accuracy-Focused) ─────
const FILLER_WORDS = ['um', 'uh', 'uhh', 'umm', 'hmm', 'like', 'basically', 'actually', 'literally', 'you know', 'i mean', 'sort of', 'kind of', 'well', 'so', 'right'];
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'its', 'his', 'her', 'their', 'about', 'up', 'out', 'then', 'there', 'here']);

// Common English bi-grams for coherence checking
const COMMON_BIGRAMS = new Set([
    'of the', 'in the', 'to the', 'on the', 'for the', 'is a', 'it is', 'that is',
    'i have', 'i am', 'i was', 'i would', 'i think', 'i used', 'i worked', 'i built',
    'we can', 'we use', 'we need', 'you can', 'you need', 'there is', 'there are',
    'this is', 'that the', 'with the', 'from the', 'such as', 'as well', 'in order',
    'based on', 'work with', 'used to', 'able to', 'need to', 'want to', 'have to',
    'going to', 'will be', 'would be', 'could be', 'should be', 'has been', 'have been',
    'it can', 'so that', 'as a', 'at the', 'by the', 'which is', 'when the', 'if the',
    'and the', 'but the', 'or the', 'for example', 'more than', 'how to', 'what is',
    'make sure', 'each other', 'kind of', 'sort of', 'part of', 'one of', 'out of',
    'a lot', 'the same', 'the most', 'the best', 'my experience', 'my project',
    'worked on', 'built a', 'developed a', 'created a', 'learned to', 'helped me',
    'the application', 'the system', 'the data', 'the user', 'the server', 'the code',
]);

// Connector / transition words that indicate structured speech
const CONNECTORS = new Set([
    'because', 'therefore', 'however', 'although', 'moreover', 'furthermore',
    'additionally', 'consequently', 'nevertheless', 'meanwhile', 'similarly',
    'firstly', 'secondly', 'thirdly', 'finally', 'also', 'then', 'next',
    'for example', 'for instance', 'in addition', 'on the other hand',
    'as a result', 'in conclusion', 'to summarize', 'specifically',
    'essentially', 'primarily', 'particularly', 'importantly',
]);

const TECH_KEYWORDS = {
    frontend: ['react', 'dom', 'virtual', 'component', 'state', 'props', 'hook', 'usestate', 'useeffect', 'css', 'html', 'javascript', 'typescript', 'browser', 'render', 'jsx', 'webpack', 'vite', 'responsive', 'layout', 'flexbox', 'grid', 'api', 'fetch', 'animation', 'accessibility', 'performance', 'lazy', 'suspense', 'context', 'redux', 'routing', 'spa', 'ssr', 'seo', 'closure', 'scope', 'prototype', 'async', 'await', 'promise', 'event', 'listener', 'callback', 'graphql', 'rest', 'endpoint', 'specificity', 'selector', 'media query', 'viewport', 'bundle', 'tree shaking', 'code splitting'],
    backend: ['server', 'api', 'database', 'sql', 'nosql', 'mongodb', 'postgres', 'express', 'middleware', 'authentication', 'authorization', 'jwt', 'token', 'session', 'rest', 'endpoint', 'microservice', 'monolithic', 'scalability', 'cache', 'redis', 'queue', 'index', 'query', 'orm', 'schema', 'migration', 'rate limit', 'throttle', 'load balancer', 'docker', 'container', 'deploy', 'ci', 'cd', 'pipeline', 'nginx', 'http', 'https', 'request', 'response', 'status code', 'error handling'],
    datascience: ['machine learning', 'model', 'training', 'testing', 'dataset', 'feature', 'label', 'classification', 'regression', 'clustering', 'supervised', 'unsupervised', 'neural network', 'deep learning', 'gradient', 'descent', 'loss', 'accuracy', 'precision', 'recall', 'f1', 'cross validation', 'overfitting', 'underfitting', 'bias', 'variance', 'regularization', 'dropout', 'batch', 'epoch', 'optimizer', 'learning rate', 'pandas', 'numpy', 'scikit', 'tensorflow', 'pytorch', 'data cleaning', 'missing data', 'imputation', 'normalization', 'encoding'],
    general: ['experience', 'project', 'team', 'challenge', 'problem', 'solution', 'approach', 'learn', 'skill', 'technology', 'improve', 'collaborate', 'communicate', 'deadline', 'priority', 'plan', 'goal', 'result', 'impact', 'feedback', 'growth', 'adapt', 'leadership', 'initiative']
};

function extractKeywords(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function countFillers(text) {
    const lower = text.toLowerCase();
    let count = 0;
    for (const f of FILLER_WORDS) {
        const regex = new RegExp('\\b' + f.replace(/\s/g, '\\s+') + '\\b', 'gi');
        const matches = lower.match(regex);
        if (matches) count += matches.length;
    }
    return count;
}

function vocabularyDiversity(words) {
    if (words.length === 0) return 0;
    const unique = new Set(words);
    return unique.size / words.length;
}

// ─── Gibberish / Incoherence Detection ──────────────
function detectGibberish(text) {
    const lower = text.toLowerCase().replace(/[^a-z\s]/g, '');
    const words = lower.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) return { isGibberish: true, score: 0.95 };

    let gibberishScore = 0;

    // 1. Repetition ratio — same word repeated excessively
    const wordFreq = {};
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const maxRepeat = Math.max(...Object.values(wordFreq));
    const repeatRatio = maxRepeat / words.length;
    if (repeatRatio > 0.4) gibberishScore += 0.35;
    else if (repeatRatio > 0.25) gibberishScore += 0.15;

    // 2. Vocabulary diversity — too low = repeating, too high with short answer = random words
    const diversity = vocabularyDiversity(words);
    if (diversity < 0.3 && words.length > 5) gibberishScore += 0.25; // heavy repetition
    if (diversity > 0.95 && words.length > 8 && words.length < 25) gibberishScore += 0.15; // every word unique + short = random

    // 3. Bi-gram coherence — do consecutive word pairs make sense?
    let coherentBigrams = 0;
    let totalBigrams = 0;
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = words[i] + ' ' + words[i + 1];
        totalBigrams++;
        if (COMMON_BIGRAMS.has(bigram)) coherentBigrams++;
    }
    const bigramRatio = totalBigrams > 0 ? coherentBigrams / totalBigrams : 0;
    // Natural speech typically has 10-30% common bigrams; random text has ~0%
    if (bigramRatio < 0.03 && words.length > 10) gibberishScore += 0.3;
    else if (bigramRatio < 0.08 && words.length > 10) gibberishScore += 0.15;

    // 4. Connector presence — real answers use transitions/connectors
    const hasConnectors = [...CONNECTORS].some(c => lower.includes(c));
    if (!hasConnectors && words.length > 15) gibberishScore += 0.1;

    // 5. Average word length distribution — gibberish often has unusual word lengths
    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    if (avgLen < 2.5 || avgLen > 9) gibberishScore += 0.15;

    // 6. Check for 3+ consecutive same words
    for (let i = 0; i < words.length - 2; i++) {
        if (words[i] === words[i + 1] && words[i + 1] === words[i + 2]) {
            gibberishScore += 0.3;
            break;
        }
    }

    return { isGibberish: gibberishScore >= 0.5, score: Math.min(1, gibberishScore) };
}

// ─── Sentence Structure Analysis ────────────────────
function analyzeSentenceStructure(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) return 0;

    let structureScore = 0;

    // Check for pronoun + verb patterns (I am, I have, I worked, we use, etc.)
    const pronounVerb = /\b(i|we|you|he|she|it|they)\s+(am|is|are|was|were|have|has|had|do|does|did|will|would|can|could|should|may|might|use|used|work|worked|built|created|developed|think|believe|found|made|know|need|want|like|learned|understand|implemented|designed|managed)\b/gi;
    const pvMatches = lower.match(pronounVerb);
    if (pvMatches) structureScore += Math.min(pvMatches.length * 8, 25);

    // Check for preposition usage (indicates structured phrases)
    const prepositions = /\b(in|on|at|by|for|with|about|from|into|through|during|before|after|between|under|over|along|across)\b/gi;
    const prepMatches = lower.match(prepositions);
    if (prepMatches) structureScore += Math.min(prepMatches.length * 3, 15);

    // Check for connectors/transitions
    let connectorCount = 0;
    for (const c of CONNECTORS) {
        if (lower.includes(c)) connectorCount++;
    }
    structureScore += Math.min(connectorCount * 5, 15);

    // Check for explanation patterns
    const explanationPatterns = /\b(because|since|so that|in order to|which means|this allows|this helps|the reason|for example|for instance|such as)\b/gi;
    const expMatches = lower.match(explanationPatterns);
    if (expMatches) structureScore += Math.min(expMatches.length * 6, 20);

    // Length-adjusted — longer answers should have more structure
    const expectedStructure = Math.min(words.length * 0.5, 40);
    return Math.min(100, Math.round(structureScore / Math.max(expectedStructure, 10) * 100));
}

// ─── Improved Scoring Functions ─────────────────────
function scoreAnswerRelevance(question, answer) {
    if (!answer || answer === '[No spoken answer]' || answer.trim().length < 5) return 10;
    const qKeywords = extractKeywords(question);
    const aKeywords = extractKeywords(answer);
    if (aKeywords.length < 3) return 15;

    // Gibberish check — hard cap if detected
    const gib = detectGibberish(answer);
    if (gib.isGibberish) return Math.max(8, Math.round(25 * (1 - gib.score)));

    // Keyword overlap (weighted)
    const overlap = qKeywords.filter(k => aKeywords.some(a => a.includes(k) || k.includes(a))).length;
    const overlapRatio = qKeywords.length > 0 ? overlap / qKeywords.length : 0;

    // Semantic expansion — check if answer discusses related concepts
    const semanticBonus = aKeywords.some(a =>
        qKeywords.some(q => a.length > 3 && q.length > 3 && (a.startsWith(q.slice(0, 4)) || q.startsWith(a.slice(0, 4))))
    ) ? 8 : 0;

    // Sentence structure quality
    const structure = analyzeSentenceStructure(answer);
    const structureBonus = structure > 60 ? 12 : structure > 30 ? 6 : structure > 10 ? 0 : -15;

    // Answer length (sweet spot: 20-150 words)
    const wordCount = answer.split(/\s+/).length;
    const lengthBonus = wordCount < 8 ? -20 : wordCount < 20 ? -5 : wordCount < 150 ? 10 : 5;

    // Coherence check
    const diversity = vocabularyDiversity(aKeywords);
    const coherencePenalty = diversity < 0.3 ? -25 : diversity < 0.45 ? -10 : 0;

    const raw = 25 + overlapRatio * 40 + semanticBonus + structureBonus + lengthBonus + coherencePenalty;
    return Math.max(8, Math.min(95, Math.round(raw)));
}

function scoreSpeechClarity(answer, speechMetrics) {
    if (!answer || answer === '[No spoken answer]' || answer.trim().length < 5) return 12;
    const words = answer.split(/\s+/);
    const fillers = countFillers(answer);
    const fillerRatio = words.length > 0 ? fillers / words.length : 1;

    // Gibberish check
    const gib = detectGibberish(answer);
    if (gib.isGibberish) return Math.max(10, Math.round(30 * (1 - gib.score)));

    // Filler penalty (stricter)
    const fillerPenalty = fillerRatio > 0.18 ? -35 : fillerRatio > 0.10 ? -20 : fillerRatio > 0.05 ? -8 : fillerRatio < 0.02 ? 8 : 3;

    // Speech rate
    const wpm = speechMetrics?.wordsPerMin || 0;
    const pacePenalty = wpm > 0 ? (wpm < 70 ? -15 : wpm < 100 ? -5 : wpm > 190 ? -12 : wpm > 160 ? -5 : 8) : 0;

    // Sentence structure quality
    const structure = analyzeSentenceStructure(answer);
    const structureBonus = structure > 50 ? 10 : structure > 25 ? 5 : -5;

    // Pause penalty from metrics
    const pausePenalty = speechMetrics?.pauseCount > 6 ? -12 : speechMetrics?.pauseCount > 3 ? -6 : 0;

    const raw = 50 + fillerPenalty + pacePenalty + structureBonus + pausePenalty;
    return Math.max(8, Math.min(95, Math.round(raw)));
}

function scoreConfidence(answer, speechMetrics, relevanceScore) {
    if (!answer || answer === '[No spoken answer]' || answer.trim().length < 5) return 10;
    const words = answer.split(/\s+/);
    const fillers = countFillers(answer);
    const fillerRatio = words.length > 0 ? fillers / words.length : 1;

    // Gibberish = no confidence, period
    const gib = detectGibberish(answer);
    if (gib.isGibberish) return Math.max(8, Math.round(22 * (1 - gib.score)));

    // CROSS-VALIDATION: if relevance is very low, confidence is capped
    const relevanceCap = relevanceScore < 25 ? 30 : relevanceScore < 40 ? 50 : relevanceScore < 55 ? 65 : 98;

    // Filler words → hesitation → low confidence
    const fillerPenalty = fillerRatio > 0.18 ? -40 : fillerRatio > 0.10 ? -25 : fillerRatio > 0.05 ? -8 : fillerRatio < 0.02 ? 8 : 3;

    // Answer length
    const lengthBonus = words.length < 8 ? -20 : words.length < 15 ? -5 : words.length < 120 ? 10 : 5;

    // Vocabulary diversity — but weighted lower to prevent gibberish inflation
    const kwds = extractKeywords(answer);
    const div = vocabularyDiversity(kwds);
    const diversityBonus = div > 0.7 ? 5 : div > 0.5 ? 3 : div < 0.3 ? -8 : 0;

    // Speech rate — too slow = uncertain, too fast = nervous
    const wpm = speechMetrics?.wordsPerMin || 0;
    const paceBonus = wpm > 0 ? (wpm < 70 ? -12 : wpm < 100 ? -5 : wpm > 190 ? -10 : wpm > 160 ? -3 : 5) : 0;

    // Pause/hesitation from metrics
    const pausePenalty = speechMetrics?.pauseCount > 6 ? -15 : speechMetrics?.pauseCount > 3 ? -8 : speechMetrics?.pauseCount > 1 ? -3 : 3;

    // Sentence structure = articulate = confident
    const structure = analyzeSentenceStructure(answer);
    const structureBonus = structure > 50 ? 8 : structure > 25 ? 4 : -5;

    const raw = 45 + fillerPenalty + lengthBonus + diversityBonus + paceBonus + pausePenalty + structureBonus;
    return Math.max(8, Math.min(relevanceCap, Math.min(95, Math.round(raw))));
}

function scoreTechnical(question, answer, role) {
    if (!answer || answer === '[No spoken answer]' || answer.trim().length < 5) return 10;
    const aLower = answer.toLowerCase();

    // Gibberish check
    const gib = detectGibberish(answer);
    if (gib.isGibberish) return Math.max(8, Math.round(20 * (1 - gib.score)));

    let techPool = TECH_KEYWORDS.general;
    if (role?.includes('Frontend')) techPool = [...TECH_KEYWORDS.frontend, ...TECH_KEYWORDS.general];
    else if (role?.includes('Backend') || role?.includes('Full Stack')) techPool = [...TECH_KEYWORDS.backend, ...TECH_KEYWORDS.frontend, ...TECH_KEYWORDS.general];
    else if (role?.includes('Data')) techPool = [...TECH_KEYWORDS.datascience, ...TECH_KEYWORDS.general];

    // Question-specific tech terms
    const qKeywords = extractKeywords(question);
    const relevantTech = techPool.filter(t => qKeywords.some(q => t.includes(q) || q.includes(t)));
    const allTech = relevantTech.length > 0 ? relevantTech : techPool;
    const found = allTech.filter(t => aLower.includes(t)).length;

    // Keyword stuffing detection — if tech words are >40% of answer, suspicious
    const words = answer.split(/\s+/);
    const techRatio = words.length > 0 ? found / words.length : 0;
    const stuffingPenalty = techRatio > 0.4 ? -15 : 0;

    // Structure bonus — technical answers should be well-explained
    const structure = analyzeSentenceStructure(answer);
    const structureBonus = structure > 40 ? 10 : structure > 20 ? 5 : -5;

    const lengthBonus = words.length > 30 ? 8 : words.length > 15 ? 4 : 0;
    const raw = 25 + Math.min(found * 7, 35) + lengthBonus + structureBonus + stuffingPenalty;
    return Math.max(8, Math.min(95, Math.round(raw)));
}

function scoreCommunication(answer) {
    if (!answer || answer === '[No spoken answer]' || answer.trim().length < 5) return 10;
    const words = answer.split(/\s+/);
    const kwds = extractKeywords(answer);
    const diversity = vocabularyDiversity(kwds);
    const fillers = countFillers(answer);
    const fillerRatio = words.length > 0 ? fillers / words.length : 1;

    // Gibberish = cannot communicate
    const gib = detectGibberish(answer);
    if (gib.isGibberish) return Math.max(8, Math.round(22 * (1 - gib.score)));

    // Sentence structure is critical for communication
    const structure = analyzeSentenceStructure(answer);
    const structureBonus = structure > 60 ? 18 : structure > 40 ? 12 : structure > 20 ? 5 : -10;

    const diversityBonus = diversity > 0.65 ? 10 : diversity > 0.5 ? 6 : diversity > 0.35 ? 2 : -8;
    const fillerPenalty = fillerRatio > 0.15 ? -25 : fillerRatio > 0.08 ? -12 : fillerRatio > 0.03 ? -5 : 3;
    const lengthBonus = words.length > 40 ? 8 : words.length > 20 ? 5 : words.length < 8 ? -18 : 0;

    const raw = 42 + diversityBonus + fillerPenalty + lengthBonus + structureBonus;
    return Math.max(8, Math.min(95, Math.round(raw)));
}

app.post('/api/interviews', (req, res) => {
    try {
        const { userId, jobId, type, questions, answers, speechMetrics } = req.body;
        const student = db.prepare('SELECT student_id, skills FROM students WHERE user_id = ?').get(userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Determine role from question bank context
        const role = req.body.role || 'General';

        // Compute per-question scores
        let totalToneScore = 0;
        let voiceAnswerCount = 0;

        const perQ = (questions || []).map((q, i) => {
            const aObj = answers?.[i] || { type: 'text', text: '' };
            const text = aObj.text || '';
            const relevance = scoreAnswerRelevance(q, text);
            const tech = scoreTechnical(q, text, role);
            const qScore = Math.round((relevance * 0.6 + tech * 0.4));
            
            // Generate tone score if voice
            let toneScore = null;
            if (aObj.type === 'voice') {
                toneScore = scoreConfidence(text, aObj.metrics || {}, relevance);
                totalToneScore += toneScore;
                voiceAnswerCount++;
            }

            return { 
                q, 
                a: text, 
                type: aObj.type,
                audioUrl: aObj.audioUrl || null,
                toneScore,
                score: qScore, 
                relevance, 
                tech 
            };
        });

        // Aggregate all answers for fallback confidence (if no voice used)
        const allAnswers = perQ.map(q => q.a).join(' ');
        const metrics = speechMetrics || {};

        // Core scores from actual answer analysis
        const avgRelevance = perQ.length > 0 ? Math.round(perQ.reduce((s, q) => s + q.relevance, 0) / perQ.length) : 10;
        const avgTechnical = perQ.length > 0 ? Math.round(perQ.reduce((s, q) => s + q.tech, 0) / perQ.length) : 10;

        // Confidence: Average of tone scores if voice was used, else fallback structure analysis
        const confidenceScore = voiceAnswerCount > 0 
            ? Math.round(totalToneScore / voiceAnswerCount)
            : scoreConfidence(allAnswers, metrics, avgRelevance);

        // Behavioral scores: use real frontend metrics if available, else conservative fallback
        // Fallback correlates with answer quality but stays conservative (no inflated defaults)
        const behavioralFallback = Math.max(8, Math.round(avgRelevance * 0.4 + confidenceScore * 0.2));

        const scores = {
            answer_relevance: avgRelevance,
            technical: avgTechnical,
            confidence: confidenceScore,
            speech: scoreSpeechClarity(allAnswers, metrics),
            communication: scoreCommunication(allAnswers),
            // Real metrics from frontend video analysis take priority over fallbacks
            eye_contact: Math.max(8, Math.min(95, Math.round(metrics.eyeContactScore ?? behavioralFallback))),
            posture: Math.max(8, Math.min(95, Math.round(metrics.postureScore ?? behavioralFallback))),
            body_language: Math.max(8, Math.min(95, Math.round(metrics.expressionScore ?? behavioralFallback)))
        };

        const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length * 10) / 10;

        // Generate contextual feedback from actual scores
        const feedback = { strengths: [], improvements: [] };
        if (scores.answer_relevance >= 75) feedback.strengths.push('Your answers were relevant and addressed the questions well');
        if (scores.technical >= 75) feedback.strengths.push('Good use of technical terminology and domain knowledge');
        if (scores.confidence >= 75) feedback.strengths.push('Confident and fluent delivery with minimal hesitation');
        if (scores.communication >= 75) feedback.strengths.push('Clear and well-structured communication');
        if (scores.speech >= 75) feedback.strengths.push('Excellent speech clarity and pacing');
        if (scores.answer_relevance < 60) feedback.improvements.push('Focus on directly addressing the question — some answers were off-topic or too vague');
        if (scores.technical < 60) feedback.improvements.push('Include more specific technical terms and concepts from your domain');
        if (scores.confidence < 60) feedback.improvements.push('Reduce filler words (um, uh, like) and speak with more conviction');
        if (scores.communication < 60) feedback.improvements.push('Structure your answers better — use introduction, details, and conclusion');
        if (scores.speech < 60) feedback.improvements.push('Speak more clearly at a steady pace — avoid rushing or trailing off');
        if (scores.eye_contact < 60) feedback.improvements.push('Maintain consistent eye contact with the camera throughout');
        if (scores.posture < 60) feedback.improvements.push('Sit straight and avoid excessive movement during the interview');
        if (feedback.strengths.length === 0) feedback.strengths.push('You showed willingness to participate — practice will improve your performance');
        if (feedback.improvements.length === 0) feedback.improvements.push('Outstanding performance — keep refining your skills!');

        const result = db.prepare(`INSERT INTO interviews (candidate_id, job_id, interview_type, eye_contact_score, speech_score, posture_score, answer_relevance_score, confidence_score, communication_score, technical_score, body_language_score, overall_score, feedback, questions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(student.student_id, jobId || null, type || 'mock', scores.eye_contact, scores.speech, scores.posture, scores.answer_relevance, scores.confidence, scores.communication, scores.technical, scores.body_language, overall, JSON.stringify(feedback), JSON.stringify(perQ));

        const interview = db.prepare('SELECT * FROM interviews WHERE interview_id = ?').get(result.lastInsertRowid);
        interview.feedback = JSON.parse(interview.feedback);
        interview.questions = JSON.parse(interview.questions);
        res.json(interview);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── MOCK INTERVIEW QUESTIONS ─────────────────────────
app.post('/api/interviews/generate-questions', (req, res) => {
    const { role, skills } = req.body;
    const questionBanks = {
        'Frontend Developer': [
            'Explain the difference between virtual DOM and real DOM in React.',
            'How does CSS specificity work? Give examples.',
            'What are React hooks? Explain useState and useEffect with examples.',
            'Describe how you would optimize a slow-loading web page.',
            'Explain the concept of closures in JavaScript.',
            'What is the difference between REST and GraphQL APIs?',
            'How do you handle state management in large React applications?'
        ],
        'Backend Developer': [
            'Explain the difference between SQL and NoSQL databases.',
            'What is RESTful API design? What are best practices?',
            'How do you handle authentication and authorization in APIs?',
            'Explain the concept of middleware in Express.js.',
            'What are microservices? How do they differ from monolithic architecture?',
            'How would you design a rate limiting system?',
            'Explain database indexing and its impact on performance.'
        ],
        'Data Scientist': [
            'Explain the bias-variance tradeoff in machine learning.',
            'What is the difference between supervised and unsupervised learning?',
            'How do you handle missing data in a dataset?',
            'Explain gradient descent and its variants.',
            'What evaluation metrics would you use for an imbalanced classification problem?',
            'Describe the process of feature engineering.',
            'What is cross-validation and why is it important?'
        ],
        'Full Stack Developer': [
            'Describe the full lifecycle of an HTTP request.',
            'How do you ensure security in a full-stack application?',
            'Explain the concept of server-side rendering vs client-side rendering.',
            'How would you design a real-time notification system?',
            'What is CI/CD and why is it important?',
            'Explain database normalization and when to denormalize.',
            'How do you handle file uploads in a web application?'
        ],
        'General': [
            'Tell me about yourself and your background.',
            'What is your greatest technical achievement?',
            'How do you approach debugging a complex issue?',
            'Describe a challenging project and how you handled it.',
            'Where do you see yourself in 5 years?',
            'How do you stay updated with new technologies?',
            'Describe your experience working in a team environment.'
        ]
    };

    const bank = questionBanks[role] || questionBanks['General'];
    const introQ = "Please introduce yourself and tell me about your background.";
    const remainingQuestions = bank.filter(q => q !== 'Tell me about yourself and your background.').sort(() => Math.random() - 0.5).slice(0, 4);
    const selected = [introQ, ...remainingQuestions];
    res.json({ questions: selected, role: role || 'General' });
});

// ─── JOBS ─────────────────────────────────────────────
app.get('/api/jobs', (req, res) => {
    try {
        const jobs = db.prepare(`SELECT j.*, c.company_name, c.industry_type, c.logo FROM jobs j JOIN companies c ON j.company_id = c.company_id WHERE j.status = 'active' ORDER BY j.created_at DESC`).all();
        jobs.forEach(j => j.required_skills = JSON.parse(j.required_skills || '[]'));
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/jobs/:jobId', (req, res) => {
    try {
        const job = db.prepare('SELECT j.*, c.company_name, c.industry_type, c.company_description, c.logo FROM jobs j JOIN companies c ON j.company_id = c.company_id WHERE j.job_id = ?').get(req.params.jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        job.required_skills = JSON.parse(job.required_skills || '[]');
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/jobs', (req, res) => {
    try {
        const { companyId, job_title, job_description, required_skills, salary_range, interview_date, application_deadline } = req.body;
        const result = db.prepare('INSERT INTO jobs (company_id, job_title, job_description, required_skills, salary_range, interview_date, application_deadline) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(companyId, job_title, job_description, JSON.stringify(required_skills || []), salary_range, interview_date, application_deadline);
        const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(result.lastInsertRowid);
        job.required_skills = JSON.parse(job.required_skills || '[]');
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/jobs/:jobId', (req, res) => {
    try {
        const { job_title, job_description, required_skills, salary_range, interview_date, application_deadline, status } = req.body;
        db.prepare('UPDATE jobs SET job_title=?, job_description=?, required_skills=?, salary_range=?, interview_date=?, application_deadline=?, status=? WHERE job_id=?')
            .run(job_title, job_description, JSON.stringify(required_skills || []), salary_range, interview_date, application_deadline, status || 'active', req.params.jobId);
        const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(req.params.jobId);
        job.required_skills = JSON.parse(job.required_skills || '[]');
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/jobs/:jobId', (req, res) => {
    try {
        db.prepare('DELETE FROM jobs WHERE job_id = ?').run(req.params.jobId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── APPLICATIONS ─────────────────────────────────────
app.get('/api/applications/student/:userId', (req, res) => {
    try {
        const student = db.prepare('SELECT student_id FROM students WHERE user_id = ?').get(req.params.userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const apps = db.prepare('SELECT a.*, j.job_title, j.salary_range, c.company_name FROM applications a JOIN jobs j ON a.job_id = j.job_id JOIN companies c ON j.company_id = c.company_id WHERE a.student_id = ? ORDER BY a.applied_at DESC').all(student.student_id);
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/applications', (req, res) => {
    try {
        const { userId, jobId } = req.body;
        const student = db.prepare('SELECT student_id FROM students WHERE user_id = ?').get(userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const existing = db.prepare('SELECT * FROM applications WHERE student_id = ? AND job_id = ?').get(student.student_id, jobId);
        if (existing) return res.status(409).json({ error: 'Already applied' });
        db.prepare('INSERT INTO applications (student_id, job_id) VALUES (?, ?)').run(student.student_id, jobId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── COMPANY ──────────────────────────────────────────
app.get('/api/companies/:userId', (req, res) => {
    try {
        const company = db.prepare('SELECT c.*, u.name, u.email FROM companies c JOIN users u ON c.user_id = u.id WHERE c.user_id = ?').get(req.params.userId);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/companies/:userId', (req, res) => {
    try {
        const { company_name, recruiter_name, recruiter_email, industry_type, company_description } = req.body;
        db.prepare('UPDATE companies SET company_name=?, recruiter_name=?, recruiter_email=?, industry_type=?, company_description=? WHERE user_id=?')
            .run(company_name, recruiter_name, recruiter_email, industry_type, company_description, req.params.userId);
        if (req.body.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(req.body.name, req.params.userId);
        const company = db.prepare('SELECT c.*, u.name, u.email FROM companies c JOIN users u ON c.user_id = u.id WHERE c.user_id = ?').get(req.params.userId);
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/companies/:userId/jobs', (req, res) => {
    try {
        const company = db.prepare('SELECT company_id FROM companies WHERE user_id = ?').get(req.params.userId);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        const jobs = db.prepare('SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC').all(company.company_id);
        jobs.forEach(j => j.required_skills = JSON.parse(j.required_skills || '[]'));
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/companies/:userId/candidates', (req, res) => {
    try {
        const company = db.prepare('SELECT company_id FROM companies WHERE user_id = ?').get(req.params.userId);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        const candidates = db.prepare(`
      SELECT DISTINCT s.student_id, u.name, u.email, s.college, s.degree, s.skills, s.resume_score,
        a.status as application_status, a.job_id, j.job_title, j.required_skills,
        (SELECT AVG(overall_score) FROM interviews WHERE candidate_id = s.student_id) as avg_interview_score
      FROM applications a
      JOIN students s ON a.student_id = s.student_id
      JOIN users u ON s.user_id = u.id
      JOIN jobs j ON a.job_id = j.job_id
      WHERE j.company_id = ?
      ORDER BY s.resume_score DESC
    `).all(company.company_id);

        candidates.forEach(c => {
            c.skills = JSON.parse(c.skills || '[]');
            c.required_skills = JSON.parse(c.required_skills || '[]');
            const match = c.skills.filter(s => c.required_skills.map(r => r.toLowerCase()).includes(s.toLowerCase()));
            c.skill_match_pct = c.required_skills.length > 0 ? Math.round(match.length / c.required_skills.length * 100) : 0;
        });
        res.json(candidates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/applications/:appId/status', (req, res) => {
    try {
        const { status } = req.body;
        db.prepare('UPDATE applications SET status = ? WHERE application_id = ?').run(status, req.params.appId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DASHBOARD ────────────────────────────────────────
app.get('/api/dashboard/student/:userId', (req, res) => {
    try {
        const student = db.prepare('SELECT s.*, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?').get(req.params.userId);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        const interviews = db.prepare('SELECT * FROM interviews WHERE candidate_id = ? ORDER BY recorded_at ASC').all(student.student_id);
        const applications = db.prepare('SELECT a.*, j.job_title, c.company_name FROM applications a JOIN jobs j ON a.job_id = j.job_id JOIN companies c ON j.company_id = c.company_id WHERE a.student_id = ?').all(student.student_id);

        interviews.forEach(i => {
            i.feedback = JSON.parse(i.feedback || '{}');
            i.questions = JSON.parse(i.questions || '[]');
        });

        res.json({
            resume_score: student.resume_score,
            total_interviews: interviews.length,
            avg_score: interviews.length > 0 ? Math.round(interviews.reduce((a, i) => a + i.overall_score, 0) / interviews.length) : 0,
            latest_score: interviews.length > 0 ? interviews[interviews.length - 1].overall_score : 0,
            score_trend: interviews.map(i => ({ date: i.recorded_at, score: i.overall_score })),
            category_averages: {
                eye_contact: avg(interviews, 'eye_contact_score'),
                speech: avg(interviews, 'speech_score'),
                posture: avg(interviews, 'posture_score'),
                answer_relevance: avg(interviews, 'answer_relevance_score'),
                confidence: avg(interviews, 'confidence_score'),
                communication: avg(interviews, 'communication_score'),
                technical: avg(interviews, 'technical_score'),
                body_language: avg(interviews, 'body_language_score')
            },
            applications: applications,
            recent_interviews: interviews.slice(-5).reverse()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function avg(arr, field) {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b[field], 0) / arr.length);
}

app.get('/api/dashboard/company/:userId', (req, res) => {
    try {
        const company = db.prepare('SELECT * FROM companies WHERE user_id = ?').get(req.params.userId);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        const jobs = db.prepare('SELECT * FROM jobs WHERE company_id = ?').all(company.company_id);
        const jobIds = jobs.map(j => j.job_id);

        let totalApplicants = 0, shortlisted = 0, accepted = 0, rejected = 0;
        let allCandidates = [];

        jobIds.forEach(jid => {
            const apps = db.prepare(`
        SELECT a.*, s.student_id, u.name, s.resume_score, s.skills, j.job_title, j.required_skills,
          (SELECT AVG(overall_score) FROM interviews WHERE candidate_id = s.student_id) as avg_score
        FROM applications a
        JOIN students s ON a.student_id = s.student_id
        JOIN users u ON s.user_id = u.id
        JOIN jobs j ON a.job_id = j.job_id
        WHERE a.job_id = ?
      `).all(jid);
            apps.forEach(a => {
                a.skills = JSON.parse(a.skills || '[]');
                a.required_skills = JSON.parse(a.required_skills || '[]');
                totalApplicants++;
                if (a.status === 'shortlisted') shortlisted++;
                if (a.status === 'accepted') accepted++;
                if (a.status === 'rejected') rejected++;
            });
            allCandidates.push(...apps);
        });

        // Leaderboard
        const leaderboard = allCandidates
            .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))
            .slice(0, 10)
            .map((c, i) => ({ ...c, rank: i + 1 }));

        jobs.forEach(j => j.required_skills = JSON.parse(j.required_skills || '[]'));

        res.json({
            total_jobs: jobs.length,
            total_applicants: totalApplicants,
            shortlisted,
            accepted,
            rejected,
            jobs,
            leaderboard,
            status_breakdown: { pending: totalApplicants - shortlisted - accepted - rejected, shortlisted, accepted, rejected }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── SERVE FRONTEND BUILD ─────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AI Interview Platform running on http://localhost:${PORT}`);
});
