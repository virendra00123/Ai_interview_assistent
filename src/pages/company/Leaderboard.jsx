import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Medal, Award } from 'lucide-react';

export default function Leaderboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch((import.meta.env.VITE_API_URL || '') + '/api/dashboard/company/${user.id}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const leaderboard = data?.leaderboard || [];
    const scoreColor = s => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Candidate Leaderboard</h1>
                <p className="page-description">Top performing candidates ranked by interview scores and skill match.</p>
            </div>

            {leaderboard.length === 0 ? (
                <div className="card"><div className="empty-state"><Trophy size={64} /><h3>No rankings yet</h3><p>Candidates will appear here once they've been evaluated.</p></div></div>
            ) : (
                <>
                    {/* Top 3 Podium */}
                    {leaderboard.length >= 3 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
                            {[leaderboard[1], leaderboard[0], leaderboard[2]].map((c, i) => {
                                const rank = [2, 1, 3][i];
                                const icons = [Medal, Trophy, Award];
                                const Icon = icons[i];
                                const colors = ['#94a3b8', '#f59e0b', '#ec4899'];
                                const heights = ['180px', '220px', '160px'];
                                return (
                                    <div key={`${c.student_id}-${c.job_id}`} className="card animate-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: heights[i] }}>
                                        <Icon size={32} style={{ color: colors[i], margin: '0 auto 12px' }} />
                                        <div style={{ fontSize: 14, fontWeight: 600, color: colors[i], marginBottom: 4 }}>#{rank}</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{c.job_title}</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(c.avg_score || 0) }}>
                                            {c.avg_score?.toFixed(1) || '—'}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Interview Score</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="card animate-in">
                        <div className="card-header"><h3 className="card-title">Full Rankings</h3></div>
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Rank</th><th>Candidate</th><th>Applied For</th><th>College</th><th>Resume</th><th>Interview Avg</th><th>Skill Match</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map(c => (
                                        <tr key={`${c.student_id}-${c.job_id}`}>
                                            <td>
                                                <div className={`leaderboard-rank ${c.rank === 1 ? 'gold' : c.rank === 2 ? 'silver' : c.rank === 3 ? 'bronze' : 'default'}`}>
                                                    {c.rank}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{c.job_title}</td>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.college}</td>
                                            <td><span style={{ fontWeight: 600, color: scoreColor(c.resume_score) }}>{c.resume_score}</span></td>
                                            <td><span style={{ fontWeight: 600, color: scoreColor(c.avg_score || 0) }}>{c.avg_score?.toFixed(1) || '—'}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div className="progress-bar" style={{ width: 50, height: 6 }}>
                                                        <div className="progress-bar-fill" style={{ width: `${c.skill_match_pct || 0}%`, background: scoreColor(c.skill_match_pct || 0) }} />
                                                    </div>
                                                    <span style={{ fontSize: 12 }}>{c.skill_match_pct || 0}%</span>
                                                </div>
                                            </td>
                                            <td><span className={`badge badge-${c.application_status}`}>{c.application_status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
