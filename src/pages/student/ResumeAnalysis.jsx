import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { FileText, TrendingUp, AlertTriangle, CheckCircle, Upload, Target } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ResumeAnalysis() {
    const { user } = useAuth();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const fetchAnalysis = () => {
        fetch((import.meta.env.VITE_API_URL || '') + '/api/students/${user.id}/resume-analysis`)
            .then(r => r.json())
            .then(d => { setAnalysis(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchAnalysis(); }, [user.id]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('resume', file);
        try {
            const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/students/${user.id}/resume`, { method: 'POST', body: formData });
            const data = await res.json();
            setAnalysis(data);
        } catch (err) {
            console.error(err);
        }
        setUploading(false);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const scoreColor = (s) => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';
    const circumference = 2 * Math.PI * 60;

    const sectionData = analysis?.sections ? {
        labels: ['Formatting', 'Skills Coverage', 'Experience', 'Education', 'Projects'],
        datasets: [{
            data: [analysis.sections.formatting, analysis.sections.skills_coverage, analysis.sections.experience, analysis.sections.education, analysis.sections.projects],
            backgroundColor: ['rgba(139,92,246,0.6)', 'rgba(59,130,246,0.6)', 'rgba(20,184,166,0.6)', 'rgba(245,158,11,0.6)', 'rgba(236,72,153,0.6)'],
            borderColor: ['#8b5cf6', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899'],
            borderWidth: 1,
            borderRadius: 6,
        }]
    } : null;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">Resume Analysis</h1>
                    <p className="page-description">AI-powered evaluation of your resume with actionable improvement suggestions.</p>
                </div>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                    <Upload size={16} /> {uploading ? 'Analyzing...' : 'Upload Resume'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} hidden />
                </label>
            </div>

            {!analysis?.score ? (
                <div className="card">
                    <div className="empty-state">
                        <FileText size={64} />
                        <h3>No Resume Uploaded</h3>
                        <p>Upload your resume to get an AI-powered analysis with score and improvement suggestions.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="stats-grid">
                        <div className="stat-card animate-in" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div className="score-gauge" style={{ width: 120, height: 120, flexShrink: 0 }}>
                                <svg viewBox="0 0 140 140">
                                    <circle className="score-gauge-bg" cx="70" cy="70" r="60" />
                                    <circle className="score-gauge-fill" cx="70" cy="70" r="60"
                                        stroke={scoreColor(analysis.score)}
                                        strokeDasharray={circumference}
                                        strokeDashoffset={circumference * (1 - analysis.score / 100)} />
                                </svg>
                                <div className="score-gauge-value">
                                    <div className="score-gauge-number" style={{ fontSize: 28 }}>{analysis.score}</div>
                                    <div className="score-gauge-label">Score</div>
                                </div>
                            </div>
                            <div>
                                <div className="stat-card-label" style={{ marginBottom: 4 }}>Overall Resume Score</div>
                                <div style={{ fontSize: 14, color: scoreColor(analysis.score), fontWeight: 600 }}>
                                    {analysis.score >= 80 ? 'Excellent' : analysis.score >= 60 ? 'Good - Room to improve' : 'Needs improvement'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid-2" style={{ marginBottom: 24 }}>
                        <div className="card animate-in">
                            <div className="card-header">
                                <h3 className="card-title">Section Scores</h3>
                            </div>
                            {sectionData && (
                                <div className="chart-container" style={{ height: 250 }}>
                                    <Bar data={sectionData} options={{
                                        responsive: true, maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' }, min: 0, max: 100 }
                                        }
                                    }} />
                                </div>
                            )}
                        </div>

                        <div className="card animate-in">
                            <div className="card-header">
                                <h3 className="card-title"><CheckCircle size={18} style={{ display: 'inline', verticalAlign: 'middle', color: 'var(--accent-green)' }} /> Improvement Suggestions</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {analysis.suggestions?.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                        <Target size={16} style={{ color: 'var(--accent-purple)', flexShrink: 0, marginTop: 2 }} />
                                        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {analysis.skill_gaps?.length > 0 && (
                        <div className="card animate-in">
                            <div className="card-header">
                                <h3 className="card-title"><AlertTriangle size={18} style={{ display: 'inline', verticalAlign: 'middle', color: 'var(--accent-orange)' }} /> Skill Gaps</h3>
                                <p className="card-subtitle" style={{ marginTop: 0 }}>Consider learning these skills to improve your marketability</p>
                            </div>
                            <div className="skills-list">
                                {analysis.skill_gaps.map(s => (
                                    <span key={s} className="skill-tag gap">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
