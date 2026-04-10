import React, { useState } from 'react';
import QrReader from 'react-qr-scanner';
import { attendanceAPI } from '../utils/api';
import SuccessAnimation from '../animations/SuccessAnimation';
import './AttendanceScanner.css';

const AttendanceScanner = ({ user }) => {
  const [scanning, setScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [recentAttendance, setRecentAttendance] = useState(null);

  const handleScan = async (data) => {
    if (data && !showSuccess) {
      try {
        const qrData = JSON.parse(data.text);
        
        if (qrData.type === 'attendance' && qrData.gymId) {
          // Mark attendance
          const response = await attendanceAPI.checkIn({
            memberId: user.id,
            gymId: qrData.gymId
          });

          setRecentAttendance(response.data.attendance);
          setSuccessMessage(`Welcome ${user.name}! ✨`);
          setShowSuccess(true);
          setScanning(false);
          setError('');
        } else {
          setError('Invalid QR code. Please scan your gym\'s QR code.');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to mark attendance. Please try again.');
        setScanning(false);
      }
    }
  };

  const handleError = (err) => {
    console.error('QR Scanner error:', err);
    setError('Camera access denied or error occurred');
  };

  const handleCheckOut = async () => {
    try {
      await attendanceAPI.checkOut({ memberId: user.id });
      setSuccessMessage('Checked out successfully! 👋');
      setShowSuccess(true);
      setRecentAttendance(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check out');
    }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        <h2>📱 Scan QR Code</h2>
        <p className="scanner-subtitle">Scan your gym's QR code to mark attendance</p>

        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {!scanning && !recentAttendance && (
          <div className="scanner-placeholder">
            <div className="qr-icon">📷</div>
            <button
              className="scan-button"
              onClick={() => {
                setScanning(true);
                setError('');
              }}
            >
              Start Scanning
            </button>
          </div>
        )}

        {scanning && (
          <div className="qr-reader-container">
            <QrReader
              delay={300}
              onError={handleError}
              onScan={handleScan}
              style={{ width: '100%' }}
              constraints={{
                video: { facingMode: 'environment' }
              }}
            />
            <button
              className="cancel-scan-button"
              onClick={() => setScanning(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {recentAttendance && (
          <div className="attendance-success">
            <div className="success-icon">✅</div>
            <h3>Attendance Marked!</h3>
            <p className="check-in-time">
              Check-in: {new Date(recentAttendance.checkInTime).toLocaleTimeString()}
            </p>
            <button
              className="checkout-button"
              onClick={handleCheckOut}
            >
              Check Out
            </button>
          </div>
        )}

        {/* Attendance History */}
        <div className="attendance-info">
          <h3>Recent Activity</h3>
          <div className="info-stats">
            <div className="stat-item">
              <span className="stat-label">This Month</span>
              <span className="stat-value">--</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">--</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Animation */}
      {showSuccess && (
        <SuccessAnimation
          message={successMessage}
          onComplete={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
};

export default AttendanceScanner;
