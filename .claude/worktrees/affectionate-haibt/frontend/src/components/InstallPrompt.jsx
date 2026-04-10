import React, { useState, useEffect } from 'react';
import './InstallPrompt.css';

/**
 * "Add to Home Screen" banner for PWA install prompt.
 * - On Android/Chrome: uses the beforeinstallprompt event.
 * - On iOS/Safari: shows a manual instruction banner (no native prompt).
 * - Respects user dismissal (stored in localStorage for 30 days).
 */
const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow]                     = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const daysAgo = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysAgo < 30) return; // respect 30-day snooze
    }

    // Detect iOS standalone check (already installed)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return; // already installed

    if (ios) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Android / Chrome
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install GymMate app">
      <div className="install-prompt__icon">💪</div>
      <div className="install-prompt__body">
        <p className="install-prompt__title">Install GymMate</p>
        {isIOS ? (
          <p className="install-prompt__desc">
            Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install.
          </p>
        ) : (
          <p className="install-prompt__desc">
            Add to your home screen for quick access — works offline too!
          </p>
        )}
      </div>
      <div className="install-prompt__actions">
        {!isIOS && (
          <button className="install-prompt__btn install-prompt__btn--primary" onClick={handleInstall}>
            Install
          </button>
        )}
        <button className="install-prompt__btn install-prompt__btn--dismiss" onClick={handleDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
