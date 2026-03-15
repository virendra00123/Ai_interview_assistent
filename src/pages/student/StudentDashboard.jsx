import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Line, Radar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    RadialLinearScale, Filler, Tooltip, Legend
} from 'chart.js';
import {
    FileText, Video, TrendingUp, Briefcase, ArrowRight, Star, Target, Zap
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Filler, Tooltip, Legend);

export default function StudentDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/dashboard/student/${user.id}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user.id]);

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Unable to load dashboard</h3></div>;

    const trendData = {
        labels: data.score_trend.map((_, i) => `Interview ${i + 1}`),
        datasets: [{
            label: 'Overall Score',
            data: data.score_trend.map(s => s.score),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
        }]
    };

    const radarData = {
        labels: ['Eye Contact', 'Speech', 'Posture', 'Answer Relevance', 'Confidence', 'Communication', 'Technical', 'Body Language'],
        datasets: [{
            label: 'Your Average',
            data: [
                data.category_averages.eye_contact,
                data.category_averages.speech,
                data.category_averages.posture,
                data.category_averages.answer_relevance,
                data.category_averages.confidence,
                data.category_averages.communication,
                data.category_averages.technical,
                data.category_averages.body_language
            ],
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderColor: '#8b5cf6',
            borderWidth: 2,
            pointBackgroundColor: '#8b5cf6',
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' }, min: 0, max: 100 }
        }
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            r: {
                angleLines: { color: 'rgba(255,255,255,0.05)' },
                grid: { color: 'rgba(255,255,255,0.08)' },
                pointLabels: { color: '#94a3b8', font: { size: 11 } },
                ticks: { display: false },
                min: 0, max: 100
            }
        }
    };

    const scoreColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
    const circumference = 2 * Math.PI * 60;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Welcome back, {user.name?.split(' ')[0]} 👋</h1>
                <p className="page-description">Track your interview preparation progress and improvement over time.</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card animate-in">
                    <div className="stat-card-icon purple"><FileText size={22} /></div>
                    <div className="stat-card-value">{data.resume_score || '—'}</div>
                    <div className="stat-card-label">Resume Score</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon blue"><Video size={22} /></div>
                    <div className="stat-card-value">{data.total_interviews}</div>
                    <div className="stat-card-label">Total Interviews</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon teal"><TrendingUp size={22} /></div>
                    <div className="stat-card-value">{data.avg_score || '—'}</div>
                    <div className="stat-card-label">Average Score</div>
                </div>
                <div className="stat-card animate-in">
                    <div className="stat-card-icon orange"><Briefcase size={22} /></div>
                    <div className="stat-card-value">{data.applications?.length || 0}</div>
                    <div className="stat-card-label">Applications</div>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card animate-in">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Score Progress</h3>
                            <p className="card-subtitle">Your interview performance over time</p>
                        </div>
                    </div>
                    {data.score_trend.length > 0 ? (
                        <div className="chart-container">
                            <Line data={trendData} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Video size={48} />
                            <h3>No interviews yet</h3>
                            <p>Start a mock interview to see your progress</p>
                            <Link to="/student/interview" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                                Start Interview <ArrowRight size={16} />
                            </Link>
                        </div>
                    )}
                </div>

                <div className="card animate-in">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Skills Radar</h3>
                            <p className="card-subtitle">Performance across evaluation criteria</p>
                        </div>
                    </div>
                    {data.total_interviews > 0 ? (
                        <div className="chart-container">
                            <Radar data={radarData} options={radarOptions} />
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Target size={48} />
                            <h3>No data yet</h3>
                            <p>Complete interviews to see your skills radar</p>
                        </div>
                    )}
                </div>
            </div>

            {data.recent_interviews.length > 0 && (
                <div className="card animate-in">
                    <div className="card-header">
                        <h3 className="card-title">Recent Interviews</h3>
                        <Link to="/student/reports" className="btn btn-secondary btn-sm">View All <ArrowRight size={14} /></Link>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Overall Score</th>
                                    <th>Confidence</th>
                                    <th>Technical</th>
                                    <th>Communication</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recent_interviews.map(interview => (
                                    <tr key={interview.interview_id}>
                                        <td>{new Date(interview.recorded_at).toLocaleDateString()}</td>
                                        <td><span className="badge badge-reviewed" style={{ textTransform: 'capitalize' }}>{interview.interview_type}</span></td>
                                        <td><strong style={{ color: scoreColor(interview.overall_score) }}>{interview.overall_score.toFixed(1)}</strong></td>
                                        <td>{interview.confidence_score}</td>
                                        <td>{interview.technical_score}</td>
                                        <td>{interview.communication_score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {data.applications?.length > 0 && (
                <div className="card animate-in" style={{ marginTop: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title">Application Status</h3>
                        <Link to="/student/jobs" className="btn btn-secondary btn-sm">Browse Jobs <ArrowRight size={14} /></Link>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>Job Title</th><th>Company</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {data.applications.map(app => (
                                    <tr key={app.application_id}>
                                        <td>{app.job_title}</td>
                                        <td>{app.company_name}</td>
                                        <td><span className={`badge badge-${app.status}`}>{app.status}</span></td>
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
