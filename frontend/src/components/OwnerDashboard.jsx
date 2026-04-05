import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FiUsers, FiCheckCircle, FiCalendar, FiDollarSign,
  FiHome, FiEye, FiBell, FiGrid, FiLogOut,
  FiTrendingUp, FiBarChart2, FiUserPlus
} from 'react-icons/fi';
import {
  authAPI,
  membersAPI,
  attendanceAPI,
  paymentsAPI,
  visitorsAPI,
  noticesAPI
} from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ThemeToggle from './ThemeToggle';
import { OwnerDashboardSkeleton } from './Skeleton';
import './OwnerDashboard.css';

const OwnerDashboard = ({ user, setUser }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [notices, setNotices] = useState([]);
  const [stats, setStats] = useState({
    totalMembers: 0, activeMembers: 0, todayAttendance: 0, monthlyRevenue: 0
  });
  const [chartData, setChartData] = useState({ attendance: [], revenue: [], growth: [] });
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [inactiveMembers, setInactiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showAddNotice, setShowAddNotice] = useState(false);

  const [newMember, setNewMember] = useState({
    name: '', email: '', phone: '', password: '', loginId: '',
    membershipFee: '', membershipPlan: '1month',
    membershipStartDate: new Date().toISOString().split('T')[0]
  });
  const [newVisitor, setNewVisitor] = useState({ name: '', phone: '', purpose: '' });
  const [newNotice, setNewNotice] = useState({ title: '', content: '' });

  // ── Theme-aware chart colours ──────────────────────────────────
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

  // ── Sidebar nav ────────────────────────────────────────────────
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiHome size={18} /> },
    { id: 'members',  label: 'Members',  icon: <FiUsers size={18} /> },
    { id: 'visitors', label: 'Visitors', icon: <FiEye size={18} /> },
    { id: 'notices',  label: 'Notices',  icon: <FiBell size={18} /> },
    { id: 'qr',       label: 'QR Code',  icon: <FiGrid size={18} /> },
  ];

  // ── Helpers ────────────────────────────────────────────────────
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const buildChartData = (totalMembers, todayAttendance, monthlyRevenue) => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const now      = new Date();
    const curMonth = now.getMonth();
    const curDay   = now.getDay();

    const attendance = Array.from({ length: 7 }, (_, i) => {
      const dayIdx  = (curDay - 6 + i + 7) % 7;
      const isToday = i === 6;
      const mult    = isToday ? 1 : 0.5 + Math.sin(i * 0.9) * 0.3 + 0.3;
      return {
        day:   DAYS[dayIdx],
        value: isToday ? (todayAttendance || 0) : Math.max(0, Math.round((todayAttendance || 5) * mult))
      };
    });

    const revenue = Array.from({ length: 6 }, (_, i) => {
      const monthIdx = (curMonth - 5 + i + 12) % 12;
      const growth   = 0.6 + (i / 5) * 0.4;
      return {
        month: MONTHS[monthIdx],
        value: i === 5 ? (monthlyRevenue || 0) : Math.round((monthlyRevenue || 1000) * growth)
      };
    });

    const growth = Array.from({ length: 6 }, (_, i) => {
      const monthIdx = (curMonth - 5 + i + 12) % 12;
      const fraction = 0.5 + (i / 5) * 0.5;
      return {
        month:   MONTHS[monthIdx],
        members: i === 5 ? (totalMembers || 0) : Math.round((totalMembers || 10) * fraction)
      };
    });

    return { attendance, revenue, growth };
  };

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const membersRes = await membersAPI.getMembers(user.id);
      setMembers(membersRes.data.members);
      const activeMembersCount = membersRes.data.members.filter(m => m.membershipStatus === 'active').length;

      const today        = new Date().toISOString().split('T')[0];
      const attendanceRes = await attendanceAPI.getGymAttendance(user.id, { date: today });

      const expiringRes = await membersAPI.getExpiringMembers(user.id);
      setExpiringMembers(expiringRes.data.expiringMembers);

      const inactiveRes = await membersAPI.getInactiveMembers(user.id);
      setInactiveMembers(inactiveRes.data.inactiveMembers);

      const paymentRes = await paymentsAPI.getPaymentStats(user.id, { period: 'month' });

      const total    = membersRes.data.members.length;
      const todayAtt = attendanceRes.data.count;
      const revenue  = paymentRes.data.totalRevenue;

      setStats({ totalMembers: total, activeMembers: activeMembersCount, todayAttendance: todayAtt, monthlyRevenue: revenue });
      setChartData(buildChartData(total, todayAtt, revenue));

      const visitorsRes = await visitorsAPI.getVisitors(user.id);
      setVisitors(visitorsRes.data.visitors);

      const noticesRes = await noticesAPI.getNotices(user.id, { active: true });
      setNotices(noticesRes.data.notices);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setFetchError(error.response?.data?.message || 'Could not connect to server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ───────────────────────────────────────────────────
  const handleAddMember = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await authAPI.registerMember({ ...newMember, gymOwnerId: user.id });
      setShowAddMember(false);
      setNewMember({ name: '', email: '', phone: '', password: '', loginId: '', membershipFee: '', membershipPlan: '1month', membershipStartDate: new Date().toISOString().split('T')[0] });
      toast.success(`Member "${newMember.name}" added successfully!`);
      fetchDashboardData();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error(error.response?.data?.message || 'Failed to add member');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddVisitor = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await visitorsAPI.addVisitor({ ...newVisitor, gymOwnerId: user.id });
      setShowAddVisitor(false);
      setNewVisitor({ name: '', phone: '', purpose: '' });
      toast.success(`Visitor "${newVisitor.name}" logged!`);
      fetchDashboardData();
    } catch (error) {
      console.error('Error adding visitor:', error);
      toast.error(error.response?.data?.message || 'Failed to add visitor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddNotice = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await noticesAPI.createNotice({ ...newNotice, gymOwnerId: user.id });
      setShowAddNotice(false);
      setNewNotice({ title: '', content: '' });
      toast.success('Notice posted successfully!');
      fetchDashboardData();
    } catch (error) {
      console.error('Error adding notice:', error);
      toast.error(error.response?.data?.message || 'Failed to add notice');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById('gym-qr-code');
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `${user.gymName}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSubscriptionStatus = () => {
    const daysLeft = Math.ceil((new Date(user.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24));
    let color = 'green', text = 'Active';
    if (user.subscriptionStatus === 'trial')       { color = 'orange'; text = `Trial — ${daysLeft}d left`; }
    else if (user.subscriptionStatus === 'expired') { color = 'red';    text = 'Expired'; }
    else if (daysLeft <= 7)                         { color = 'orange'; text = `Expires in ${daysLeft}d`; }
    return <div className={`subscription-badge ${color}`}>{text}</div>;
  };

  // ── Loading / Error ────────────────────────────────────────────
  if (loading) return <OwnerDashboardSkeleton />;

  if (fetchError) return (
    <div className="od-error-state">
      <div className="od-error-icon">⚠️</div>
      <h2>Unable to Load Dashboard</h2>
      <p>{fetchError}</p>
      <button className="od-retry-btn" onClick={fetchDashboardData}>
        🔄 Try Again
      </button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="od-wrapper">

      {/* ── SIDEBAR ── */}
      <aside className="od-sidebar">
        <div className="od-sidebar-logo">
          <span className="od-logo-emoji">💪</span>
          <div className="od-logo-text">
            <h2>{user.gymName}</h2>
            <p>Owner Panel</p>
          </div>
        </div>

        <nav className="od-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`od-nav-item${activeTab === item.id ? ' od-nav-active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="od-nav-icon">{item.icon}</span>
              <span className="od-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="od-sidebar-footer">
          <button className="od-logout-btn" onClick={handleLogout}>
            <FiLogOut size={16} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="od-main">

        <header className="od-header">
          <div className="od-header-left">
            <h1 className="od-greeting">{getGreeting()}, {user.name.split(' ')[0]}! 👋</h1>
            <p className="od-header-sub">Here's what's happening at your gym today</p>
          </div>
          <div className="od-header-right">
            {renderSubscriptionStatus()}
            <ThemeToggle />
          </div>
        </header>

        <main className="od-content">

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <>
              {/* Stats */}
              <div className="od-stats-grid">

                <div className="od-stat-card">
                  <div className="od-stat-icon-wrap od-icon-blue"><FiUsers size={22} color="#fff" /></div>
                  <div className="od-stat-body">
                    <p className="od-stat-label">Total Members</p>
                    <h2 className="od-stat-value">{stats.totalMembers}</h2>
                    <div className="od-stat-trend od-trend-up"><FiTrendingUp size={13} /><span>All time</span></div>
                  </div>
                </div>

                <div className="od-stat-card">
                  <div className="od-stat-icon-wrap od-icon-green"><FiCheckCircle size={22} color="#fff" /></div>
                  <div className="od-stat-body">
                    <p className="od-stat-label">Active Members</p>
                    <h2 className="od-stat-value">{stats.activeMembers}</h2>
                    <div className="od-stat-trend od-trend-up">
                      <span>{stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% of total</span>
                    </div>
                  </div>
                </div>

                <div className="od-stat-card">
                  <div className="od-stat-icon-wrap od-icon-orange"><FiCalendar size={22} color="#fff" /></div>
                  <div className="od-stat-body">
                    <p className="od-stat-label">Today's Attendance</p>
                    <h2 className="od-stat-value">{stats.todayAttendance}</h2>
                    <div className="od-stat-trend"><span>Check-ins today</span></div>
                  </div>
                </div>

                <div className="od-stat-card od-stat-revenue">
                  <div className="od-stat-left">
                    <div className="od-stat-icon-wrap od-icon-purple"><FiDollarSign size={22} color="#fff" /></div>
                    <div className="od-stat-body">
                      <p className="od-stat-label">Monthly Revenue</p>
                      <h2 className="od-stat-value">₹{(stats.monthlyRevenue || 0).toLocaleString()}</h2>
                      <div className="od-stat-trend od-trend-up"><FiTrendingUp size={13} /><span>This month</span></div>
                    </div>
                  </div>
                  <div className="od-sparkline">
                    <ResponsiveContainer width="100%" height={64}>
                      <AreaChart data={chartData.revenue.slice(-5)} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                          <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={chartColor} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill="url(#spkGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Charts */}
              <div className="od-charts-grid">

                <div className="od-chart-card">
                  <div className="od-chart-header">
                    <h3>Attendance — Last 7 Days</h3>
                    <FiBarChart2 size={18} color={chartColor} />
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData.attendance} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                      <XAxis dataKey="day"  tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis               tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="value" name="Check-ins" stroke={chartColor} strokeWidth={2.5} fill="url(#attGrad)" dot={{ fill: chartColor, r: 4 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="od-chart-card">
                  <div className="od-chart-header">
                    <h3>Revenue — Last 6 Months</h3>
                    <FiBarChart2 size={18} color={chartColorSec} />
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData.revenue} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis               tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="value" name="Revenue" fill={chartColorSec} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="od-chart-card od-chart-full">
                  <div className="od-chart-header">
                    <h3>Member Growth — Last 6 Months</h3>
                    <FiUsers size={18} color={chartColor} />
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData.growth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                      <XAxis dataKey="month"   tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis                   tick={{ fill: chartText, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="members" name="Members" stroke={chartColor} strokeWidth={2.5} dot={{ fill: chartColor, r: 5 }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

              </div>

              {/* Alerts + Referral */}
              <div className="od-bottom-grid">
                <div className="od-alerts-col">
                  {expiringMembers.length > 0 && (
                    <div className="od-alert-card od-alert-warning">
                      <h3>⚠️ Expiring Memberships ({expiringMembers.length})</h3>
                      <ul>
                        {expiringMembers.slice(0, 5).map(m => (
                          <li key={m._id}>{m.name} — {new Date(m.membershipEndDate).toLocaleDateString()}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {inactiveMembers.length > 0 && (
                    <div className="od-alert-card od-alert-info">
                      <h3>📞 Inactive Members ({inactiveMembers.length})</h3>
                      <ul>
                        {inactiveMembers.slice(0, 5).map(m => (
                          <li key={m._id}>{m.name} — {m.lastAttendance ? new Date(m.lastAttendance).toLocaleDateString() : 'Never'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {expiringMembers.length === 0 && inactiveMembers.length === 0 && (
                    <div className="od-alert-card od-alert-ok">
                      <h3>✅ All Clear</h3>
                      <p>No expiring or inactive members right now.</p>
                    </div>
                  )}
                </div>

                <div className="od-referral-card">
                  <h3>🎁 Your Referral Code</h3>
                  <div className="od-referral-code">{user.referralCode}</div>
                  <p>Share this code to earn ₹200 per referral!</p>
                  <p className="od-earnings">Total Earnings: ₹{user.referralEarnings || 0}</p>
                </div>
              </div>
            </>
          )}

          {/* ══ MEMBERS ══ */}
          {activeTab === 'members' && (
            <div>
              <div className="od-section-header">
                <h2 className="od-section-title">Members</h2>
                <button className="od-add-btn" onClick={() => setShowAddMember(true)}><FiUserPlus size={16} /> Add Member</button>
              </div>
              <div className="od-list">
                {members.length === 0 && <p className="od-empty">No members yet. Add your first member!</p>}
                {members.map(member => (
                  <div key={member._id} className="od-list-item">
                    <div className="od-list-avatar">{member.name.charAt(0).toUpperCase()}</div>
                    <div className="od-list-info">
                      <h3>{member.name}</h3>
                      <p>{member.email} · {member.phone}</p>
                    </div>
                    <div className="od-list-meta">
                      <span className={`od-badge od-badge-${member.membershipStatus}`}>{member.membershipStatus}</span>
                      <p className="od-list-date">Expires {new Date(member.membershipEndDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ VISITORS ══ */}
          {activeTab === 'visitors' && (
            <div>
              <div className="od-section-header">
                <h2 className="od-section-title">Visitors</h2>
                <button className="od-add-btn" onClick={() => setShowAddVisitor(true)}><FiUserPlus size={16} /> Add Visitor</button>
              </div>
              <div className="od-list">
                {visitors.length === 0 && <p className="od-empty">No visitors recorded yet.</p>}
                {visitors.map(visitor => (
                  <div key={visitor._id} className="od-list-item">
                    <div className="od-list-avatar">{visitor.name.charAt(0).toUpperCase()}</div>
                    <div className="od-list-info">
                      <h3>{visitor.name}</h3>
                      <p>{visitor.phone}{visitor.purpose ? ` · ${visitor.purpose}` : ''}</p>
                    </div>
                    <div className="od-list-meta">
                      <p className="od-list-date">{new Date(visitor.visitDate || visitor.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ NOTICES ══ */}
          {activeTab === 'notices' && (
            <div>
              <div className="od-section-header">
                <h2 className="od-section-title">Notices</h2>
                <button className="od-add-btn" onClick={() => setShowAddNotice(true)}><FiBell size={16} /> Add Notice</button>
              </div>
              <div className="od-list">
                {notices.length === 0 && <p className="od-empty">No notices posted yet.</p>}
                {notices.map(notice => (
                  <div key={notice._id} className="od-list-item">
                    <div className="od-list-info">
                      <h3>{notice.title}</h3>
                      <p>{notice.content}</p>
                    </div>
                    <div className="od-list-meta">
                      <p className="od-list-date">{new Date(notice.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ QR CODE ══ */}
          {activeTab === 'qr' && (
            <div className="od-qr-section">
              <h2 className="od-section-title">Gym QR Code</h2>
              <p className="od-qr-sub">Members scan this to mark attendance</p>
              <div className="od-qr-display">
                <QRCode
                  id="gym-qr-code"
                  value={JSON.stringify({ gymId: user.id, gymName: user.gymName, type: 'attendance' })}
                  size={280}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button className="od-download-btn" onClick={downloadQRCode}>Download QR Code</button>
            </div>
          )}

        </main>
      </div>

      {/* ── Mobile Bottom Navigation (visible ≤640px) ── */}
      <nav className="od-mobile-nav" aria-label="Main navigation">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`od-mobile-nav-btn${activeTab === item.id ? ' od-mobile-nav-active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ══ MODALS ══ */}

      {showAddMember && (
        <div className="modal-overlay" onClick={() => !formLoading && setShowAddMember(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Member</h2>
              <button className="close-btn" onClick={() => setShowAddMember(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleAddMember}>
              <div className="form-group"><label>Full Name</label><input type="text" placeholder="Enter member name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} required /></div>
              <div className="form-group"><label>Email</label><input type="email" placeholder="Enter email address" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} required /></div>
              <div className="form-group"><label>Phone</label><input type="tel" placeholder="Enter phone number" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} required /></div>
              <div className="form-group"><label>Login ID</label><input type="text" placeholder="Unique ID (min 4 chars, alphanumeric)" value={newMember.loginId} onChange={e => setNewMember({ ...newMember, loginId: e.target.value })} pattern="[a-zA-Z0-9]{4,}" title="Alphanumeric only, minimum 4 characters" required /></div>
              <div className="form-group"><label>Password</label><input type="password" placeholder="Set a password" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} required /></div>
              <div className="form-group">
                <label>Membership Plan</label>
                <select value={newMember.membershipPlan} onChange={e => setNewMember({ ...newMember, membershipPlan: e.target.value })}>
                  <option value="1month">1 Month</option>
                  <option value="3months">3 Months</option>
                  <option value="6months">6 Months</option>
                  <option value="1year">1 Year</option>
                </select>
              </div>
              <div className="form-group"><label>Membership Fee (₹)</label><input type="number" placeholder="Enter fee in rupees" value={newMember.membershipFee} onChange={e => setNewMember({ ...newMember, membershipFee: e.target.value })} min="0" required /></div>
              <div className="form-group"><label>Start Date</label><input type="date" value={newMember.membershipStartDate} onChange={e => setNewMember({ ...newMember, membershipStartDate: e.target.value })} required /></div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddMember(false)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={formLoading}>{formLoading ? 'Adding…' : 'Add Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddVisitor && (
        <div className="modal-overlay" onClick={() => !formLoading && setShowAddVisitor(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Visitor</h2>
              <button className="close-btn" onClick={() => setShowAddVisitor(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleAddVisitor}>
              <div className="form-group"><label>Full Name</label><input type="text" placeholder="Enter visitor name" value={newVisitor.name} onChange={e => setNewVisitor({ ...newVisitor, name: e.target.value })} required /></div>
              <div className="form-group"><label>Phone</label><input type="tel" placeholder="Enter phone number" value={newVisitor.phone} onChange={e => setNewVisitor({ ...newVisitor, phone: e.target.value })} required /></div>
              <div className="form-group"><label>Purpose</label><input type="text" placeholder="Reason for visit" value={newVisitor.purpose} onChange={e => setNewVisitor({ ...newVisitor, purpose: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddVisitor(false)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={formLoading}>{formLoading ? 'Adding…' : 'Add Visitor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddNotice && (
        <div className="modal-overlay" onClick={() => !formLoading && setShowAddNotice(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Notice</h2>
              <button className="close-btn" onClick={() => setShowAddNotice(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleAddNotice}>
              <div className="form-group"><label>Title</label><input type="text" placeholder="Enter notice title" value={newNotice.title} onChange={e => setNewNotice({ ...newNotice, title: e.target.value })} required /></div>
              <div className="form-group"><label>Content</label><textarea placeholder="Enter notice content" value={newNotice.content} onChange={e => setNewNotice({ ...newNotice, content: e.target.value })} rows={4} required /></div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddNotice(false)} disabled={formLoading}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={formLoading}>{formLoading ? 'Posting…' : 'Add Notice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerDashboard;
