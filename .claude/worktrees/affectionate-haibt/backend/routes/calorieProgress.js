const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');

const authMiddleware           = require('../middleware/auth');
const checkCalorieSubscription = require('../middleware/checkCalorieSubscription');
const ProgressPhoto            = require('../models/ProgressPhoto');

router.use(authMiddleware, checkCalorieSubscription);

// ── Multer setup ──────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'progress');

// Ensure uploads directory exists at startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum
  },
  fileFilter: (_req, file, cb) => {
    // Only allow images
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ymToLabel = (ym) => {
  const [y, m] = ym.split('-');
  const date   = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

// ── POST /upload ──────────────────────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const userId  = req.user.id;
    const ym      = currentYM();
    const { weight, notes } = req.body;

    // Build public URL path (served as /uploads/progress/<filename>)
    const imageUrl = `/uploads/progress/${req.file.filename}`;

    // Upsert: find or create the user's progress document
    let doc = await ProgressPhoto.findOne({ user_id: userId });

    if (!doc) {
      doc = new ProgressPhoto({ user_id: userId, photos: [] });
    }

    // 1-per-month check
    const exists = doc.photos.find(p => p.year_month === ym);
    if (exists) {
      // Delete the newly uploaded file — we won't use it
      fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        message: `You've already uploaded a progress photo for ${ymToLabel(ym)}.`
      });
    }

    const entry = {
      month:      ymToLabel(ym),
      year_month: ym,
      image_url:  imageUrl,
      weight:     weight ? parseFloat(weight) : undefined,
      notes:      notes  || '',
      uploaded_at: new Date()
    };

    doc.photos.push(entry);
    await doc.save();

    const saved = doc.photos[doc.photos.length - 1];
    res.status(201).json({ photo: saved });

  } catch (err) {
    // Clean up uploaded file on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Progress upload error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// ── GET / ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const doc = await ProgressPhoto.findOne({ user_id: req.user.id });
    if (!doc) return res.json({ photos: [], uploaded_this_month: false });

    // Sort newest first
    const sorted = [...doc.photos].sort((a, b) =>
      b.year_month.localeCompare(a.year_month)
    );

    const ym = currentYM();
    const uploaded_this_month = doc.photos.some(p => p.year_month === ym);

    res.json({ photos: sorted, uploaded_this_month });
  } catch (err) {
    console.error('Progress fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch progress photos' });
  }
});

module.exports = router;
