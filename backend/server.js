const dotenv = require('dotenv');
dotenv.config({ path: `${__dirname}/.env` });
console.log('ROUTES CHECK:', {
  auth: typeof require('./routes/auth'),
  webhooks: typeof require('./routes/webhooks'),
  subscriptions: typeof require('./routes/subscriptions'),
  members: typeof require('./routes/members'),
  attendance: typeof require('./routes/attendance'),
  payments: typeof require('./routes/payments'),
  visitors: typeof require('./routes/visitors'),
  notices: typeof require('./routes/notices'),
  dashboard: typeof require('./routes/dashboard'),
  todos: typeof require('./routes/todos'),
  expenses: typeof require('./routes/expenses'),
  settings: typeof require('./routes/settings'),
  exports: typeof require('./routes/exports'),
});

const { validateEnv } = require('./utils/env');
const { logger } = require('./utils/logger');
const { initFirebaseAdmin } = require('./utils/firebaseAdmin');

try {
  validateEnv();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(e.message);
  process.exit(1);
}

initFirebaseAdmin();

const express        = require('express');
const mongoose       = require('mongoose');
const cors           = require('cors');
const path           = require('path');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const helmet         = require('helmet');
const mongoSanitize  = require('express-mongo-sanitize');
const hpp            = require('hpp');
const xss            = require('xss-clean');
const morgan         = require('morgan');

// Migrations
const migrateLoginIds = require('./scripts/migrateLoginIds');

// Import routes
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const visitorRoutes = require('./routes/visitors');
const noticeRoutes        = require('./routes/notices');
const subscriptionRoutes  = require('./routes/subscriptions');
const webhookRoutes       = require('./routes/webhooks');
const dashboardRoutes     = require('./routes/dashboard');
const todoRoutes          = require('./routes/todos');
const expenseRoutes       = require('./routes/expenses');
const settingsRoutes      = require('./routes/settings');
const exportRoutes        = require('./routes/exports');
const staffRoutes         = require('./routes/staff');
const workoutPlanRoutes   = require('./routes/workoutPlans');
const batchRoutes         = require('./routes/batches');
const inventoryRoutes     = require('./routes/inventory');
const feedbackRoutes      = require('./routes/feedback');
const referralRoutes      = require('./routes/referrals');
const walletRoutes        = require('./routes/wallet');
const supportRoutes       = require('./routes/support');
const gamificationRoutes  = require('./routes/gamification');
const ownerRoutes         = require('./routes/owner');

// Calorie Tracker routes
const calorieSubscriptionRoutes = require('./routes/calorieSubscription');
const calorieFoodsRoutes         = require('./routes/calorieFoods');
const calorieMealsRoutes         = require('./routes/calorieMeals');
const calorieSavedMealsRoutes    = require('./routes/calorieSavedMeals');
const calorieWaterRoutes         = require('./routes/calorieWater');
const calorieSettingsRoutes      = require('./routes/calorieSettings');
const calorieProgressRoutes      = require('./routes/calorieProgress');
const calorieLeaderboardRoutes   = require('./routes/calorieLeaderboard');

// In-App Purchase (Google Play) verification
const iapRoutes = require('./routes/iap');

// Import cron jobs
const {
  checkExpiredMemberships,
  checkExpiredSubscriptions,
  sendMembershipReminders,
  calculateLeaderboards,
  autoCloseStaleCheckIns,
  expireWalletCredits,
  gamificationDailyJob,
  gamificationMonthlyReset,
  inactiveMemberAlerts,
} = require('./utils/cronJobs');

const app = express();
app.set('trust proxy', 1);

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
  crossOriginEmbedderPolicy: false,
}));
app.use(helmet.noSniff());
app.use(helmet.hidePoweredBy());
app.disable('x-powered-by');

// Allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://10.44.75.138:3000',
  'https://gymmate-app.vercel.app',
  'https://gymmate-app-production.up.railway.app',
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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize({ replaceWith: '_' }));
app.use(xss());
app.use(hpp());

const rateLimitLog = (req, msg) => {
  logger.warn('rate_limit', { message: msg, ip: req.ip, path: req.originalUrl });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.originalUrl.startsWith('/api/webhooks') ||
    req.originalUrl === '/api/health',
  handler: (req, res, _next, options) => {
    rateLimitLog(req, 'api_general');
    const retry = Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retry));
    res.status(429).json({ message: options.message || 'Too many requests' });
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, _next, options) => {
    rateLimitLog(req, 'login');
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many login attempts, try again later.' });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    rateLimitLog(req, 'register');
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many registration attempts, try again later.' });
  },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const uid = req.user && req.user._id ? req.user._id.toString() : 'anon';
    return `${ipKeyGenerator(req, res)}:${uid}`;
  },
  handler: (req, res, _next, options) => {
    rateLimitLog(req, 'payment');
    res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({ message: 'Too many payment requests' });
  },
});

app.use(morgan('combined', {
  stream: { write: (line) => logger.info(line.trim()) },
}));

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register/owner', registerLimiter);
app.use('/api/auth/register/member', registerLimiter);

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
app.use('/api/payments',   authMiddleware, subscriptionGuard, paymentLimiter, paymentRoutes);
app.use('/api/visitors',   authMiddleware, subscriptionGuard, visitorRoutes);
app.use('/api/notices',    authMiddleware, subscriptionGuard, noticeRoutes);
app.use('/api/dashboard', authMiddleware, subscriptionGuard, dashboardRoutes);
app.use('/api/todos',     authMiddleware, subscriptionGuard, todoRoutes);
app.use('/api/expenses',  authMiddleware, subscriptionGuard, expenseRoutes);
app.use('/api/settings',  authMiddleware, subscriptionGuard, settingsRoutes);
app.use('/api/exports',   authMiddleware, subscriptionGuard, exportRoutes);
app.use('/api/staff',          authMiddleware, subscriptionGuard, staffRoutes);
app.use('/api/workout-plans',  authMiddleware, subscriptionGuard, workoutPlanRoutes);
app.use('/api/batches',        authMiddleware, subscriptionGuard, batchRoutes);
app.use('/api/inventory',      authMiddleware, subscriptionGuard, inventoryRoutes);
app.use('/api/feedback',       authMiddleware, subscriptionGuard, feedbackRoutes);
app.use('/api/referrals',      referralRoutes);   // validate is public; individual routes do own auth
app.use('/api/wallet',         authMiddleware, walletRoutes);
app.use('/api/support',        authMiddleware, subscriptionGuard, supportRoutes);
app.use('/api/gamification',   authMiddleware, gamificationRoutes);
app.use('/api/owner',          authMiddleware, subscriptionGuard, ownerRoutes);

// ── Member feature routes (auth only, no subscription guard — member-side) ───
const memberWorkoutRoutes  = require('./routes/memberWorkouts');
const memberDietRoutes     = require('./routes/memberDiet');
const memberProgressRoutes = require('./routes/memberProgress');
app.use('/api/member-workouts',  authMiddleware, memberWorkoutRoutes);
app.use('/api/member-diet',      authMiddleware, memberDietRoutes);
app.use('/api/member-progress',  authMiddleware, memberProgressRoutes);

// Calorie Tracker routes (under /api/calorie/*)
app.use('/api/calorie/subscription', calorieSubscriptionRoutes);
app.use('/api/calorie/foods',        calorieFoodsRoutes);
app.use('/api/calorie/meals',        calorieMealsRoutes);
app.use('/api/calorie/saved-meals',  calorieSavedMealsRoutes);
app.use('/api/calorie/water',        calorieWaterRoutes);
app.use('/api/calorie/settings',     calorieSettingsRoutes);
app.use('/api/calorie/progress',     calorieProgressRoutes);
app.use('/api/calorie/leaderboard',  calorieLeaderboardRoutes);

// In-App Purchase verification (auth handled inside router)
app.use('/api/iap', iapRoutes);

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
  w: 'majority',
  maxPoolSize: 50,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  logger.info('Connected to MongoDB');

  await migrateLoginIds();

  logger.info('Starting cron jobs');
  checkExpiredMemberships.start();
  checkExpiredSubscriptions.start();
  sendMembershipReminders.start();
  calculateLeaderboards.start();
  autoCloseStaleCheckIns.start();
  expireWalletCredits.start();
  gamificationDailyJob.start();
  gamificationMonthlyReset.start();
  inactiveMemberAlerts.start();
  logger.info('Cron jobs started');
})
.catch((err) => {
  logger.error('MongoDB connection error', { err: err.message });
  process.exit(1);
});

// Production error handler — hide stack traces from clients
if (process.env.NODE_ENV === 'production') {
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', { err: err.message, stack: err.stack });
    res.status(err.status || 500).json({ message: 'Internal server error' });
  });
} else {
  app.use((err, req, res, next) => {
    logger.error(err.message, { stack: err.stack });
    res.status(err.status || 500).json({
      message: err.message,
      error: err,
    });
  });
}

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info('GymMate server listening on port ' + PORT, { env: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown - Railway sends SIGTERM on every redeploy.
// Without this, in-flight requests are dropped and DB connections leak.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received - shutting down gracefully');
  server.close(function() {
    mongoose.connection.close().then(function() {
      logger.info('MongoDB connection closed. Process exiting.');
      process.exit(0);
    });
  });
});

module.exports = app;
