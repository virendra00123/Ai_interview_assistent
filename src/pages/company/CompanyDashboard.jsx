import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Users, Briefcase, CheckCircle, XCircle, Trophy, TrendingUp } from 'lucide-react';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function CompanyDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/dashboard/company/${user.id}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Unable to load dashboard</h3></div>;

    const statusData = {
        labels: ['Pending', 'Shortlisted', 'Accepted', 'Rejected'],
        datasets: [{
            data: [data.status_breakdown.pending, data.status_breakdown.shortlisted, data.status_breakdown.accepted, data.status_breakdown.rejected],
            backgroundColor: ['rgba(245,158,11,0.7)', 'rgba(139,92,246,0.7)', 'rgba(34,197,94,0.7)', 'rgba(239,68,68,0.7)'],
            borderWidth: 0,
        }]
    };

    const scoreColor = s => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Recruitment Dashboard</h1>
                <p className="page-description">Overview of your hiring pipeline and candidate analytics.</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card animate-in">
                    <div className="stat-card-icon blue"><Briefcase size={22} /></div>
                    <div className="stat-card-value">{data.total_jobs}</div>
                    <div className="stat-card-label">Active Jobs</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon purple"><Users size={22} /></div>
                    <div className="stat-card-value">{data.total_applicants}</div>
                    <div className="stat-card-label">Total Applicants</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon green"><CheckCircle size={22} /></div>
                    <div className="stat-card-value">{data.shortlisted}</div>
                    <div className="stat-card-label">Shortlisted</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon teal"><Trophy size={22} /></div>
                    <div className="stat-card-value">{data.accepted}</div>
                    <div className="stat-card-label">Accepted</div>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card animate-in">
                    <div className="card-header">
                        <h3 className="card-title">Application Status</h3>
                    </div>
                    {data.total_applicants > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: 220, height: 220 }}>
                                <Doughnut data={statusData} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    cutout: '65%',
                                    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 12 } } } }
                                }} />
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <Users size={48} />
                            <h3>No applicants yet</h3>
                            <p>Post jobs to start receiving applications.</p>
                        </div>
                    )}
                </div>

                <div className="card animate-in">
                    <div className="card-header">
                        <h3 className="card-title">Top Candidates</h3>
                    </div>
                    {data.leaderboard?.length > 0 ? (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead><tr><th>#</th><th>Name</th><th>Job</th><th>Resume</th><th>Interview</th></tr></thead>
                                <tbody>
                                    {data.leaderboard.slice(0, 5).map(c => (
                                        <tr key={`${c.student_id}-${c.job_id}`}>
                                            <td>
                                                <div className={'leaderboard-rank ${c.rank === 1 ? 'gold' : c.rank === 2 ? 'silver' : c.rank === 3 ? 'bronze' : 'default'}`}>
                                                    {c.rank}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.job_title}</td>
                                            <td><span style={{ color: scoreColor(c.resume_score), fontWeight: 600 }}>{c.resume_score}</span></td>
                                            <td><span style={{ color: scoreColor(c.avg_score || 0), fontWeight: 600 }}>{c.avg_score?.toFixed(1) || '—'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 40 }}><p>No candidates yet.</p></div>
                    )}
                </div>
            </div>

            {data.jobs?.length > 0 && (
                <div className="card animate-in">
                    <div className="card-header">
                        <h3 className="card-title">Your Job Postings</h3>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Title</th><th>Salary</th><th>Deadline</th><th>Status</th></tr></thead>
                            <tbody>
                                {data.jobs.map(j => (
                                    <tr key={j.job_id}>
                                        <td style={{ fontWeight: 600 }}>{j.job_title}</td>
                                        <td>{j.salary_range}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{j.application_deadline ? new Date(j.application_deadline).toLocaleDateString() : '—'}</td>
                                        <td><span className="badge badge-accepted">{j.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
