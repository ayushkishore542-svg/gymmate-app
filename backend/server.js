const dotenv    = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });

const express        = require('express');
const mongoose       = require('mongoose');
const cors           = require('cors');
const path           = require('path');
const rateLimit      = require('express-rate-limit');
const helmet         = require('helmet');
const mongoSanitize  = require('express-mongo-sanitize');

// Import routes
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const visitorRoutes = require('./routes/visitors');
const noticeRoutes        = require('./routes/notices');
const subscriptionRoutes  = require('./routes/subscriptions');
const webhookRoutes       = require('./routes/webhooks');

// Calorie Tracker routes
const calorieSubscriptionRoutes = require('./routes/calorieSubscription');
const calorieFoodsRoutes         = require('./routes/calorieFoods');
const calorieMealsRoutes         = require('./routes/calorieMeals');
const calorieSavedMealsRoutes    = require('./routes/calorieSavedMeals');
const calorieWaterRoutes         = require('./routes/calorieWater');
const calorieSettingsRoutes      = require('./routes/calorieSettings');
const calorieProgressRoutes      = require('./routes/calorieProgress');
const calorieLeaderboardRoutes   = require('./routes/calorieLeaderboard');

// Import cron jobs
const {
  checkExpiredMemberships,
  checkExpiredSubscriptions,
  sendMembershipReminders,
  calculateLeaderboards
} = require('./utils/cronJobs');

// Initialize app
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// Hide Express from response headers
app.disable('x-powered-by');

// Allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://10.44.75.138:3000',
  'https://gymmate-app.vercel.app',
  // Add production domain when ready:
  // 'https://yourdomain.com',
  // 'https://www.yourdomain.com',
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'CORS policy: This origin is not allowed';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ── Raw body capture for Razorpay webhook signature verification ──────────
// Must come BEFORE express.json(). Saves raw buffer to req.rawBody.
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = req.body; // req.body is a Buffer here due to express.raw()
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize({ replaceWith: '_' }));

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  message: 'Too many login attempts, try again later.',
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// Middleware references (already required as authMiddleware in routes,
// but applied globally here for subscriptionGuard)
const authMiddleware    = require('./middleware/auth');
const subscriptionGuard = require('./middleware/subscriptionGuard');

// ── Public / unguarded routes ──────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/webhooks',      webhookRoutes);       // no auth — Razorpay calls this directly
app.use('/api/subscriptions', subscriptionRoutes);  // needs auth, but NOT subscription guard

// ── Owner-side data routes — guarded by auth + subscription status ─────────
// subscriptionGuard checks req.user (set by authMiddleware inside each route)
// and returns 403 { subscriptionRequired: true } if trial expired / cancelled.
// Members pass through the guard automatically (role check inside guard).
// authMiddleware runs first to populate req.user, then subscriptionGuard checks status.
// Individual route handlers also call authMiddleware (by design in each route file)
// — that's acceptable redundancy vs. refactoring every route.
app.use('/api/members',    authMiddleware, subscriptionGuard, memberRoutes);
app.use('/api/attendance', authMiddleware, subscriptionGuard, attendanceRoutes);
app.use('/api/payments',   authMiddleware, subscriptionGuard, paymentRoutes);
app.use('/api/visitors',   authMiddleware, subscriptionGuard, visitorRoutes);
app.use('/api/notices',    authMiddleware, subscriptionGuard, noticeRoutes);

// Calorie Tracker routes (under /api/calorie/*)
app.use('/api/calorie/subscription', calorieSubscriptionRoutes);
app.use('/api/calorie/foods',        calorieFoodsRoutes);
app.use('/api/calorie/meals',        calorieMealsRoutes);
app.use('/api/calorie/saved-meals',  calorieSavedMealsRoutes);
app.use('/api/calorie/water',        calorieWaterRoutes);
app.use('/api/calorie/settings',     calorieSettingsRoutes);
app.use('/api/calorie/progress',     calorieProgressRoutes);
app.use('/api/calorie/leaderboard',  calorieLeaderboardRoutes);

// Serve uploaded progress photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'GymMate API is running',
    timestamp: new Date().toISOString()
  });
});

// Block undefined schema paths from being saved
mongoose.set('strictQuery', true);

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: 'admin',
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ Connected to MongoDB');

  // Start cron jobs
  console.log('🕐 Starting cron jobs...');
  checkExpiredMemberships.start();
  checkExpiredSubscriptions.start();
  sendMembershipReminders.start();
  calculateLeaderboards.start();
  console.log('✅ Cron jobs started');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// Production error handler — hide stack traces from clients
if (process.env.NODE_ENV === 'production') {
  app.use((err, req, res, next) => {
    console.error(err.stack); // Log internally only
    res.status(err.status || 500).json({
      message: 'Something went wrong',
      // Never expose error details in production!
    });
  });
} else {
  // Development — show full errors
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
      message: err.message,
      error: err,
    });
  });
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 GymMate server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
