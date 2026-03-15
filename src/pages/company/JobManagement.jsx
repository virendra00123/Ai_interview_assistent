import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Trash2, X, Save, Briefcase } from 'lucide-react';

export default function JobManagement() {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ job_title: '', job_description: '', required_skills: [], salary_range: '', interview_date: '', application_deadline: '' });
    const [skillInput, setSkillInput] = useState('');

    const fetchJobs = () => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/companies/${user.id}/jobs`)
            .then(r => r.json())
            .then(d => { setJobs(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchJobs(); }, [user.id]);

    const openNew = () => { setForm({ job_title: '', job_description: '', required_skills: [], salary_range: '', interview_date: '', application_deadline: '' }); setEditing(null); setShowModal(true); };
    const openEdit = (j) => { setForm({ ...j }); setEditing(j.job_id); setShowModal(true); };

    const addSkill = () => {
        if (skillInput.trim() && !form.required_skills.includes(skillInput.trim())) {
            setForm({ ...form, required_skills: [...form.required_skills, skillInput.trim()] });
            setSkillInput('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const company = await fetch((import.meta.env.VITE_API_URL || '') + `/api/companies/${user.id}`).then(r => r.json());
        if (editing) {
            await fetch((import.meta.env.VITE_API_URL || '') + `/api/jobs/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        } else {
            await fetch((import.meta.env.VITE_API_URL || '') + '/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, companyId: company.company_id }) });
        }
        setShowModal(false);
        fetchJobs();
    };

    const deleteJob = async (id) => {
        if (!confirm('Delete this job posting?')) return;
        await fetch((import.meta.env.VITE_API_URL || '') + `/api/jobs/${id}`, { method: 'DELETE' });
        fetchJobs();
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">Job Postings</h1>
                    <p className="page-description">Create and manage your job openings.</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Job</button>
            </div>

            {jobs.length === 0 ? (
                <div className="card"><div className="empty-state"><Briefcase size={64} /><h3>No job postings</h3><p>Create your first job posting to start receiving applications.</p></div></div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {jobs.map(j => (
                        <div className="job-card animate-in" key={j.job_id}>
                            <div className="job-card-header">
                                <div>
                                    <div className="job-card-title">{j.job_title}</div>
                                    <span className={'badge badge-${j.status === 'active' ? 'accepted' : 'rejected'}`}>{j.status}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(j)}><Edit2 size={14} /> Edit</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => deleteJob(j.job_id)}><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{j.job_description}</p>
                            <div className="skills-list" style={{ marginBottom: 12 }}>
                                {j.required_skills?.map(s => <span key={s} className="skill-tag">{s}</span>)}
                            </div>
                            <div className="job-card-meta">
                                {j.salary_range && <span>💰 {j.salary_range}</span>}
                                {j.application_deadline && <span>📅 Deadline: {new Date(j.application_deadline).toLocaleDateString()}</span>}
                                {j.interview_date && <span>🎤 Interview: {new Date(j.interview_date).toLocaleDateString()}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editing ? 'Edit Job' : 'Create New Job'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Job Title *</label>
                                <input className="form-input" required value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Senior Frontend Developer" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={form.job_description} onChange={e => setForm({ ...form, job_description: e.target.value })} placeholder="Describe the role..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Required Skills</label>
                                <div className="skills-list" style={{ marginBottom: 8 }}>
                                    {form.required_skills.map(s => (
                                        <span key={s} className="skill-tag" style={{ cursor: 'pointer' }} onClick={() => setForm({ ...form, required_skills: form.required_skills.filter(x => x !== s) })}>{s} <X size={10} /></span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="form-input" value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add skill" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                                    <button type="button" className="btn btn-secondary" onClick={addSkill}><Plus size={14} /></button>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Salary Range</label>
                                    <input className="form-input" value={form.salary_range} onChange={e => setForm({ ...form, salary_range: e.target.value })} placeholder="e.g. ₹12-18 LPA" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Application Deadline</label>
                                    <input className="form-input" type="date" value={form.application_deadline} onChange={e => setForm({ ...form, application_deadline: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Interview Date</label>
                                <input className="form-input" type="date" value={form.interview_date} onChange={e => setForm({ ...form, interview_date: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-primary btn-full"><Save size={16} /> {editing ? 'Update Job' : 'Create Job'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
