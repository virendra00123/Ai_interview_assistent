import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Save, Plus, X, Github, Linkedin, GraduationCap, Upload } from 'lucide-react';

export default function StudentProfile() {
    const { user, updateProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [newSkill, setNewSkill] = useState('');

    useEffect(() => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/students/${user.id}`)
            .then(r => r.json())
            .then(d => { setProfile(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/students/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: profile.name,
                    phone: profile.phone,
                    college: profile.college,
                    degree: profile.degree,
                    graduation_year: profile.graduation_year,
                    skills: profile.skills,
                    linkedin: profile.linkedin,
                    github: profile.github,
                    projects: profile.projects,
                    certifications: profile.certifications,
                })
            });
            const data = await res.json();
            setProfile(data);
            updateProfile(data);
            setMessage('Profile saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('Error saving profile');
        }
        setSaving(false);
    };

    const addSkill = () => {
        if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
            setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
            setNewSkill('');
        }
    };

    const removeSkill = (skill) => {
        setProfile({ ...profile, skills: profile.skills.filter(s => s !== skill) });
    };

    const addProject = () => {
        setProfile({ ...profile, projects: [...(profile.projects || []), { name: '', description: '', tech: '' }] });
    };

    const updateProject = (idx, field, value) => {
        const projects = [...profile.projects];
        projects[idx] = { ...projects[idx], [field]: value };
        setProfile({ ...profile, projects });
    };

    const removeProject = (idx) => {
        setProfile({ ...profile, projects: profile.projects.filter((_, i) => i !== idx) });
    };

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('resume', file);
        try {
            const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/students/${user.id}/resume`, { method: 'POST', body: formData });
            const data = await res.json();
            setProfile({ ...profile, resume_file: data.file, resume_score: data.score });
            setMessage('Resume uploaded and analyzed!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('Error uploading resume');
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!profile) return <div className="empty-state"><h3>Unable to load profile</h3></div>;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">My Profile</h1>
                    <p className="page-description">Complete your profile to get better interview recommendations.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>

            {message && <div className={message.includes('Error') ? 'error-message' : 'success-message'}>{message}</div>}

            <div className="grid-2">
                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Personal Information</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" value={profile.email || ''} disabled style={{ opacity: 0.6 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="Enter phone number" />
                        </div>
                    </div>
                </div>

                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Education</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">College/University</label>
                            <input className="form-input" value={profile.college || ''} onChange={e => setProfile({ ...profile, college: e.target.value })} placeholder="Enter college name" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Degree</label>
                            <input className="form-input" value={profile.degree || ''} onChange={e => setProfile({ ...profile, degree: e.target.value })} placeholder="e.g. B.Tech Computer Science" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Graduation Year</label>
                            <input className="form-input" type="number" value={profile.graduation_year || ''} onChange={e => setProfile({ ...profile, graduation_year: parseInt(e.target.value) })} placeholder="2025" />
                        </div>
                    </div>
                </div>

                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Skills</h3>
                    <div className="skills-list" style={{ marginBottom: 16 }}>
                        {profile.skills?.map(skill => (
                            <span key={skill} className="skill-tag match" style={{ cursor: 'pointer' }} onClick={() => removeSkill(skill)}>
                                {skill} <X size={12} />
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                            placeholder="Add a skill" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                        <button className="btn btn-secondary" onClick={addSkill}><Plus size={16} /></button>
                    </div>
                </div>

                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Links & Resume</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label"><Linkedin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> LinkedIn</label>
                            <input className="form-input" value={profile.linkedin || ''} onChange={e => setProfile({ ...profile, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Github size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> GitHub</label>
                            <input className="form-input" value={profile.github || ''} onChange={e => setProfile({ ...profile, github: e.target.value })} placeholder="https://github.com/..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Resume</label>
                            <label className="file-upload" style={{ marginBottom: 0 }}>
                                <Upload size={32} />
                                <p>{profile.resume_file ? `Uploaded: ${profile.resume_file}` : <><span>Click to upload</span> your resume (PDF/DOC)</>}</p>
                                <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} hidden />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card animate-in" style={{ marginTop: 24 }}>
                <div className="card-header">
                    <h3 className="card-title">Projects</h3>
                    <button className="btn btn-secondary btn-sm" onClick={addProject}><Plus size={14} /> Add Project</button>
                </div>
                {profile.projects?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {profile.projects.map((proj, i) => (
                            <div key={i} style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <input className="form-input" value={proj.name} onChange={e => updateProject(i, 'name', e.target.value)} placeholder="Project name" style={{ flex: 1, marginRight: 8 }} />
                                    <button className="btn btn-danger btn-sm" onClick={() => removeProject(i)}><X size={14} /></button>
                                </div>
                                <input className="form-input" value={proj.description} onChange={e => updateProject(i, 'description', e.target.value)} placeholder="Brief description" style={{ marginBottom: 8 }} />
                                <input className="form-input" value={proj.tech} onChange={e => updateProject(i, 'tech', e.target.value)} placeholder="Technologies used" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: 30 }}>
                        <p>No projects added yet. Add your projects to strengthen your profile.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
