import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FiCalendar, FiTrendingUp, FiClock, FiGrid,
  FiLogOut, FiUser, FiBell, FiActivity, FiHome,
  FiZap
} from 'react-icons/fi';
import { attendanceAPI, noticesAPI, membersAPI } from '../utils/api';
import AttendanceScanner from './AttendanceScanner';
import SubscriptionCard from './SubscriptionCard';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ThemeToggle from './ThemeToggle';
import { MemberDashboardSkeleton } from './Skeleton';
import './MemberDashboard.css';

const MemberDashboard = ({ user, setUser }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('home');
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ thisMonth: 0, total: 0, avgDuration: 0 });
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // Chart colours
  const chartColor    = theme === 'dark' ? '#00ff88' : '#00bfa5';
  const chartColorSec = theme === 'dark' ? '#00d97e' : '#26c6da';
  const chartGrid     = theme === 'dark' ? '#2e2e2e' : '#e0e0e0';
  const chartText     = theme === 'dark' ? '#a0a0a0' : '#757575';
  const tooltipStyle  = {
    background:   theme === 'dark' ? '#242424' : '#ffffff',
    border:       `1px solid ${chartGrid}`,
    borderRadius: 8,
    color:        theme === 'dark' ? '#ffffff' : '#212121',
    fontSize:     13
  };

  // ── Data ───────────────────────────────────────────────────────
  useEffect(() => { fetchMemberData(); }, []);

  const fetchMemberData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const attendanceRes = await attendanceAPI.getMemberAttendance(user.id);
      setAttendance(attendanceRes.data.attendances);
      setStats(attendanceRes.data.stats);

      const noticesRes = await noticesAPI.getNotices(user.gymOwner.id, { active: true });
      setNotices(noticesRes.data.notices);
    } catch (error) {
      console.error('Error fetching member data:', error);
      setFetchError(error.response?.data?.message || 'Could not connect to server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.next.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    try {
      await membersAPI.changePassword(user.id, {
        currentPassword: pwForm.current,
        newPassword: pwForm.next
      });
      toast.success('Password updated successfully!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  const getDaysUntilExpiry = () =>
    Math.ceil((new Date(user.membershipEndDate) - new Date()) / (1000 * 60 * 60 * 24));

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getMembershipPeriodDays = () => {
    const start = new Date(user.membershipStartDate || user.createdAt);
    const end   = new Date(user.membershipEndDate);
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  };

  // Circular progress: fraction of membership remaining (0–1)
  const progressFraction = () => {
    const total   = getMembershipPeriodDays();
    const remaining = Math.max(0, getDaysUntilExpiry());
    return Math.min(1, remaining / total);
  };

  // SVG circle constants
  const RADIUS = 54;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - progressFraction());

  // Build weekly bar-chart data from attendance records
  const buildWeeklyData = () => {
    const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = Array(7).fill(0);
    const now   = new Date();
    attendance.forEach(rec => {
      const d   = new Date(rec.date || rec.checkInTime);
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff < 7) counts[d.getDay()]++;
    });
    const today = now.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const dayIdx = (today - 6 + i + 7) % 7;
      return { day: DAYS[dayIdx], visits: counts[dayIdx] };
    });
  };

  // Build 6-month trend data from attendance records
  const buildMonthlyData = () => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now    = new Date();
    const curM   = now.getMonth();
    const counts = Array(6).fill(0);
    attendance.forEach(rec => {
      const d    = new Date(rec.date || rec.checkInTime);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (curM - d.getMonth());
      if (diff >= 0 && diff < 6) counts[5 - diff]++;
    });
    return Array.from({ length: 6 }, (_, i) => ({
      month:  MONTHS[(curM - 5 + i + 12) % 12],
      visits: counts[i]
    }));
  };

  // ── Status badge ───────────────────────────────────────────────
  const getStatusClass = () => {
    const d = getDaysUntilExpiry();
    if (user.membershipStatus === 'expired') return 'md-status-expired';
    if (d <= 7) return 'md-status-warning';
    return 'md-status-active';
  };

  const getStatusText = () => {
    const d = getDaysUntilExpiry();
    if (user.membershipStatus === 'expired') return 'Expired';
    if (d <= 7) return `Expires in ${d}d`;
    return 'Active';
  };

  // ── Memoized chart data (computed once per attendance change) ──
  // These hooks MUST be before any conditional return
  const weeklyData  = useMemo(() => buildWeeklyData(),  [attendance]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthlyData = useMemo(() => buildMonthlyData(), [attendance]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / Error ────────────────────────────────────────────
  if (loading) return <MemberDashboardSkeleton />;

  if (fetchError) return (
    <div className="md-error-state">
      <div className="md-error-icon">⚠️</div>
      <h2>Unable to Load Dashboard</h2>
      <p>{fetchError}</p>
      <button className="md-retry-btn" onClick={fetchMemberData}>
        🔄 Try Again
      </button>
    </div>
  );

  const daysLeft = getDaysUntilExpiry();

  return (
    <div className="md-wrapper">

      {/* ── HEADER ── */}
      <header className="md-header">
        <div className="md-header-left">
          <p className="md-gym-name">💪 {user.gymOwner.gymName}</p>
          <h1 className="md-greeting">{getGreeting()}, {user.name.split(' ')[0]}!</h1>
        </div>
        <div className="md-header-right">
          <div className={`md-status-badge ${getStatusClass()}`}>
            <span className="md-status-dot" />
            {getStatusText()}
          </div>
          <ThemeToggle />
          <button className="md-logout-btn" onClick={handleLogout}>
            <FiLogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── TABS ── */}
      <nav className="md-tabs">
        {[
          { id: 'home',       icon: <FiHome size={15} />,     label: 'Home' },
          { id: 'scan',       icon: <FiGrid size={15} />,     label: 'Scan QR' },
          { id: 'attendance', icon: <FiActivity size={15} />, label: 'Attendance' },
          { id: 'notices',    icon: <FiBell size={15} />,     label: 'Notices' },
          { id: 'profile',    icon: <FiUser size={15} />,     label: 'Profile' },
        ].map(t => (
          <button
            key={t.id}
            className={`md-tab${activeTab === t.id ? ' md-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <main className="md-content">

        {/* ══ HOME ══ */}
        {activeTab === 'home' && (
          <>
            {/* Hero Membership Card */}
            <div className="md-hero-card">
              {/* Left: details */}
              <div className="md-hero-details">
                <p className="md-hero-label">Membership Status</p>
                <h2 className="md-hero-status">{user.membershipStatus.charAt(0).toUpperCase() + user.membershipStatus.slice(1)}</h2>
                <div className="md-hero-rows">
                  <div className="md-hero-row">
                    <span className="md-hero-row-label">Valid until</span>
                    <span className="md-hero-row-value">{new Date(user.membershipEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="md-hero-row">
                    <span className="md-hero-row-label">Days remaining</span>
                    <span className="md-hero-row-value">{Math.max(0, daysLeft)} days</span>
                  </div>
                  <div className="md-hero-row">
                    <span className="md-hero-row-label">Gym</span>
                    <span className="md-hero-row-value">{user.gymOwner.gymName}</span>
                  </div>
                </div>
                {daysLeft <= 7 && daysLeft > 0 && (
                  <div className="md-renew-alert">⚠️ Expiring soon — contact your gym to renew</div>
                )}
              </div>

              {/* Right: circular progress */}
              <div className="md-hero-progress">
                <svg width="136" height="136" viewBox="0 0 136 136">
                  {/* Track */}
                  <circle
                    cx="68" cy="68" r={RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="10"
                  />
                  {/* Progress */}
                  <circle
                    cx="68" cy="68" r={RADIUS}
                    fill="none"
                    stroke="white"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 68 68)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="md-progress-label">
                  <span className="md-progress-num">{Math.max(0, daysLeft)}</span>
                  <span className="md-progress-sub">days left</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="md-stats-grid">
              <div className="md-stat-card">
                <div className="md-stat-icon md-icon-teal"><FiCalendar size={20} color="#fff" /></div>
                <div className="md-stat-body">
                  <h3 className="md-stat-value">{stats.thisMonth}</h3>
                  <p className="md-stat-label">This Month</p>
                </div>
              </div>
              <div className="md-stat-card">
                <div className="md-stat-icon md-icon-blue"><FiTrendingUp size={20} color="#fff" /></div>
                <div className="md-stat-body">
                  <h3 className="md-stat-value">{stats.total}</h3>
                  <p className="md-stat-label">Total Visits</p>
                </div>
              </div>
              <div className="md-stat-card">
                <div className="md-stat-icon md-icon-purple"><FiClock size={20} color="#fff" /></div>
                <div className="md-stat-body">
                  <h3 className="md-stat-value">{stats.avgDuration}<span className="md-stat-unit"> min</span></h3>
                  <p className="md-stat-label">Avg Duration</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="md-quick-actions">
              <button className="md-qa-primary" onClick={() => setActiveTab('scan')}>
                <FiZap size={22} />
                <span>Scan QR Code</span>
                <p>Mark today's attendance</p>
              </button>
              <button className="md-qa-secondary" onClick={() => setActiveTab('attendance')}>
                <FiActivity size={20} />
                <span>Attendance History</span>
              </button>
              <button className="md-qa-secondary" onClick={() => setActiveTab('notices')}>
                <FiBell size={20} />
                <span>Gym Notices</span>
                {notices.length > 0 && <span className="md-qa-badge">{notices.length}</span>}
              </button>
            </div>

            {/* Premium: Calorie Tracker */}
            <SubscriptionCard />

            {/* Charts */}
            <div className="md-charts-grid">
              <div className="md-chart-card">
                <h3 className="md-chart-title">Weekly Visits</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="day"   tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="visits" name="Visits" fill={chartColor} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="md-chart-card">
                <h3 className="md-chart-title">Monthly Trend</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="month"  tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="visits" name="Visits" stroke={chartColorSec} strokeWidth={2.5} dot={{ fill: chartColorSec, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Notices preview */}
            {notices.length > 0 && (
              <div className="md-notices-preview">
                <h3 className="md-section-title">📢 Latest Announcements</h3>
                {notices.slice(0, 3).map(notice => (
                  <div key={notice._id} className={`md-notice-item md-notice-${notice.priority || 'low'}`}>
                    <h4>{notice.title}</h4>
                    <p>{notice.content}</p>
                    <span className="md-notice-date">{new Date(notice.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Referral */}
            <div className="md-referral-card">
              <h3>🎁 Refer &amp; Earn</h3>
              <p>Share your referral code with friends!</p>
              <div className="md-referral-code">{user.referralCode}</div>
            </div>
          </>
        )}

        {/* ══ SCAN QR ══ */}
        {activeTab === 'scan' && (
          <div className="md-scan-wrapper">
            <AttendanceScanner user={user} />
          </div>
        )}

        {/* ══ ATTENDANCE ══ */}
        {activeTab === 'attendance' && (
          <div>
            <h2 className="md-page-title">Attendance History</h2>
            <div className="md-attendance-list">
              {attendance.length === 0 ? (
                <p className="md-empty">No attendance records yet.</p>
              ) : (
                attendance.map(record => (
                  <div key={record._id} className="md-attendance-record">
                    <div className="md-record-date">
                      <span className="md-rec-day">{new Date(record.date || record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="md-rec-num">{new Date(record.date || record.checkInTime).getDate()}</span>
                      <span className="md-rec-mon">{new Date(record.date || record.checkInTime).toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>
                    <div className="md-record-details">
                      <div className="md-time-info">
                        <span className="md-ti-label">Check-in</span>
                        <span className="md-ti-value">{new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {record.checkOutTime && (
                        <>
                          <div className="md-time-info">
                            <span className="md-ti-label">Check-out</span>
                            <span className="md-ti-value">{new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="md-time-info">
                            <span className="md-ti-label">Duration</span>
                            <span className="md-ti-value md-ti-accent">{record.duration} min</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══ NOTICES ══ */}
        {activeTab === 'notices' && (
          <div>
            <h2 className="md-page-title">📢 Announcements</h2>
            <div className="md-notices-list">
              {notices.length === 0 ? (
                <p className="md-empty">No notices available.</p>
              ) : (
                notices.map(notice => (
                  <div key={notice._id} className={`md-notice-card md-notice-${notice.priority || 'low'}`}>
                    <div className="md-notice-head">
                      <h3>{notice.title}</h3>
                      <span className={`md-priority-badge md-priority-${notice.priority || 'low'}`}>{notice.priority || 'info'}</span>
                    </div>
                    <p className="md-notice-body">{notice.content}</p>
                    <span className="md-notice-date">{new Date(notice.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {activeTab === 'profile' && (
          <div>
            <h2 className="md-page-title">Profile</h2>
            <div className="md-profile-card">
              {user.profilePhoto
                ? <img src={user.profilePhoto} alt={user.name} className="md-profile-avatar-img" />
                : <div className="md-profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
              }
              <h2 className="md-profile-name">{user.name}</h2>
              <p className="md-profile-gym">{user.gymOwner?.gymName}</p>
              <div className="md-profile-rows">
                {[
                  { label: 'Email',         value: user.email || '—' },
                  { label: 'Phone',         value: user.phone },
                  { label: 'Login ID',      value: user.loginId || '—' },
                  { label: 'Member Since',  value: new Date(user.createdAt || user.membershipStartDate).toLocaleDateString() },
                  { label: 'Referral Code', value: user.referralCode },
                ].map(row => (
                  <div key={row.label} className="md-profile-row">
                    <span className="md-profile-label">{row.label}</span>
                    <span className="md-profile-value">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Password */}
            <div className="md-change-pw-card">
              <h3 className="md-change-pw-title">Change Password</h3>
              <form className="md-change-pw-form" onSubmit={handleChangePassword}>
                <div className="md-pw-field">
                  <label>Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={pwForm.current}
                    onChange={e => setPwForm(prev => ({ ...prev, current: e.target.value }))}
                    required
                  />
                </div>
                <div className="md-pw-field">
                  <label>New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    value={pwForm.next}
                    onChange={e => setPwForm(prev => ({ ...prev, next: e.target.value }))}
                    minLength={6}
                    required
                  />
                </div>
                <div className="md-pw-field">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(prev => ({ ...prev, confirm: e.target.value }))}
                    minLength={6}
                    required
                  />
                </div>
                <button type="submit" className="md-change-pw-btn" disabled={pwLoading}>
                  {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default MemberDashboard;
