import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import ThemeToggle from './ThemeToggle';
import './Login.css';

const Login = ({ setUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('owner'); // 'owner' or 'member'
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    loginId: '',
    password: '',
    name: '',
    phone: '',
    gymName: '',
    referralCode: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginPayload = { password: formData.password, role: activeTab };
      if (activeTab === 'member') {
        loginPayload.loginId = formData.loginId;
      } else {
        loginPayload.email = formData.email;
      }
      const response = await authAPI.login(loginPayload);

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);

      // Navigate based on role
      if (activeTab === 'owner') {
        navigate('/owner-dashboard');
      } else {
        navigate('/member-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'owner') {
        const response = await authAPI.registerOwner({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          gymName: formData.gymName,
          referralCode: formData.referralCode || undefined
        });

        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        navigate('/owner-dashboard');
      } else {
        setError('Member registration is done by gym owner only');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="theme-toggle-wrap">
          <ThemeToggle />
        </div>
        <div className="login-header">
          <h1>💪 GymMate</h1>
          <p>Smart Gym Management System</p>
        </div>

        {/* Role Selection Tabs */}
        <div className="role-tabs">
          <button
            className={`role-tab ${activeTab === 'owner' ? 'active' : ''}`}
            onClick={() => setActiveTab('owner')}
          >
            Gym Owner
          </button>
          <button
            className={`role-tab ${activeTab === 'member' ? 'active' : ''}`}
            onClick={() => setActiveTab('member')}
          >
            Member
          </button>
        </div>

        {/* Form Type Toggle */}
        <div className="form-toggle">
          <button
            className={`toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            Login
          </button>
          {activeTab === 'owner' && (
            <button
              className={`toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
            >
              Register
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Login Form */}
        {isLogin ? (
          <form onSubmit={handleLogin} className="login-form">
            {activeTab === 'member' ? (
              <div className="form-group">
                <label>Login ID</label>
                <input
                  type="text"
                  name="loginId"
                  value={formData.loginId}
                  onChange={handleChange}
                  required
                  placeholder="Enter your Login ID"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter your email"
                />
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          /* Register Form - Owner Only */
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter your name"
              />
            </div>

            <div className="form-group">
              <label>Gym Name</label>
              <input
                type="text"
                name="gymName"
                value={formData.gymName}
                onChange={handleChange}
                required
                placeholder="Enter gym name"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Create a password"
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label>Referral Code (Optional)</label>
              <input
                type="text"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                placeholder="Enter referral code for discount"
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Registering...' : 'Register (3 Days Free Trial)'}
            </button>
          </form>
        )}

        <div className="login-info">
          {activeTab === 'member' && (
            <p className="info-text">
              Members are registered by their gym owner. Please contact your gym to get login credentials.
            </p>
          )}
          {activeTab === 'owner' && !isLogin && (
            <p className="info-text">
              Get 3 days free trial! Monthly subscription: ₹700
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
