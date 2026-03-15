import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, User, FileText, Video, BarChart3, Briefcase,
    Building2, Users, Trophy, LogOut, Menu, X, Bot
} from 'lucide-react';

const studentLinks = [
    {
        section: 'Overview', items: [
            { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/student/profile', icon: User, label: 'My Profile' },
        ]
    },
    {
        section: 'Interview Prep', items: [
            { to: '/student/resume', icon: FileText, label: 'Resume Analysis' },
            { to: '/student/interview', icon: Video, label: 'Mock Interview' },
            { to: '/student/reports', icon: BarChart3, label: 'Interview Reports' },
        ]
    },
    {
        section: 'Careers', items: [
            { to: '/student/jobs', icon: Briefcase, label: 'Job Listings' },
        ]
    },
];

const companyLinks = [
    {
        section: 'Overview', items: [
            { to: '/company/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/company/profile', icon: Building2, label: 'Company Profile' },
        ]
    },
    {
        section: 'Recruitment', items: [
            { to: '/company/jobs', icon: Briefcase, label: 'Job Postings' },
            { to: '/company/candidates', icon: Users, label: 'Candidates' },
            { to: '/company/leaderboard', icon: Trophy, label: 'Leaderboard' },
        ]
    },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const links = user?.role === 'company' ? companyLinks : studentLinks;

    return (
        <>
            <button className="mobile-toggle" onClick={() => setOpen(!open)}>
                {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon"><Bot size={22} /></div>
                        <div className="sidebar-logo-text">
                            AI Interview
                            <span>{user?.role === 'company' ? 'Recruitment Portal' : 'Prep Platform'}</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {links.map(section => (
                        <div className="sidebar-section" key={section.section}>
                            <div className="sidebar-section-title">{section.section}</div>
                            {section.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                    onClick={() => setOpen(false)}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{user?.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role">{user?.role}</div>
                        </div>
                        <button className="sidebar-logout" onClick={logout} title="Logout">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
