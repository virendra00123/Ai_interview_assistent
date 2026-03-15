import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('ai_interview_user');
        const storedProfile = localStorage.getItem('ai_interview_profile');
        if (stored) {
            setUser(JSON.parse(stored));
            if (storedProfile) setProfile(JSON.parse(storedProfile));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('ai_interview_user', JSON.stringify(data.user));
        localStorage.setItem('ai_interview_profile', JSON.stringify(data.profile));
        setUser(data.user);
        setProfile(data.profile);
        return data;
    };

    const signup = async (name, email, password, role) => {
        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('ai_interview_user', JSON.stringify(data.user));
        localStorage.setItem('ai_interview_profile', JSON.stringify(data.profile));
        setUser(data.user);
        setProfile(data.profile);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('ai_interview_user');
        localStorage.removeItem('ai_interview_profile');
        setUser(null);
        setProfile(null);
    };

    const updateProfile = (p) => {
        setProfile(p);
        localStorage.setItem('ai_interview_profile', JSON.stringify(p));
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
