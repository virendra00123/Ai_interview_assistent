import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Search, CheckCircle, XCircle, Eye, Mail } from 'lucide-react';

export default function CandidateReview() {
    const { user } = useAuth();
    const [candidates, setCandidates] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchCandidates = () => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/companies/${user.id}/candidates`)
            .then(r => r.json())
            .then(d => { setCandidates(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchCandidates(); }, [user.id]);

    const updateStatus = async (appId, status) => {
        await fetch((import.meta.env.VITE_API_URL || '') + `/api/applications/${appId}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        fetchCandidates();
    };

    const scoreColor = s => s >= 80 ? 'var(--accent-green)' : s >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

    const filtered = candidates.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.job_title?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'all' || c.application_status === filter;
        return matchSearch && matchFilter;
    });

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Candidate Review</h1>
                <p className="page-description">Review applications, filter by skills, and manage candidate pipeline.</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, marginBottom: 0, minWidth: 200 }}>
                    <Search /><input placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="tabs" style={{ marginBottom: 0 }}>
                    {['all', 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'].map(s => (
                        <button key={s} className={'tab ${filter === s ? 'active' : ''}'} onClick={() => setFilter(s)} style={{ textTransform: 'capitalize' }}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><Users size={48} /><h3>No candidates found</h3><p>Adjust your search or filters.</p></div></div>
            ) : (
                <div className="data-table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Candidate</th><th>Job Applied</th><th>College</th>
                                <th>Skill Match</th><th>Resume Score</th><th>Interview Avg</th>
                                <th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
                                <tr key={`${c.student_id}-${c.job_id}-${i}`}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>
                                    </td>
                                    <td style={{ fontSize: 13 }}>{c.job_title}</td>
                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.college}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="progress-bar" style={{ width: 60, height: 6 }}>
                                                <div className="progress-bar-fill" style={{ width: `${c.skill_match_pct}%`, background: scoreColor(c.skill_match_pct) }} />
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(c.skill_match_pct) }}>{c.skill_match_pct}%</span>
                                        </div>
                                    </td>
                                    <td><span style={{ fontWeight: 600, color: scoreColor(c.resume_score) }}>{c.resume_score}</span></td>
                                    <td><span style={{ fontWeight: 600, color: scoreColor(c.avg_interview_score || 0) }}>{c.avg_interview_score?.toFixed(1) || '—'}</span></td>
                                    <td><span className={`badge badge-${c.application_status}`}>{c.application_status}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {c.application_status !== 'shortlisted' && c.application_status !== 'accepted' && (
                                                <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.application_id, 'shortlisted')} title="Shortlist">
                                                    <CheckCircle size={14} />
                                                </button>
                                            )}
                                            {c.application_status === 'shortlisted' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => updateStatus(c.application_id, 'accepted')} title="Accept">
                                                    <CheckCircle size={14} />
                                                </button>
                                            )}
                                            {c.application_status !== 'rejected' && c.application_status !== 'accepted' && (
                                                <button className="btn btn-danger btn-sm" onClick={() => updateStatus(c.application_id, 'rejected')} title="Reject">
                                                    <XCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
