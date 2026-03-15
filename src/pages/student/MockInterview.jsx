import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Video, Mic, MicOff, Camera, CameraOff, Play, Clock, ChevronRight,
    Send, Loader2, AlertTriangle, Eye, Smile, Volume2, PersonStanding,
    Target, Languages, CheckCircle, Square, Keyboard
} from 'lucide-react';

const roles = [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Scientist', 'General'
];

// ─── Filler word detection ─────────────────────────────
const FILLER_WORDS = ['um', 'uh', 'uhh', 'umm', 'hmm', 'like', 'basically', 'actually', 'literally'];
const FILLER_PHRASES = ['you know', 'i mean', 'sort of', 'kind of'];

function countFillers(text) {
    const lower = text.toLowerCase();
    let count = 0;
    for (const f of FILLER_WORDS) {
        const regex = new RegExp('\\b' + f + '\\b', 'gi');
        const m = lower.match(regex);
        if (m) count += m.length;
    }
    for (const p of FILLER_PHRASES) {
        const regex = new RegExp(p, 'gi');
        const m = lower.match(regex);
        if (m) count += m.length;
    }
    return count;
}

export default function MockInterview() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const recognitionRef = useRef(null);
    const alertTimerRef = useRef(null);

    const [stage, setStage] = useState('setup');
    const [role, setRole] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timer, setTimer] = useState(1800);
    const [cameraOn, setCameraOn] = useState(true);
    const [micOn, setMicOn] = useState(true);
    const [cameraError, setCameraError] = useState(false);
    const [result, setResult] = useState(null);
    const timerRef = useRef(null);

    // V5: Robust Speech Recognition
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [language, setLanguage] = useState('en-IN');
    const [speechComplete, setSpeechComplete] = useState(false);

    // V6: Hybrid Answer System
    const [answerMode, setAnswerMode] = useState('select'); // 'select' | 'voice' | 'text'
    const [textAnswer, setTextAnswer] = useState('');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [currentAudioBlob, setCurrentAudioBlob] = useState(null);

    // Committed transcript buffer — never gets overwritten by restarts
    const committedTranscriptRef = useRef('');
    const isRecognitionActiveRef = useRef(false);     // controls restart loop
    const restartCountRef = useRef(0);                // prevents infinite restart loops
    const restartTimerRef = useRef(null);             // delayed restart timer
    const silenceTimerRef = useRef(null);             // silence detection timer
    const pendingFragmentRef = useRef('');             // audio continuity buffer for restart gaps

    // Speech analytics
    const speechStartRef = useRef(null);
    const lastSpeechRef = useRef(Date.now());
    const pauseCountRef = useRef(0);
    const shortPauseCountRef = useRef(0);             // 1-3s pauses
    const fillerCountRef = useRef(0);
    const totalWordsRef = useRef(0);
    const finalResultCountRef = useRef(0);            // tracks finalized results for clarity %
    const totalResultCountRef = useRef(0);            // tracks all results for clarity %
    const wordsInLastWindowRef = useRef([]);           // rolling window for WPM calc

    // Behavior alerts (detection-driven)
    const [alerts, setAlerts] = useState([]);
    const alertIdRef = useRef(0);
    const lastAlertCategoryRef = useRef('');
    const lastAlertTimeRef = useRef(0);
    const alertCooldownRef = useRef({});  // category -> last alert timestamp

    // V4: Real Video Analysis
    const canvasRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const videoAnalysisRef = useRef(null);  // interval ID

    // Eye contact tracking — rolling window of last 20 readings (10 seconds at 2fps)
    const eyeContactReadings = useRef([]);
    const eyeContactGoodCount = useRef(0);
    const eyeContactTotalCount = useRef(0);
    const consecutiveLookAway = useRef(0);

    // Posture tracking — rolling window of face positions
    const postureReadings = useRef([]);     // { x, y, w, h } of face bounding box
    const postureBaselineRef = useRef(null); // initial face position as baseline
    const consecutiveBadPosture = useRef(0);
    const postureGoodCount = useRef(0);
    const postureTotalCount = useRef(0);

    // Expression tracking
    const expressionReadings = useRef([]);
    const expressionGoodCount = useRef(0);
    const expressionTotalCount = useRef(0);

    // Detection status for UI indicators
    const [detectionStatus, setDetectionStatus] = useState({ eyeContact: null, posture: null, faceDetected: false });

    // ─── Camera ──────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: true
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => { });
            }
        } catch (err) {
            console.warn('Camera error:', err);
            setCameraError(true);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    // Re-attach stream on videoRef mount
    useEffect(() => {
        if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => { });
        }
    });

    useEffect(() => {
        return () => {
            stopCamera();
            stopSpeechRecognition();
            if (timerRef.current) clearInterval(timerRef.current);
            if (alertTimerRef.current) clearInterval(alertTimerRef.current);
            if (videoAnalysisRef.current) clearInterval(videoAnalysisRef.current);
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [stopCamera, stopSpeechRecognition]);

    useEffect(() => {
        if (stage === 'active' && timer === 0) {
            submitInterview(answers);
        }
    }, [timer, stage, answers]);

    // ─── Robust Speech Recognition (V5) ────────────────────
    const startSpeechRecognition = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        // Clean up any pending restart
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 3; // better accuracy

        isRecognitionActiveRef.current = true;

        recognition.onresult = (event) => {
            let interim = '';
            let newFinal = '';

            // Only process new results (from resultIndex onward)
            for (let i = event.resultIndex; i < event.results.length; i++) {
                totalResultCountRef.current++;
                const bestResult = event.results[i][0];
                const t = bestResult.transcript;

                if (event.results[i].isFinal) {
                    finalResultCountRef.current++;
                    newFinal += t + ' ';
                } else {
                    interim += t;
                }
            }

            if (newFinal) {
                // Clear any pending fragment since we got real final results
                if (pendingFragmentRef.current) {
                    // Check if the new final already includes the pending fragment
                    const pending = pendingFragmentRef.current.trim().toLowerCase();
                    const finalLower = newFinal.trim().toLowerCase();
                    if (pending && !finalLower.includes(pending)) {
                        // Pending fragment was lost in restart gap — commit it
                        committedTranscriptRef.current += pendingFragmentRef.current + ' ';
                    }
                    pendingFragmentRef.current = '';
                }

                // Commit new final text to the permanent buffer
                committedTranscriptRef.current += newFinal;
                setTranscript(committedTranscriptRef.current);

                // Speech analytics
                const newWords = newFinal.trim().split(/\s+/).filter(w => w.length > 0);
                const wordCount = newWords.length;
                totalWordsRef.current += wordCount;
                fillerCountRef.current += countFillers(newFinal);

                // Rolling WPM: store {timestamp, count} entries
                const now = Date.now();
                wordsInLastWindowRef.current.push({ t: now, count: wordCount });
                // Clean entries older than 10 seconds
                wordsInLastWindowRef.current = wordsInLastWindowRef.current.filter(e => now - e.t < 10000);

                // Pause detection: gap since last speech
                const gap = now - lastSpeechRef.current;
                if (gap > 3000) {
                    pauseCountRef.current++;
                } else if (gap > 1000) {
                    shortPauseCountRef.current++;
                }
                lastSpeechRef.current = now;

                // Reset restart counter — real speech is happening
                restartCountRef.current = 0;

                // Silence detection: reset timer — speech is still active
                setSpeechComplete(false);
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    setSpeechComplete(true);
                    setInterimTranscript('');
                }, 2000);
            }

            setInterimTranscript(interim);
            setIsListening(true);
        };

        recognition.onspeechend = () => {
            setIsListening(false);
        };

        recognition.onerror = (e) => {
            if (e.error === 'aborted') return; // normal during stop/restart
            if (e.error !== 'no-speech') console.warn('Speech error:', e.error);
            setIsListening(false);

            // On network/service errors, don't count as restart attempt
            if (e.error === 'network' || e.error === 'service-not-allowed') {
                restartCountRef.current = 0;
            }
        };

        recognition.onend = () => {
            setIsListening(false);

            // Only auto-restart if we're supposed to be active
            if (!isRecognitionActiveRef.current) return;

            // Prevent infinite restart loops (max 5 consecutive without speech)
            restartCountRef.current++;
            if (restartCountRef.current > 5) {
                console.warn('Speech recognition: too many restarts without speech, stopping.');
                return;
            }

            // Save current interim as pending fragment before restart
            setInterimTranscript(prev => {
                if (prev && prev.trim()) {
                    pendingFragmentRef.current = prev.trim();
                }
                return prev;
            });

            // Delayed restart — 300ms so the browser fully releases the session
            restartTimerRef.current = setTimeout(() => {
                if (isRecognitionActiveRef.current) {
                    try {
                        const newRecog = new SpeechRecognition();
                        newRecog.continuous = true;
                        newRecog.interimResults = true;
                        newRecog.lang = language;
                        newRecog.maxAlternatives = 3;
                        newRecog.onresult = recognition.onresult;
                        newRecog.onspeechend = recognition.onspeechend;
                        newRecog.onerror = recognition.onerror;
                        newRecog.onend = recognition.onend;
                        newRecog.start();
                        recognitionRef.current = newRecog;
                    } catch (err) {
                        console.warn('Speech restart failed:', err);
                    }
                }
            }, 300);
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (err) {
            console.warn('Speech recognition start failed:', err);
        }
    }, [language]);

    const stopSpeechRecognition = useCallback(() => {
        isRecognitionActiveRef.current = false;
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (recognitionRef.current) {
            recognitionRef.current.onend = null; // prevent restart
            try { recognitionRef.current.stop(); } catch { }
            recognitionRef.current = null;
        }

        // Commit any remaining interim text
        if (pendingFragmentRef.current) {
            committedTranscriptRef.current += pendingFragmentRef.current + ' ';
            pendingFragmentRef.current = '';
            setTranscript(committedTranscriptRef.current);
        }

        setIsListening(false);
    }, []);

    // Restart recognition when language changes (preserves transcript)
    useEffect(() => {
        if (stage === 'active' && isRecognitionActiveRef.current) {
            // Save current state before restart
            const currentInterim = interimTranscript;
            if (currentInterim && currentInterim.trim()) {
                committedTranscriptRef.current += currentInterim.trim() + ' ';
                setTranscript(committedTranscriptRef.current);
            }
            stopSpeechRecognition();
            isRecognitionActiveRef.current = true; // re-enable since stopSpeech disables it
            setTimeout(() => startSpeechRecognition(), 300);
        }
    }, [language]);

    // ─── Audio Recording (Hybrid Mode) ───────────────────
    const startRecording = useCallback(() => {
        if (!streamRef.current) return;
        
        try {
            const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setCurrentAudioBlob(blob);
            };

            mediaRecorder.start();
            setAnswerMode('voice');
            startSpeechRecognition();
        } catch (err) {
            console.error('Error starting media recorder:', err);
            // Fallback to just speech recognition if MediaRecorder fails (e.g., Safari/iOS)
            setAnswerMode('voice');
            startSpeechRecognition();
        }
    }, [startSpeechRecognition]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        stopSpeechRecognition();
    }, [stopSpeechRecognition]);

    // ─── Smart Alert System (Detection-Driven) ─────────────
    const pushAlert = useCallback((alert) => {
        const now = Date.now();
        // Rate-limit: max 2 alerts per 15 seconds
        if (now - lastAlertTimeRef.current < 7000) return;
        // Category cooldown: same category max once per 30 seconds
        const lastCat = alertCooldownRef.current[alert.category] || 0;
        if (now - lastCat < 30000) return;
        // Don't repeat same category back-to-back
        if (lastAlertCategoryRef.current === alert.category) return;

        const id = ++alertIdRef.current;
        setAlerts(prev => [...prev.slice(-3), { ...alert, id }]);
        lastAlertTimeRef.current = now;
        lastAlertCategoryRef.current = alert.category;
        alertCooldownRef.current[alert.category] = now;
        setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== id));
        }, 4500);
    }, []);

    // ─── Canvas-Based Face Detection ─────────────────────
    const initFaceDetector = useCallback(() => {
        // Try using the FaceDetector API (Chrome 70+)
        if (typeof window.FaceDetector !== 'undefined') {
            try {
                faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            } catch { faceDetectorRef.current = null; }
        }
        // Create offscreen canvas for analysis
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 320;
            canvasRef.current.height = 240;
        }
    }, []);

    // Skin-tone detection fallback — find face region via color analysis
    const detectFaceViaCanvas = useCallback((ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        let minX = w, maxX = 0, minY = h, maxY = 0;
        let skinPixels = 0;

        // Sample every 4th pixel for speed
        for (let y = 0; y < h; y += 4) {
            for (let x = 0; x < w; x += 4) {
                const i = (y * w + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                // Skin tone detection using RGB heuristic
                if (r > 80 && g > 50 && b > 30 && r > g && r > b &&
                    (r - g) > 15 && Math.abs(r - g) < 130 && r - b > 20) {
                    skinPixels++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // Need at least 2% skin pixels to consider face detected
        const totalSampled = (w / 4) * (h / 4);
        if (skinPixels < totalSampled * 0.02 || skinPixels > totalSampled * 0.6) return null;

        const faceW = maxX - minX;
        const faceH = maxY - minY;
        // Face should be roughly taller than wide (or similar)
        if (faceW < 20 || faceH < 20 || faceW > w * 0.9 || faceH > h * 0.9) return null;

        return {
            x: minX, y: minY, width: faceW, height: faceH,
            centerX: minX + faceW / 2, centerY: minY + faceH / 2
        };
    }, []);

    // ─── Frame Analysis Loop ─────────────────────────────
    const analyzeFrame = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || !cameraOn) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const w = canvas.width, h = canvas.height;
        ctx.drawImage(video, 0, 0, w, h);

        let face = null;

        // Try FaceDetector API first
        if (faceDetectorRef.current) {
            try {
                const faces = await faceDetectorRef.current.detect(canvas);
                if (faces.length > 0) {
                    const f = faces[0].boundingBox;
                    face = {
                        x: f.x, y: f.y, width: f.width, height: f.height,
                        centerX: f.x + f.width / 2, centerY: f.y + f.height / 2,
                        landmarks: faces[0].landmarks || []
                    };
                }
            } catch { /* fallback below */ }
        }

        // Fallback: canvas skin-tone detection
        if (!face) {
            face = detectFaceViaCanvas(ctx, w, h);
        }

        if (!face) {
            setDetectionStatus(prev => ({ ...prev, faceDetected: false }));
            consecutiveLookAway.current++;
            // If no face detected for a while, it's bad eye contact
            if (consecutiveLookAway.current > 3) {
                eyeContactTotalCount.current++;
            }
            return;
        }

        setDetectionStatus(prev => ({ ...prev, faceDetected: true }));

        // ─── Eye Contact Analysis ────────────────────────
        const frameCenterX = w / 2;
        const frameCenterY = h / 2;
        // How far face center is from frame center (normalized 0-1)
        const deviationX = Math.abs(face.centerX - frameCenterX) / (w / 2);
        const deviationY = Math.abs(face.centerY - frameCenterY) / (h / 2);
        const totalDeviation = Math.sqrt(deviationX * deviationX + deviationY * deviationY);

        // Good eye contact: face within ~35% of center
        const isGoodEyeContact = totalDeviation < 0.5;

        eyeContactReadings.current.push(isGoodEyeContact);
        if (eyeContactReadings.current.length > 20) eyeContactReadings.current.shift();

        eyeContactTotalCount.current++;
        if (isGoodEyeContact) {
            eyeContactGoodCount.current++;
            consecutiveLookAway.current = 0;
        } else {
            consecutiveLookAway.current++;
        }

        setDetectionStatus(prev => ({ ...prev, eyeContact: isGoodEyeContact }));

        // Eye contact alert: 6+ consecutive bad readings = 3 seconds
        if (consecutiveLookAway.current >= 6) {
            pushAlert({ text: 'Please maintain eye contact with the camera', icon: '👁️', type: 'warn', category: 'eye' });
        }

        // ─── Posture Analysis ────────────────────────────
        const faceBox = { x: face.centerX / w, y: face.centerY / h, w: face.width / w, h: face.height / h };
        postureReadings.current.push(faceBox);
        if (postureReadings.current.length > 20) postureReadings.current.shift();

        // Set baseline from first 5 readings
        if (!postureBaselineRef.current && postureReadings.current.length >= 5) {
            const avg = postureReadings.current.reduce((acc, r) => ({
                x: acc.x + r.x, y: acc.y + r.y, w: acc.w + r.w, h: acc.h + r.h
            }), { x: 0, y: 0, w: 0, h: 0 });
            const n = postureReadings.current.length;
            postureBaselineRef.current = { x: avg.x / n, y: avg.y / n, w: avg.w / n, h: avg.h / n };
        }

        postureTotalCount.current++;
        let isGoodPosture = true;

        if (postureBaselineRef.current) {
            const baseline = postureBaselineRef.current;
            // Check horizontal centering deviation
            const xDev = Math.abs(faceBox.x - baseline.x);
            // Check vertical position change
            const yDev = Math.abs(faceBox.y - baseline.y);
            // Check face size change (leaning forward/back)
            const sizeDev = Math.abs(faceBox.w - baseline.w) / baseline.w;

            // Poor posture: significant deviation from baseline
            isGoodPosture = xDev < 0.18 && yDev < 0.18 && sizeDev < 0.4;
        }

        if (isGoodPosture) {
            postureGoodCount.current++;
            consecutiveBadPosture.current = 0;
        } else {
            consecutiveBadPosture.current++;
        }

        setDetectionStatus(prev => ({ ...prev, posture: isGoodPosture }));

        // Posture alert: 8+ consecutive bad readings = 4 seconds
        if (consecutiveBadPosture.current >= 8) {
            pushAlert({ text: 'Sit straight for better posture', icon: '🪑', type: 'warn', category: 'posture' });
        }

        // ─── Expression Analysis ──────────────────────────
        // Analyze brightness variance in face region as engagement proxy
        const faceRegion = ctx.getImageData(
            Math.max(0, Math.round(face.x)), Math.max(0, Math.round(face.y)),
            Math.min(Math.round(face.width), w - Math.round(face.x)),
            Math.min(Math.round(face.height), h - Math.round(face.y))
        );
        const faceData = faceRegion.data;
        let totalBrightness = 0;
        let pixelCount = 0;
        for (let i = 0; i < faceData.length; i += 16) { // sample every 4th pixel
            totalBrightness += (faceData[i] + faceData[i + 1] + faceData[i + 2]) / 3;
            pixelCount++;
        }
        const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 128;

        // Track engagement: well-lit face in a reasonable position = engaged
        const isEngaged = avgBrightness > 60 && avgBrightness < 220 && isGoodEyeContact;
        expressionReadings.current.push(isEngaged);
        if (expressionReadings.current.length > 20) expressionReadings.current.shift();

        expressionTotalCount.current++;
        if (isEngaged) expressionGoodCount.current++;

    }, [cameraOn, pushAlert, detectFaceViaCanvas]);

    // ─── Speech-Based Alerts (No Random) ─────────────────
    const analyzeSpeechAndAlert = useCallback(() => {
        const totalWords = totalWordsRef.current;
        const fillers = fillerCountRef.current;
        const pauses = pauseCountRef.current;
        const fillerRatio = totalWords > 0 ? fillers / totalWords : 0;
        const timeSinceLastSpeech = Date.now() - lastSpeechRef.current;

        // Priority 1: Long silence (>10s) = prompt to speak
        if (timeSinceLastSpeech > 10000) {
            pushAlert({ text: 'Try to answer the question — take your time but keep speaking', icon: '🎤', type: 'tip', category: 'silence' });
            return;
        }
        // Priority 2: Heavy fillers detected (only after meaningful speech)
        if (fillerRatio > 0.12 && totalWords > 15) {
            pushAlert({ text: 'Reduce filler words like "um" and "uh" — pause briefly instead', icon: '🗣️', type: 'warn', category: 'filler' });
            return;
        }
        // Priority 3: Many pauses
        if (pauses > 4) {
            pushAlert({ text: 'Try to maintain a steady speaking flow', icon: '💬', type: 'warn', category: 'pause' });
            return;
        }
        // Priority 4: Positive reinforcement when speech is flowing well (only after substantial speech)
        if (totalWords > 40 && fillerRatio < 0.04 && pauses <= 1) {
            pushAlert({ text: 'Great speech flow! Keep this momentum', icon: '🔥', type: 'good', category: 'good' });
        }
    }, [pushAlert]);

    // ─── Start Video Analysis + Behavior Monitoring ──────
    const startVideoAnalysis = useCallback(() => {
        initFaceDetector();
        // Reset all tracking
        eyeContactReadings.current = [];
        eyeContactGoodCount.current = 0;
        eyeContactTotalCount.current = 0;
        consecutiveLookAway.current = 0;
        postureReadings.current = [];
        postureBaselineRef.current = null;
        consecutiveBadPosture.current = 0;
        postureGoodCount.current = 0;
        postureTotalCount.current = 0;
        expressionReadings.current = [];
        expressionGoodCount.current = 0;
        expressionTotalCount.current = 0;
        alertCooldownRef.current = {};
        lastAlertTimeRef.current = Date.now() + 8000; // No alerts for first 8 seconds

        // Frame analysis every 500ms (2 fps is stable and low overhead)
        videoAnalysisRef.current = setInterval(() => {
            analyzeFrame();
        }, 500);

        // Speech-based alerts every 12 seconds (after initial 12s grace period)
        const speechCheck = () => {
            alertTimerRef.current = setTimeout(() => {
                analyzeSpeechAndAlert();
                speechCheck();
            }, 12000);
        };
        setTimeout(() => speechCheck(), 12000);
    }, [initFaceDetector, analyzeFrame, analyzeSpeechAndAlert]);

    // ─── Interview Flow ──────────────────────────────────
    const startInterview = async () => {
        if (!role) return;
        setStage('preview');
        await startCamera();
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/interviews/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, skills: [] })
        });
        const data = await res.json();
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(''));
    };

    const beginInterview = () => {
        setStage('active');
        setTimer(1800);
        setTranscript('');
        setInterimTranscript('');
        setSpeechComplete(false);
        
        // Reset answer modes
        setAnswerMode('select');
        setTextAnswer('');
        setCurrentAudioBlob(null);

        // Reset committed transcript buffer
        committedTranscriptRef.current = '';
        pendingFragmentRef.current = '';
        restartCountRef.current = 0;
        // Reset speech metrics
        speechStartRef.current = Date.now();
        lastSpeechRef.current = Date.now();
        pauseCountRef.current = 0;
        shortPauseCountRef.current = 0;
        fillerCountRef.current = 0;
        totalWordsRef.current = 0;
        finalResultCountRef.current = 0;
        totalResultCountRef.current = 0;
        wordsInLastWindowRef.current = [];
        lastAlertCategoryRef.current = '';
        
        // Removed startSpeechRecognition() since it starts only when user selects Voice
        startVideoAnalysis(); // Real video analysis + smart alerts
        timerRef.current = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const nextQuestion = () => {
        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        stopSpeechRecognition();

        let finalAnswerText = '';
        if (answerMode === 'text') {
            finalAnswerText = textAnswer;
        } else if (answerMode === 'voice') {
            // Capture the full answer: committed buffer + any remaining interim text
            finalAnswerText = committedTranscriptRef.current;
            if (interimTranscript && interimTranscript.trim()) {
                finalAnswerText += interimTranscript.trim() + ' ';
            }
            if (pendingFragmentRef.current) {
                finalAnswerText += pendingFragmentRef.current + ' ';
            }
        }

        const newAnswers = [...answers];
        newAnswers[currentQ] = {
            type: answerMode,
            text: finalAnswerText.trim() || '[No answer]',
            audioBlob: currentAudioBlob,
            metrics: answerMode === 'voice' ? {
                fillerCount: fillerCountRef.current,
                pauseCount: pauseCountRef.current,
                totalWords: totalWordsRef.current,
                clarity: totalResultCountRef.current > 0 ? Math.round((finalResultCountRef.current / totalResultCountRef.current) * 100) : 0
            } : null
        };
        setAnswers(newAnswers);

        // Reset for next question
        committedTranscriptRef.current = '';
        pendingFragmentRef.current = '';
        setTranscript('');
        setInterimTranscript('');
        setSpeechComplete(false);
        setAnswerMode('select');
        setTextAnswer('');
        setCurrentAudioBlob(null);

        // Reset speech metrics for next question if they choose voice
        totalWordsRef.current = 0;
        fillerCountRef.current = 0;
        pauseCountRef.current = 0;
        shortPauseCountRef.current = 0;
        finalResultCountRef.current = 0;
        totalResultCountRef.current = 0;
        wordsInLastWindowRef.current = [];

        if (currentQ < questions.length - 1) {
            setCurrentQ(currentQ + 1);
        } else {
            submitInterview(newAnswers);
        }
    };

    const submitInterview = async (finalAnswers) => {
        setStage('evaluating');
        clearInterval(timerRef.current);
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        if (videoAnalysisRef.current) clearInterval(videoAnalysisRef.current);
        stopSpeechRecognition();
        stopCamera();

        // Process finalAnswers: upload audio blobs if present
        const processedAnswers = await Promise.all(finalAnswers.map(async (ans) => {
            if (ans.type === 'voice' && ans.audioBlob) {
                const formData = new FormData();
                formData.append('audio', ans.audioBlob, `answer_${Date.now()}.webm`);
                try {
                    const uploadRes = await fetch((import.meta.env.VITE_API_URL || '') + '/api/upload-audio', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    return { ...ans, audioUrl: uploadData.file, audioBlob: undefined };
                } catch (err) {
                    console.error('Audio upload failed:', err);
                    return { ...ans, audioUrl: null, audioBlob: undefined };
                }
            }
            return { ...ans, audioBlob: undefined };
        }));

        // Compute speech metrics to send to backend
        const elapsed = (Date.now() - (speechStartRef.current || Date.now())) / 1000 / 60; // minutes

        // Compute real behavioral scores from video analysis
        const eyeScore = eyeContactTotalCount.current > 0
            ? Math.round((eyeContactGoodCount.current / eyeContactTotalCount.current) * 100)
            : null;
        const postureScoreVal = postureTotalCount.current > 0
            ? Math.round((postureGoodCount.current / postureTotalCount.current) * 100)
            : null;
        const expressionScoreVal = expressionTotalCount.current > 0
            ? Math.round((expressionGoodCount.current / expressionTotalCount.current) * 100)
            : null;

        const speechMetrics = {
            fillerCount: fillerCountRef.current,
            pauseCount: pauseCountRef.current,
            totalWords: totalWordsRef.current,
            wordsPerMin: elapsed > 0 ? Math.round(totalWordsRef.current / elapsed) : 0,
            // Real behavioral scores from video analysis
            eyeContactScore: eyeScore,
            postureScore: postureScoreVal,
            expressionScore: expressionScoreVal,
        };

        try {
            const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/interviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, type: 'mock', role, questions, answers: processedAnswers, speechMetrics })
            });
            const data = await res.json();
            setResult(data);
            setStage('complete');
        } catch {
            setStage('complete');
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const timerClass = timer <= 10 ? 'danger' : timer <= 30 ? 'warning' : '';
    const scoreColor = (s) => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

    // ═════════════════════════════════════════════════════
    // RENDER: Setup
    // ═════════════════════════════════════════════════════
    if (stage === 'setup') {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">AI Mock Interview</h1>
                    <p className="page-description">Practice with AI-generated questions. Your webcam, speech, and answers are analyzed in real time.</p>
                </div>
                <div className="card interview-setup animate-in">
                    <h3 className="card-title" style={{ marginBottom: 8 }}>Select Interview Role</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                        The AI interviewer will ask role-specific questions. You can answer by speaking — English and Hindi supported.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                        {roles.map(r => (
                            <div key={r} className={`role-option ${role === r ? 'selected' : ''}`}
                                onClick={() => setRole(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                                <Video size={20} style={{ color: role === r ? 'var(--accent-purple)' : 'var(--text-muted)' }} />
                                <span className="role-option-label">{r}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: 14, background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--accent-blue)' }}>🎤 Voice-Powered Interview:</strong> Speak your answers naturally. The AI will convert your speech to text and evaluate your responses on confidence, clarity, relevance, and completeness.
                    </div>
                    <button className="btn btn-primary btn-full btn-lg" onClick={startInterview} disabled={!role}>
                        <Play size={18} /> Start Interview
                    </button>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════
    // RENDER: Camera Preview
    // ═════════════════════════════════════════════════════
    if (stage === 'preview') {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">Camera Preview</h1>
                    <p className="page-description">Ensure camera and microphone work. The AI interviewer will ask {questions.length} questions.</p>
                </div>
                <div className="card animate-in" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
                    <div className="iv2-webcam-area" style={{ marginBottom: 20, minHeight: 320 }}>
                        {cameraError ? (
                            <div className="iv2-cam-error">
                                <CameraOff size={56} />
                                <p><strong>Please enable your camera to continue the interview.</strong><br />Check browser permissions and try again.</p>
                                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={startCamera}>Retry Camera</button>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay muted playsInline />
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                        <button className={`iv2-ctrl-btn ${cameraOn ? 'on' : 'off'}`} onClick={() => {
                            const track = streamRef.current?.getVideoTracks()[0];
                            if (track) { track.enabled = !track.enabled; setCameraOn(track.enabled); }
                        }}>
                            {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
                        </button>
                        <button className={`iv2-ctrl-btn ${micOn ? 'on' : 'off'}`} onClick={() => {
                            const track = streamRef.current?.getAudioTracks()[0];
                            if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
                        }}>
                            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                        <strong style={{ color: 'var(--accent-purple)' }}>{questions.length} questions</strong> for <strong>{role}</strong> • English & Hindi supported
                    </p>
                    <button className="btn btn-primary btn-lg btn-full" onClick={beginInterview} disabled={cameraError}>
                        <Play size={18} /> Begin Interview
                    </button>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════
    // RENDER: Active Interview (V2 Layout)
    // ═════════════════════════════════════════════════════
    if (stage === 'active') {
        return (
            <>
                {/* Behavior Alerts */}
                <div className="iv2-alerts-container">
                    {alerts.map(a => (
                        <div key={a.id} className={`iv2-alert ${a.type}`} style={{ '--alert-duration': '3.5s' }}>
                            <span className="iv2-alert-icon" style={{ fontSize: 18 }}>{a.icon}</span>
                            <span className="iv2-alert-text">{a.text}</span>
                        </div>
                    ))}
                </div>

                <div className="iv2-layout">
                    {/* LEFT: Webcam */}
                    <div className="iv2-webcam-area">
                        {cameraError ? (
                            <div className="iv2-cam-error">
                                <CameraOff size={56} />
                                <p><strong>Please enable your camera to continue the interview.</strong></p>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay muted playsInline />
                        )}
                        <div className="iv2-rec-badge">
                            <div className="iv2-rec-dot" />
                            <span className="iv2-rec-text">REC</span>
                        </div>
                        {/* Real-time detection indicators */}
                        <div className="iv2-detection-status">
                            <span className={`iv2-detect-dot ${detectionStatus.faceDetected ? 'active' : 'inactive'}`}
                                title={detectionStatus.faceDetected ? 'Face detected' : 'No face detected'}>
                                {detectionStatus.faceDetected ? '😊' : '❌'}
                            </span>
                            {detectionStatus.eyeContact !== null && (
                                <span className={`iv2-detect-dot ${detectionStatus.eyeContact ? 'good' : 'bad'}`}
                                    title={detectionStatus.eyeContact ? 'Good eye contact' : 'Look at camera'}>
                                    👁️
                                </span>
                            )}
                            {detectionStatus.posture !== null && (
                                <span className={`iv2-detect-dot ${detectionStatus.posture ? 'good' : 'bad'}`}
                                    title={detectionStatus.posture ? 'Good posture' : 'Adjust posture'}>
                                    🪑
                                </span>
                            )}
                        </div>
                        <div className="iv2-controls">
                            <button className={`iv2-ctrl-btn ${cameraOn ? 'on' : 'off'}`} onClick={() => {
                                const t = streamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCameraOn(t.enabled); }
                            }}>
                                {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
                            </button>
                            <button className={`iv2-ctrl-btn ${micOn ? 'on' : 'off'}`} onClick={() => {
                                const t = streamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
                            }}>
                                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Question + Transcript */}
                    <div className="iv2-question-area">
                        <div className="iv2-q-header">
                            <span className="iv2-q-badge">Question {currentQ + 1} of {questions.length}</span>
                            <div className="iv2-lang-toggle">
                                <button className={`iv2-lang-btn ${language === 'en-IN' ? 'active' : ''}`} onClick={() => setLanguage('en-IN')}>EN</button>
                                <button className={`iv2-lang-btn ${language === 'hi-IN' ? 'active' : ''}`} onClick={() => setLanguage('hi-IN')}>हिं</button>
                            </div>
                        </div>

                        <div className="progress-bar" style={{ height: 4 }}>
                            <div className="progress-bar-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                        </div>

                        <div className="iv2-q-text">{questions[currentQ]}</div>

                        {/* Answer Input Area */}
                        {answerMode === 'select' && (
                            <div className="iv2-answer-select">
                                <h3 style={{ marginBottom: 16 }}>Choose Answer Method</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button className="btn btn-primary btn-lg" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={startRecording}>
                                        <Mic size={20} /> Record Voice Answer
                                    </button>
                                    <button className="btn btn-secondary btn-lg" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setAnswerMode('text')}>
                                        <Keyboard size={20} /> Type Your Answer
                                    </button>
                                </div>
                            </div>
                        )}

                        {answerMode === 'text' && (
                            <div className="iv2-text-answer-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <textarea
                                    className="iv2-textarea"
                                    placeholder="Type your answer here..."
                                    value={textAnswer}
                                    onChange={(e) => setTextAnswer(e.target.value)}
                                    style={{ flex: 1, padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: 16, resize: 'none' }}
                                />
                            </div>
                        )}

                        {answerMode === 'voice' && (
                            <div className="iv2-transcript-area">
                                <div className="iv2-transcript-label" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div className={`iv2-speech-dot ${isListening ? '' : 'idle'}`} />
                                    {isListening ? 'Recording…' : speechComplete ? 'Speech complete ✓' : 'Stopped'}
                                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                                        {language === 'hi-IN' ? 'हिंदी' : 'English'}
                                    </span>
                                </div>
                                <div className={`iv2-transcript-text ${isListening ? 'listening' : ''}`}>
                                    {transcript || interimTranscript ? (
                                        <>{transcript}<span style={{ color: 'var(--accent-purple)', fontStyle: 'italic' }}>{interimTranscript}</span></>
                                    ) : (
                                        <span className="iv2-transcript-placeholder">Speak your answer… the AI is listening</span>
                                    )}
                                </div>
                                {/* Live speech analytics */}
                                {totalWordsRef.current > 0 && (
                                    <div className="iv2-speech-stats">
                                        <span>📝 {totalWordsRef.current} words</span>
                                        <span>⚡ {(() => {
                                            const now = Date.now();
                                            const recentWords = wordsInLastWindowRef.current.filter(e => now - e.t < 10000);
                                            const windowWords = recentWords.reduce((s, e) => s + e.count, 0);
                                            return recentWords.length > 0 ? Math.round(windowWords * 6) : 0; // words in 10s → WPM
                                        })()} WPM</span>
                                        <span>🎯 {totalResultCountRef.current > 0 ? Math.round((finalResultCountRef.current / totalResultCountRef.current) * 100) : 0}% clarity</span>
                                        {speechComplete && <span style={{ color: 'var(--accent-green)' }}>✅ Ready</span>}
                                    </div>
                                )}
                                {isListening && (
                                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-red)' }} onClick={stopRecording}>
                                        <Square size={14} fill="currentColor" /> Stop Recording
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="iv2-q-actions">
                            <button className="btn btn-primary btn-full" onClick={nextQuestion}>
                                {currentQ < questions.length - 1 ? (
                                    <><ChevronRight size={18} /> Next Question</>
                                ) : (
                                    <><Send size={18} /> Submit Interview</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* BOTTOM: Timer + Status + Detection */}
                    <div className="iv2-bottom-bar">
                        <div className={`iv2-timer ${timerClass}`}>
                            <Clock size={22} />
                            {formatTime(timer)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className={`iv2-speech-dot ${isListening ? '' : 'idle'}`} style={{ width: 8, height: 8 }} />
                                {isListening ? 'Recognizing speech…' : 'Mic active'}
                            </span>
                            <span>•</span>
                            <span>{role} Interview</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span className="badge badge-reviewed" style={{ fontSize: 11 }}>Q{currentQ + 1}/{questions.length}</span>
                            {eyeContactTotalCount.current > 0 && (
                                <span style={{ fontSize: 11, color: detectionStatus.eyeContact ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                                    👁️ {eyeContactTotalCount.current > 0 ? Math.round((eyeContactGoodCount.current / eyeContactTotalCount.current) * 100) : 0}%
                                </span>
                            )}
                            {postureTotalCount.current > 0 && (
                                <span style={{ fontSize: 11, color: detectionStatus.posture ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                                    🪑 {postureTotalCount.current > 0 ? Math.round((postureGoodCount.current / postureTotalCount.current) * 100) : 0}%
                                </span>
                            )}
                            {fillerCountRef.current > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--accent-orange)' }}>Fillers: {fillerCountRef.current}</span>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ═════════════════════════════════════════════════════
    // RENDER: Evaluating
    // ═════════════════════════════════════════════════════
    if (stage === 'evaluating') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
                    <Loader2 size={48} style={{ color: 'var(--accent-purple)', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                    <h3 className="card-title" style={{ marginBottom: 8 }}>Evaluating Your Performance</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                        Analyzing your speech, body language, answer quality, and confidence level…
                    </p>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════
    // RENDER: Complete (Enhanced Report)
    // ═════════════════════════════════════════════════════
    if (stage === 'complete' && result) {
        const allScores = [
            { label: 'Eye Contact', value: result.eye_contact_score, icon: <Eye size={16} /> },
            { label: 'Facial Expression', value: result.body_language_score, icon: <Smile size={16} /> },
            { label: 'Speech Clarity', value: result.speech_score, icon: <Volume2 size={16} /> },
            { label: 'Body Posture', value: result.posture_score, icon: <PersonStanding size={16} /> },
            { label: 'Answer Relevance', value: result.answer_relevance_score, icon: <Target size={16} /> },
            { label: 'Confidence', value: result.confidence_score, icon: <AlertTriangle size={16} /> },
            { label: 'Communication', value: result.communication_score, icon: <Languages size={16} /> },
            { label: 'Technical Quality', value: result.technical_score, icon: <CheckCircle size={16} /> },
        ];

        const weakAreas = allScores.filter(s => s.value < 70).map(s => s.label);
        const circumference = 2 * Math.PI * 60;

        const improvementTips = [];
        if (result.eye_contact_score < 70) improvementTips.push({ icon: '👁️', text: 'Practice looking directly at your camera lens instead of the screen. Place a sticky note near your camera as a reminder.' });
        if (result.speech_score < 70) improvementTips.push({ icon: '🗣️', text: 'Record yourself answering questions and play it back. Focus on speaking at a moderate pace with clear pronunciation.' });
        if (result.posture_score < 70) improvementTips.push({ icon: '🪑', text: 'Sit with your back straight and shoulders relaxed. Ensure your chair and desk height are ergonomically set.' });
        if (result.confidence_score < 70) improvementTips.push({ icon: '💪', text: 'Practice mock interviews regularly. Prepare structured answers using the STAR method to build confidence.' });
        if (result.answer_relevance_score < 70) improvementTips.push({ icon: '🎯', text: 'Listen carefully to each question and take 5 seconds to organize your thoughts before speaking. Stay focused on the core question.' });
        if (result.technical_score < 70) improvementTips.push({ icon: '📚', text: 'Review core technical concepts in your domain. Practice explaining technical topics in simple terms.' });
        if (result.communication_score < 70) improvementTips.push({ icon: '💬', text: 'Structure your answers with an introduction, main points, and conclusion. Avoid filler words like "um" and "uh".' });
        if (improvementTips.length === 0) improvementTips.push({ icon: '🌟', text: 'Outstanding performance! Keep maintaining this level of preparation and confidence.' });

        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">Interview Report 📊</h1>
                    <p className="page-description">Detailed AI analysis of your performance across all evaluation criteria.</p>
                </div>

                {/* Hero Section */}
                <div className="iv2-result-hero animate-in">
                    <div className="score-gauge" style={{ width: 140, height: 140 }}>
                        <svg viewBox="0 0 140 140">
                            <circle className="score-gauge-bg" cx="70" cy="70" r="60" />
                            <circle className="score-gauge-fill" cx="70" cy="70" r="60"
                                stroke={scoreColor(result.overall_score)} strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - result.overall_score / 100)} />
                        </svg>
                        <div className="score-gauge-value">
                            <div className="score-gauge-number" style={{ fontSize: 28 }}>{result.overall_score.toFixed(1)}</div>
                            <div className="score-gauge-label">Overall</div>
                        </div>
                    </div>
                    <div className="iv2-result-meta">
                        <h2>{result.overall_score >= 85 ? 'Outstanding Performance! 🏆' : result.overall_score >= 70 ? 'Good Job! 👏' : 'Keep Practicing! 💪'}</h2>
                        <p>
                            {result.overall_score >= 85 ? 'You demonstrated excellent interview skills across all criteria. You are well prepared.' :
                                result.overall_score >= 70 ? 'Solid performance with some areas for improvement. Focused practice will help you excel.' :
                                    'You have potential — consistent practice will significantly boost your scores. Focus on the weak areas below.'}
                        </p>
                        {weakAreas.length > 0 && (
                            <div className="iv2-weak-areas">
                                {weakAreas.map(w => <span key={w} className="iv2-weak-tag">⚠ {w}</span>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                    {/* Score Breakdown */}
                    <div className="card animate-in">
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Score Breakdown</h3>
                        {allScores.map(s => (
                            <div key={s.label} style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: scoreColor(s.value) }}>{s.icon}</span> {s.label}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(s.value) }}>{s.value}</span>
                                </div>
                                <div className="progress-bar" style={{ height: 6 }}>
                                    <div className="progress-bar-fill" style={{ width: `${s.value}%`, background: scoreColor(s.value) }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Improvement Tips */}
                    <div className="card animate-in">
                        <h3 className="card-title" style={{ marginBottom: 16 }}>Personalized Improvement Tips</h3>
                        {improvementTips.map((tip, i) => (
                            <div key={i} className="iv2-improvement-card">
                                <span style={{ fontSize: 20 }}>{tip.icon}</span>
                                <span>{tip.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Feedback */}
                {(result.feedback?.strengths?.length > 0 || result.feedback?.improvements?.length > 0) && (
                    <div className="card animate-in" style={{ marginBottom: 24 }}>
                        <h3 className="card-title" style={{ marginBottom: 16 }}>AI Feedback Summary</h3>
                        <div className="grid-2">
                            <div>
                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 10 }}>💪 Strengths</h4>
                                {result.feedback.strengths?.map((s, i) => (
                                    <div key={i} className="iv2-improvement-card" style={{ borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.03)' }}>
                                        <CheckCircle size={16} style={{ color: 'var(--accent-green)' }} />
                                        <span>{s}</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 10 }}>🎯 Areas to Improve</h4>
                                {result.feedback.improvements?.map((s, i) => (
                                    <div key={i} className="iv2-improvement-card" style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.03)' }}>
                                        <Target size={16} style={{ color: 'var(--accent-orange)' }} />
                                        <span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={() => {
                        setStage('setup'); setRole(''); setQuestions([]); setCurrentQ(0); setAnswers([]);
                        setResult(null); setTranscript(''); setInterimTranscript(''); setAlerts([]);
                    }}>
                        <Play size={16} /> Practice Again
                    </button>
                    <button className="btn btn-secondary" onClick={() => navigate('/student/reports')}>
                        View All Reports <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
