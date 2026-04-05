import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calorieAPI } from '../utils/api';
import './CalorieTracker.css';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

// ── Upload card (current month, not yet uploaded) ──────────────────────────
function UploadCard({ onUploaded }) {
  const [preview,    setPreview]    = useState(null);   // object URL
  const [file,       setFile]       = useState(null);
  const [weight,     setWeight]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  // Clean up object URL on unmount
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo',  file);
      fd.append('weight', weight);
      fd.append('notes',  notes);
      await calorieAPI.uploadProgress(fd);
      onUploaded?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const thisMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="pp-upload-card">
      <div className="pp-upload-month">{thisMonth}</div>

      {/* File pick zone */}
      {!preview ? (
        <button
          className="pp-pick-zone"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose progress photo"
        >
          <span className="pp-pick-icon">📷</span>
          <span className="pp-pick-label">Tap to choose photo</span>
          <span className="pp-pick-hint">JPEG / PNG / WebP · max 10 MB</span>
        </button>
      ) : (
        <div className="pp-preview-wrap">
          <img src={preview} alt="Preview" className="pp-preview-img" />
          <button
            className="pp-change-btn"
            onClick={() => { setPreview(null); setFile(null); fileRef.current.value = ''; }}
          >
            Change
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Weight + notes — only shown after photo selected */}
      {preview && (
        <>
          <div className="pp-field-row">
            <div className="pp-field">
              <label className="pp-label">Weight (kg)</label>
              <input
                className="pp-input"
                type="number"
                min="20"
                max="300"
                step="0.1"
                placeholder="e.g. 72.5"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
            </div>
            <div className="pp-field" style={{ flex: 2 }}>
              <label className="pp-label">Notes (optional)</label>
              <input
                className="pp-input"
                type="text"
                placeholder="e.g. End of cut phase"
                maxLength={80}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <button
            className="pp-upload-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '⬆️ Save Progress Photo'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Past month card ────────────────────────────────────────────────────────
function PhotoCard({ photo }) {
  const src = `${API_BASE}${photo.image_url}`;
  return (
    <div className="pp-card">
      <img
        src={src}
        alt={`Progress ${photo.month}`}
        className="pp-card-img"
        loading="lazy"
      />
      <div className="pp-card-body">
        <div className="pp-card-month">{photo.month}</div>
        {photo.weight && (
          <div className="pp-card-weight">{photo.weight} kg</div>
        )}
        {photo.notes && (
          <div className="pp-card-notes">{photo.notes}</div>
        )}
      </div>
    </div>
  );
}

// ── Weight delta badge ─────────────────────────────────────────────────────
function WeightDelta({ photos }) {
  // photos are sorted newest-first; need oldest vs newest with weight
  const withWeight = [...photos].filter(p => p.weight).reverse(); // oldest first
  if (withWeight.length < 2) return null;
  const first = withWeight[0].weight;
  const last  = withWeight[withWeight.length - 1].weight;
  const delta = (last - first).toFixed(1);
  const sign  = delta > 0 ? '+' : '';
  const color = delta < 0 ? '#10b981' : delta > 0 ? '#ea5455' : 'var(--text-secondary)';
  return (
    <div className="pp-delta" style={{ color }}>
      {sign}{delta} kg since {withWeight[0].month}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ProgressPhotos({ onClose }) {
  const [photos,           setPhotos]           = useState([]);
  const [uploadedThisMonth, setUploadedThisMonth] = useState(false);
  const [loading,          setLoading]          = useState(true);

  const fetchPhotos = useCallback(async () => {
    try {
      const { data } = await calorieAPI.getProgress();
      setPhotos(data.photos || []);
      setUploadedThisMonth(data.uploaded_this_month);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const pastPhotos = uploadedThisMonth ? photos : photos; // all past when uploaded

  return (
    <div className="ct-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ct-modal pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-title">
        <button className="ct-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="ct-modal-title" id="pp-title">📷 Progress Photos</h2>
        <p className="ct-modal-sub">One photo per month — track your transformation.</p>

        {loading ? (
          <div className="pp-loading">Loading…</div>
        ) : (
          <>
            {/* Weight change summary */}
            {photos.length >= 2 && <WeightDelta photos={photos} />}

            {/* Upload card for current month */}
            {!uploadedThisMonth && (
              <UploadCard onUploaded={() => { setLoading(true); fetchPhotos(); }} />
            )}

            {/* Past photos — horizontal scroll */}
            {pastPhotos.length > 0 && (
              <div className="pp-section">
                <div className="pp-section-title">
                  {uploadedThisMonth ? 'All Photos' : 'Past Months'}
                </div>
                <div className="pp-scroll-row" role="list">
                  {pastPhotos.map(photo => (
                    <div key={photo._id} role="listitem">
                      <PhotoCard photo={photo} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!uploadedThisMonth && pastPhotos.length === 0 && (
              <div className="pp-empty">
                No past photos yet. Upload your first one above!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
