import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Save, Building2 } from 'lucide-react';

export default function CompanyProfile() {
    const { user, updateProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch((import.meta.env.VITE_API_URL || '') + `/api/companies/${user.id}`)
            .then(r => r.json())
            .then(d => { setProfile(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    const handleSave = async () => {
        setSaving(true); setMessage('');
        try {
            const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/companies/${user.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            const data = await res.json();
            setProfile(data); updateProfile(data);
            setMessage('Profile saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch { setMessage('Error saving profile'); }
        setSaving(false);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!profile) return <div className="empty-state"><h3>Unable to load profile</h3></div>;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">Company Profile</h1>
                    <p className="page-description">Manage your company information and recruiter details.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            {message && <div className={message.includes('Error') ? 'error-message' : 'success-message'}>{message}</div>}

            <div className="grid-2">
                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Company Information</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Company Name</label>
                            <input className="form-input" value={profile.company_name || ''} onChange={e => setProfile({ ...profile, company_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Industry Type</label>
                            <select className="form-select" value={profile.industry_type || ''} onChange={e => setProfile({ ...profile, industry_type: e.target.value })}>
                                <option value="">Select industry</option>
                                {['Technology', 'Data Analytics', 'Finance', 'Healthcare', 'Education', 'E-Commerce', 'Consulting', 'Other'].map(i => (
                                    <option key={i} value={i}>{i}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={profile.company_description || ''} onChange={e => setProfile({ ...profile, company_description: e.target.value })} placeholder="Describe your company..." />
                        </div>
                    </div>
                </div>

                <div className="card animate-in">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Recruiter Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Recruiter Name</label>
                            <input className="form-input" value={profile.recruiter_name || ''} onChange={e => setProfile({ ...profile, recruiter_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Recruiter Email</label>
                            <input className="form-input" type="email" value={profile.recruiter_email || ''} onChange={e => setProfile({ ...profile, recruiter_email: e.target.value })} />
                        </div>
                        <div style={{ padding: 20, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                            <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Company logo upload coming soon</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
