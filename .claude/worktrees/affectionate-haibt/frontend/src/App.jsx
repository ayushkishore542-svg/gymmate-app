import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import OwnerDashboard from './components/OwnerDashboard';
import MemberDashboard from './components/MemberDashboard';
import CalorieTrackerDashboard from './components/CalorieTrackerDashboard';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import InstallPrompt from './components/InstallPrompt';
import './App.css';
import './animations/animations.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <h2>GymMate</h2>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <ToastProvider>
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to={user.role === 'owner' ? '/owner-dashboard' : '/member-dashboard'} />
              ) : (
                <Login setUser={setUser} />
              )
            } 
          />
          
          <Route 
            path="/owner-dashboard" 
            element={
              user && user.role === 'owner' ? (
                <OwnerDashboard user={user} setUser={setUser} />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          
          <Route 
            path="/member-dashboard" 
            element={
              user && user.role === 'member' ? (
                <MemberDashboard user={user} setUser={setUser} />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          
          <Route
            path="/calorie-tracker"
            element={
              user && user.role === 'member' ? (
                <CalorieTrackerDashboard />
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          <Route
            path="/"
            element={
              user ? (
                <Navigate to={user.role === 'owner' ? '/owner-dashboard' : '/member-dashboard'} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </div>
    </Router>
    <InstallPrompt />
    </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
