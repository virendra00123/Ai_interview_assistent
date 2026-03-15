import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Sidebar from './components/Sidebar';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfile from './pages/student/StudentProfile';
import ResumeAnalysis from './pages/student/ResumeAnalysis';
import MockInterview from './pages/student/MockInterview';
import InterviewReport from './pages/student/InterviewReport';
import JobListings from './pages/student/JobListings';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProfile from './pages/company/CompanyProfile';
import JobManagement from './pages/company/JobManagement';
import CandidateReview from './pages/company/CandidateReview';
import Leaderboard from './pages/company/Leaderboard';

function ProtectedRoute({ children, allowedRole }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (allowedRole && user.role !== allowedRole) return <Navigate to={`/${user.role}/dashboard`} replace />;
    return children;
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <>
            {user ? (
                <div className="app-layout">
                    <Sidebar />
                    <main className="main-content">
                        <Routes>
                            {/* Student Routes */}
                            <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
                            <Route path="/student/profile" element={<ProtectedRoute allowedRole="student"><StudentProfile /></ProtectedRoute>} />
                            <Route path="/student/resume" element={<ProtectedRoute allowedRole="student"><ResumeAnalysis /></ProtectedRoute>} />
                            <Route path="/student/interview" element={<ProtectedRoute allowedRole="student"><MockInterview /></ProtectedRoute>} />
                            <Route path="/student/reports" element={<ProtectedRoute allowedRole="student"><InterviewReport /></ProtectedRoute>} />
                            <Route path="/student/jobs" element={<ProtectedRoute allowedRole="student"><JobListings /></ProtectedRoute>} />

                            {/* Company Routes */}
                            <Route path="/company/dashboard" element={<ProtectedRoute allowedRole="company"><CompanyDashboard /></ProtectedRoute>} />
                            <Route path="/company/profile" element={<ProtectedRoute allowedRole="company"><CompanyProfile /></ProtectedRoute>} />
                            <Route path="/company/jobs" element={<ProtectedRoute allowedRole="company"><JobManagement /></ProtectedRoute>} />
                            <Route path="/company/candidates" element={<ProtectedRoute allowedRole="company"><CandidateReview /></ProtectedRoute>} />
                            <Route path="/company/leaderboard" element={<ProtectedRoute allowedRole="company"><Leaderboard /></ProtectedRoute>} />

                            {/* Default redirect */}
                            <Route path="*" element={<Navigate to={`/${user.role}/dashboard`} replace />} />
                        </Routes>
                    </main>
                </div>
            ) : (
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            )}
        </>
    );
}
