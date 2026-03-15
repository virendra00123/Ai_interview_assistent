import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Radar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip,
    CategoryScale, LinearScale
} from 'chart.js';
import {
    BarChart3, Calendar, Trophy, Target, Eye, Smile, Volume2,
    PersonStanding, AlertTriangle, Languages, CheckCircle, TrendingUp
} from 'lucide-react';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, CategoryScale, LinearScale);

export default function InterviewReport() {
    const { user } = useAuth();
    const [interviews, setInterviews] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/students/${user.id}/interviews`)
            .then(r => r.json())
            .then(d => { setInterviews(d); if (d.length > 0) setSelected(d[0]); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const sc = s => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

    const allScoreKeys = [
        { key: 'eye_contact_score', label: 'Eye Contact', icon: <Eye size={14} /> },
        { key: 'body_language_score', label: 'Facial Expression', icon: <Smile size={14} /> },
        { key: 'speech_score', label: 'Speech Clarity', icon: <Volume2 size={14} /> },
        { key: 'posture_score', label: 'Body Posture', icon: <PersonStanding size={14} /> },
        { key: 'answer_relevance_score', label: 'Answer Relevance', icon: <Target size={14} /> },
        { key: 'confidence_score', label: 'Confidence', icon: <AlertTriangle size={14} /> },
        { key: 'communication_score', label: 'Communication', icon: <Languages size={14} /> },
        { key: 'technical_score', label: 'Technical Quality', icon: <CheckCircle size={14} /> },
    ];

    const makeRadar = (sel) => ({
        labels: allScoreKeys.map(k => k.label),
        datasets: [{
            label: 'Score',
            data: allScoreKeys.map(k => sel[k.key]),
            backgroundColor: 'rgba(139,92,246,0.12)',
            borderColor: '#8b5cf6',
            borderWidth: 2,
            pointBackgroundColor: '#8b5cf6',
            pointRadius: 4,
        }]
    });

    const radarOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            r: {
                angleLines: { color: 'rgba(255,255,255,0.05)' },
                grid: { color: 'rgba(255,255,255,0.08)' },
                pointLabels: { color: '#94a3b8', font: { size: 10 } },
                ticks: { display: false },
                min: 0, max: 100
            }
        }
    };

    // Performance trend (line chart across interviews)
    const trendData = {
        labels: interviews.slice().reverse().map((_, i) => `#${i + 1}`),
        datasets: [{
            label: 'Overall Score',
            data: interviews.slice().reverse().map(i => i.overall_score),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: '#8b5cf6',
        }]
    };

    const trendOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } } },
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } } },
        }
    };

    const getImprovementTips = (sel) => {
        const tips = [];
        if (sel.eye_contact_score < 70) tips.push({ icon: '👁️', text: 'Practice looking at the camera lens. Place a sticker near your camera as a reminder.' });
        if (sel.speech_score < 70) tips.push({ icon: '🗣️', text: 'Slow down your speech. Record yourself and listen back for clarity improvements.' });
        if (sel.posture_score < 70) tips.push({ icon: '🪑', text: 'Sit upright with relaxed shoulders. Adjust your chair height for ergonomic comfort.' });
        if (sel.confidence_score < 70) tips.push({ icon: '💪', text: 'Use the STAR method to structure answers. Practice out loud to build confidence.' });
        if (sel.answer_relevance_score < 70) tips.push({ icon: '🎯', text: 'Take 5 seconds to think before answering. Focus on directly addressing the question.' });
        if (sel.technical_score < 70) tips.push({ icon: '📚', text: 'Review key concepts in your domain. Practice explaining technical topics simply.' });
        if (sel.communication_score < 70) tips.push({ icon: '💬', text: 'Avoid filler words. Structure answers with intro, body, and conclusion.' });
        if (tips.length === 0) tips.push({ icon: '🌟', text: 'Excellent work! Maintain this performance level.' });
        return tips;
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Interview Reports</h1>
                <p className="page-description">Track your progress, review detailed scores, and get personalized feedback.</p>
            </div>

            {interviews.length === 0 ? (
                <div className="card"><div className="empty-state"><BarChart3 size={64} /><h3>No Interviews Yet</h3><p>Complete a mock interview to see reports.</p></div></div>
            ) : (
                <>
                    {/* Performance Trend Chart */}
                    {interviews.length > 1 && (
                        <div className="card animate-in" style={{ marginBottom: 24 }}>
                            <div className="card-header">
                                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={18} style={{ color: 'var(--accent-purple)' }} /> Performance Trend
                                </h3>
                            </div>
                            <div className="chart-container" style={{ height: 200 }}>
                                <Line data={trendData} options={trendOpts} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
                        {/* History List */}
                        <div className="card" style={{ padding: 0, height: 'fit-content' }}>
                            <div style={{ padding: '16px 16px 8px' }}><h3 className="card-title" style={{ fontSize: 15 }}>History</h3></div>
                            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                                {interviews.map(i => (
                                    <div key={i.interview_id} onClick={() => setSelected(i)} style={{
                                        padding: '12px 16px', cursor: 'pointer',
                                        borderLeft: selected?.interview_id === i.interview_id ? '3px solid var(--accent-purple)' : '3px solid transparent',
                                        background: selected?.interview_id === i.interview_id ? 'rgba(139,92,246,0.06)' : 'transparent',
                                        transition: 'all 0.15s ease',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{i.interview_type === 'mock' ? 'Mock' : 'Screening'}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: sc(i.overall_score) }}>{i.overall_score.toFixed(1)}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Calendar size={10} /> {new Date(i.recorded_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detail View */}
                        {selected && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Hero */}
                                <div className="iv2-result-hero animate-in">
                                    <div className="score-gauge" style={{ width: 130, height: 130, flexShrink: 0 }}>
                                        <svg viewBox="0 0 140 140">
                                            <circle className="score-gauge-bg" cx="70" cy="70" r="60" />
                                            <circle className="score-gauge-fill" cx="70" cy="70" r="60"
                                                stroke={sc(selected.overall_score)}
                                                strokeDasharray={2 * Math.PI * 60}
                                                strokeDashoffset={2 * Math.PI * 60 * (1 - selected.overall_score / 100)} />
                                        </svg>
                                        <div className="score-gauge-value">
                                            <div className="score-gauge-number" style={{ fontSize: 26 }}>{selected.overall_score.toFixed(1)}</div>
                                            <div className="score-gauge-label">Overall</div>
                                        </div>
                                    </div>
                                    <div className="iv2-result-meta">
                                        <h2>{selected.overall_score >= 85 ? '🏆 Outstanding!' : selected.overall_score >= 70 ? '👏 Good Job!' : '💪 Keep Practicing!'}</h2>
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {new Date(selected.recorded_at).toLocaleString()}
                                        </p>
                                        {(() => {
                                            const weak = allScoreKeys.filter(k => selected[k.key] < 70).map(k => k.label);
                                            return weak.length > 0 ? (
                                                <div className="iv2-weak-areas">
                                                    {weak.map(w => <span key={w} className="iv2-weak-tag">⚠ {w}</span>)}
                                                </div>
                                            ) : (
                                                <div className="iv2-weak-areas">
                                                    <span className="badge badge-accepted">All criteria above 70 ✓</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="grid-2">
                                    {/* Radar */}
                                    <div className="card animate-in">
                                        <h3 className="card-title" style={{ marginBottom: 16, fontSize: 15 }}>Performance Radar</h3>
                                        <div className="chart-container" style={{ height: 240 }}>
                                            <Radar data={makeRadar(selected)} options={radarOpts} />
                                        </div>
                                    </div>

                                    {/* Score bars */}
                                    <div className="card animate-in">
                                        <h3 className="card-title" style={{ marginBottom: 16, fontSize: 15 }}>Score Breakdown</h3>
                                        {allScoreKeys.map(k => (
                                            <div key={k.key} style={{ marginBottom: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ color: sc(selected[k.key]) }}>{k.icon}</span> {k.label}
                                                    </span>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: sc(selected[k.key]) }}>{selected[k.key]}</span>
                                                </div>
                                                <div className="progress-bar" style={{ height: 5 }}>
                                                    <div className="progress-bar-fill" style={{ width: `${selected[k.key]}%`, background: sc(selected[k.key]) }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Improvement Tips */}
                                <div className="card animate-in">
                                    <h3 className="card-title" style={{ marginBottom: 16, fontSize: 15 }}>💡 Personalized Improvement Tips</h3>
                                    {getImprovementTips(selected).map((tip, i) => (
                                        <div key={i} className="iv2-improvement-card">
                                            <span style={{ fontSize: 18 }}>{tip.icon}</span>
                                            <span>{tip.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Feedback */}
                                {(selected.feedback?.strengths?.length > 0 || selected.feedback?.improvements?.length > 0) && (
                                    <div className="card animate-in">
                                        <h3 className="card-title" style={{ marginBottom: 16, fontSize: 15 }}>AI Feedback</h3>
                                        <div className="grid-2">
                                            <div>
                                                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Strengths</h4>
                                                {selected.feedback.strengths?.map((s, i) => (
                                                    <div key={i} className="iv2-improvement-card" style={{ borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.03)' }}>
                                                        <Trophy size={14} style={{ color: 'var(--accent-green)' }} />
                                                        <span>{s}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Areas to Improve</h4>
                                                {selected.feedback.improvements?.map((s, i) => (
                                                    <div key={i} className="iv2-improvement-card" style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.03)' }}>
                                                        <Target size={14} style={{ color: 'var(--accent-orange)' }} />
                                                        <span>{s}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
