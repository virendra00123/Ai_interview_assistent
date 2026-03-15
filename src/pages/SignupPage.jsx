import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, GraduationCap, Building2 } from 'lucide-react';

export default function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!role) { setError('Please select a role'); return; }
        setError('');
        setLoading(true);
        try {
            const data = await signup(name, email, password, role);
            navigate(`/${data.user.role}/dashboard`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">AI</div>
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle">Join the AI Interview Platform today</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">I am a...</label>
                            <div className="role-selector">
                                <div
                                    className={'role-option ${role === 'student' ? 'selected' : ''}`}
                                    onClick={() => setRole('student')}
                                >
                                    <span className="role-option-icon"><GraduationCap size={28} /></span>
                                    <div className="role-option-label">Student</div>
                                    <div className="role-option-desc">Prepare for interviews</div>
                                </div>
                                <div
                                    className={'role-option ${role === 'company' ? 'selected' : ''}`}
                                    onClick={() => setRole('company')}
                                >
                                    <span className="role-option-icon"><Building2 size={28} /></span>
                                    <div className="role-option-label">Company</div>
                                    <div className="role-option-desc">Recruit top talent</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">{role === 'company' ? 'Company Name' : 'Full Name'}</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder={role === 'company' ? 'Enter company name' : 'Enter your full name'}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Create a password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                            <UserPlus size={18} />
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
