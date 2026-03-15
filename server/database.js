import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'platform.db');

let db;

export function getDb() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeDatabase();
    }
    return db;
}

function initializeDatabase() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'company')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      phone TEXT,
      college TEXT,
      degree TEXT,
      graduation_year INTEGER,
      skills TEXT DEFAULT '[]',
      resume_file TEXT,
      resume_score INTEGER DEFAULT 0,
      linkedin TEXT,
      github TEXT,
      projects TEXT DEFAULT '[]',
      certifications TEXT DEFAULT '[]',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS companies (
      company_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      company_name TEXT,
      recruiter_name TEXT,
      recruiter_email TEXT,
      industry_type TEXT,
      company_description TEXT,
      logo TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      job_id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      job_title TEXT NOT NULL,
      job_description TEXT,
      required_skills TEXT DEFAULT '[]',
      salary_range TEXT,
      interview_date TEXT,
      application_deadline TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(company_id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      application_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted')),
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id),
      FOREIGN KEY (job_id) REFERENCES jobs(job_id),
      UNIQUE(student_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS interviews (
      interview_id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      job_id INTEGER,
      interview_type TEXT DEFAULT 'mock' CHECK(interview_type IN ('mock', 'screening', 'live')),
      eye_contact_score REAL DEFAULT 0,
      speech_score REAL DEFAULT 0,
      posture_score REAL DEFAULT 0,
      answer_relevance_score REAL DEFAULT 0,
      confidence_score REAL DEFAULT 0,
      communication_score REAL DEFAULT 0,
      technical_score REAL DEFAULT 0,
      body_language_score REAL DEFAULT 0,
      overall_score REAL DEFAULT 0,
      feedback TEXT DEFAULT '{}',
      questions TEXT DEFAULT '[]',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES students(student_id),
      FOREIGN KEY (job_id) REFERENCES jobs(job_id)
    );
  `);

    // Seed demo data if empty
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
        seedDatabase();
    }
}

function seedDatabase() {
    const hash = bcrypt.hashSync('password123', 10);

    // Create demo students
    const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    const insertStudent = db.prepare('INSERT INTO students (user_id, phone, college, degree, graduation_year, skills, resume_score, linkedin, github, projects, certifications) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertCompany = db.prepare('INSERT INTO companies (user_id, company_name, recruiter_name, recruiter_email, industry_type, company_description) VALUES (?, ?, ?, ?, ?, ?)');
    const insertJob = db.prepare('INSERT INTO jobs (company_id, job_title, job_description, required_skills, salary_range, interview_date, application_deadline) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertInterview = db.prepare('INSERT INTO interviews (candidate_id, job_id, interview_type, eye_contact_score, speech_score, posture_score, answer_relevance_score, confidence_score, communication_score, technical_score, body_language_score, overall_score, feedback, questions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertApplication = db.prepare('INSERT INTO applications (student_id, job_id, status) VALUES (?, ?, ?)');

    const seedAll = db.transaction(() => {
        // Students
        const s1 = insertUser.run('Aarav Sharma', 'aarav@demo.com', hash, 'student');
        insertStudent.run(s1.lastInsertRowid, '9876543210', 'IIT Delhi', 'B.Tech Computer Science', 2026,
            JSON.stringify(['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'Git']), 82,
            'https://linkedin.com/in/aarav', 'https://github.com/aarav',
            JSON.stringify([{ name: 'E-Commerce Platform', description: 'Built a full-stack e-commerce app', tech: 'React, Node.js, MongoDB' }, { name: 'Chat Application', description: 'Real-time chat with WebSockets', tech: 'Socket.io, Express' }]),
            JSON.stringify(['AWS Cloud Practitioner', 'Google Data Analytics']));

        const s2 = insertUser.run('Priya Patel', 'priya@demo.com', hash, 'student');
        insertStudent.run(s2.lastInsertRowid, '9876543211', 'NIT Trichy', 'B.Tech Information Technology', 2025,
            JSON.stringify(['Python', 'Django', 'Machine Learning', 'TensorFlow', 'SQL']), 75,
            'https://linkedin.com/in/priya', 'https://github.com/priya',
            JSON.stringify([{ name: 'Sentiment Analyzer', description: 'NLP-based sentiment analysis tool', tech: 'Python, NLTK, Flask' }]),
            JSON.stringify(['TensorFlow Developer Certificate']));

        const s3 = insertUser.run('Rohan Gupta', 'rohan@demo.com', hash, 'student');
        insertStudent.run(s3.lastInsertRowid, '9876543212', 'BITS Pilani', 'M.Tech Software Engineering', 2025,
            JSON.stringify(['Java', 'Spring Boot', 'AWS', 'Docker', 'Kubernetes', 'Microservices']), 90,
            'https://linkedin.com/in/rohan', 'https://github.com/rohan',
            JSON.stringify([{ name: 'Microservices Platform', description: 'Cloud-native microservices architecture', tech: 'Spring Boot, Docker, K8s' }, { name: 'CI/CD Pipeline', description: 'Automated deployment pipeline', tech: 'Jenkins, Docker, AWS' }]),
            JSON.stringify(['AWS Solutions Architect', 'Kubernetes Administrator']));

        // Companies
        const c1 = insertUser.run('TechNova Inc.', 'technova@demo.com', hash, 'company');
        insertCompany.run(c1.lastInsertRowid, 'TechNova Inc.', 'Ankit Mehta', 'ankit@technova.com', 'Technology', 'Leading AI and cloud solutions company specializing in enterprise software. We build cutting-edge products that transform how businesses operate.');

        const c2 = insertUser.run('DataFlow Systems', 'dataflow@demo.com', hash, 'company');
        insertCompany.run(c2.lastInsertRowid, 'DataFlow Systems', 'Sneha Kapoor', 'sneha@dataflow.com', 'Data Analytics', 'Premier data analytics firm providing real-time insights and business intelligence solutions to Fortune 500 companies.');

        // Jobs
        insertJob.run(1, 'Senior Frontend Developer', 'Build modern, responsive web applications using React and TypeScript. Work with our design team to create exceptional user experiences.', JSON.stringify(['React', 'JavaScript', 'TypeScript', 'CSS', 'Git']), '₹12-18 LPA', '2026-04-15', '2026-04-01');
        insertJob.run(1, 'Backend Engineer', 'Design and implement scalable backend services using Node.js and cloud technologies. Focus on API design and database optimization.', JSON.stringify(['Node.js', 'Express', 'SQL', 'AWS', 'Docker']), '₹14-22 LPA', '2026-04-20', '2026-04-05');
        insertJob.run(1, 'ML Engineer', 'Develop and deploy machine learning models for our AI products. Work with large datasets and build production-ready ML pipelines.', JSON.stringify(['Python', 'TensorFlow', 'Machine Learning', 'SQL', 'Docker']), '₹18-28 LPA', '2026-05-01', '2026-04-15');
        insertJob.run(2, 'Data Analyst', 'Analyze complex datasets and create actionable insights. Build dashboards and reports for executive stakeholders.', JSON.stringify(['Python', 'SQL', 'Tableau', 'Statistics']), '₹8-14 LPA', '2026-04-10', '2026-03-28');
        insertJob.run(2, 'Full Stack Developer', 'Build end-to-end web applications for our analytics platform. Work across the entire stack from database to UI.', JSON.stringify(['React', 'Node.js', 'Python', 'SQL', 'AWS']), '₹15-24 LPA', '2026-04-25', '2026-04-10');

        // Interviews for students
        insertInterview.run(1, 1, 'mock', 78, 82, 75, 80, 77, 81, 79, 76, 78.5,
            JSON.stringify({ strengths: ['Good communication', 'Strong technical knowledge'], improvements: ['Maintain more eye contact', 'Slow down speech pace'] }),
            JSON.stringify([{ q: 'Explain React virtual DOM', a: 'The virtual DOM is a lightweight copy...' }, { q: 'What is closure in JavaScript?', a: 'A closure is a function that...' }]));
        insertInterview.run(1, 1, 'mock', 82, 85, 80, 84, 83, 86, 82, 81, 82.9,
            JSON.stringify({ strengths: ['Improved eye contact', 'Clear explanations'], improvements: ['Add more examples', 'Better posture'] }),
            JSON.stringify([{ q: 'Explain REST vs GraphQL', a: 'REST is an architectural style...' }, { q: 'How does React state management work?', a: 'State in React...' }]));
        insertInterview.run(1, null, 'mock', 85, 88, 83, 87, 86, 89, 85, 84, 85.9,
            JSON.stringify({ strengths: ['Excellent communication', 'Strong examples'], improvements: ['Could be more concise'] }),
            JSON.stringify([{ q: 'What are microservices?', a: 'Microservices are an architecture...' }]));

        insertInterview.run(2, 3, 'mock', 70, 74, 68, 76, 72, 73, 78, 69, 72.5,
            JSON.stringify({ strengths: ['Good ML knowledge'], improvements: ['Improve confidence', 'Better eye contact', 'Work on body language'] }),
            JSON.stringify([{ q: 'Explain gradient descent', a: 'Gradient descent is...' }]));

        insertInterview.run(3, 2, 'mock', 88, 90, 86, 92, 89, 91, 93, 87, 89.5,
            JSON.stringify({ strengths: ['Outstanding technical depth', 'Professional demeanor', 'Excellent communication'], improvements: ['Minor: could vary vocal tone'] }),
            JSON.stringify([{ q: 'Explain Docker containerization', a: 'Docker uses OS-level virtualization...' }]));
        insertInterview.run(3, null, 'mock', 90, 92, 88, 94, 91, 93, 95, 89, 91.5,
            JSON.stringify({ strengths: ['Top-tier performance across all metrics'], improvements: ['Keep it up!'] }),
            JSON.stringify([{ q: 'Design a load balancer', a: 'A load balancer distributes...' }]));

        // Applications
        insertApplication.run(1, 1, 'shortlisted');
        insertApplication.run(1, 2, 'pending');
        insertApplication.run(2, 3, 'reviewed');
        insertApplication.run(2, 4, 'pending');
        insertApplication.run(3, 2, 'shortlisted');
        insertApplication.run(3, 5, 'accepted');
    });

    seedAll();
}

export default getDb;
