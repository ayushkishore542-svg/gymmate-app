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
const noticeRoutes = require('./routes/notices');

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/notices', noticeRoutes);

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
