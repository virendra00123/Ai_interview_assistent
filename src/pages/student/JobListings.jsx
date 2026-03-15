import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, Search, MapPin, Clock, DollarSign, ArrowRight, Check } from 'lucide-react';

export default function JobListings() {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [apps, setApps] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(null);

    useEffect(() => {
        Promise.all([
            fetch((import.meta.env.VITE_API_URL || '') + '/api/jobs').then(r => r.json()),
            fetch((import.meta.env.VITE_API_URL || '') + '/api/applications/student/${user.id}`).then(r => r.json())
        ]).then(([j, a]) => {
            setJobs(j); setApps(a); setLoading(false);
        }).catch(() => setLoading(false));
    }, [user.id]);

    const apply = async (jobId) => {
        setApplying(jobId);
        try {
            await fetch((import.meta.env.VITE_API_URL || '') + '/api/applications', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, jobId })
            });
            const a = await fetch((import.meta.env.VITE_API_URL || '') + '/api/applications/student/${user.id}`).then(r => r.json());
            setApps(a);
        } catch (err) { console.error(err); }
        setApplying(null);
    };

    const hasApplied = (jobId) => apps.some(a => a.job_id === jobId);
    const filtered = jobs.filter(j =>
        j.job_title.toLowerCase().includes(search.toLowerCase()) ||
        j.company_name.toLowerCase().includes(search.toLowerCase()) ||
        j.required_skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
    );

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Job Listings</h1>
                <p className="page-description">Browse available positions and apply with one click.</p>
            </div>

            <div className="search-bar">
                <Search />
                <input placeholder="Search by job title, company, or skill..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {apps.length > 0 && (
                <div className="card animate-in" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title">Your Applications ({apps.length})</h3>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Job</th><th>Company</th><th>Salary</th><th>Status</th></tr></thead>
                            <tbody>
                                {apps.map(a => (
                                    <tr key={a.application_id}>
                                        <td style={{ fontWeight: 600 }}>{a.job_title}</td>
                                        <td>{a.company_name}</td>
                                        <td>{a.salary_range}</td>
                                        <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gap: 16 }}>
                {filtered.length === 0 ? (
                    <div className="card"><div className="empty-state"><Briefcase size={48} /><h3>No jobs found</h3><p>Try a different search term.</p></div></div>
                ) : (
                    filtered.map(job => (
                        <div className="job-card animate-in" key={job.job_id}>
                            <div className="job-card-header">
                                <div>
                                    <div className="job-card-title">{job.job_title}</div>
                                    <div className="job-card-company">{job.company_name}</div>
                                </div>
                                {job.salary_range && <div className="job-card-salary">{job.salary_range}</div>}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>{job.job_description}</p>
                            <div className="skills-list" style={{ marginBottom: 16 }}>
                                {job.required_skills?.map(s => <span key={s} className="skill-tag">{s}</span>)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="job-card-meta">
                                    {job.application_deadline && <span><Clock size={14} /> Deadline: {new Date(job.application_deadline).toLocaleDateString()}</span>}
                                    {job.industry_type && <span><MapPin size={14} /> {job.industry_type}</span>}
                                </div>
                                {hasApplied(job.job_id) ? (
                                    <span className="btn btn-success btn-sm" style={{ pointerEvents: 'none' }}><Check size={14} /> Applied</span>
                                ) : (
                                    <button className="btn btn-primary btn-sm" onClick={() => apply(job.job_id)} disabled={applying === job.job_id}>
                                        {applying === job.job_id ? 'Applying...' : <>Apply Now <ArrowRight size={14} /></>}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
