const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./config/database');
// Import models to establish relationships
require('./models');

// Load environment variables
dotenv.config();

// Handle uncaught exceptions and unhandled promise rejections
// In production/Railway, log but don't exit to allow Railway to handle restarts
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // In Railway/production, let the process manager handle restarts
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // In Railway/production, let the process manager handle restarts
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - explicitly allow localhost:8081 for Expo web
// In Railway, allow all origins by default or use CORS_ORIGIN env var
const isRailway = process.env.RAILWAY_ENVIRONMENT || 
                 process.env.RAILWAY || 
                 process.env.RAILWAY_SERVICE_NAME ||
                 (process.env.PORT && process.env.PORT !== '3000');

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : isRailway 
    ? ['*'] // Railway: allow all by default
    : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000', '*'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // If wildcard is in allowed origins, allow all
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.headers.authorization ? '[AUTH]' : '[NO AUTH]');
    next();
  });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/apartments', require('./routes/apartments'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/escrow', require('./routes/escrow'));
app.use('/api/email', require('./routes/email'));

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }
  
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  let dbConnected = false;
  
  // Try to connect to database, but don't fail if it's not available
  // This ensures the server can start even if database is not ready
  try {
    if (!sequelize) {
      console.warn('⚠️  Sequelize instance not initialized');
      console.warn('⚠️  Database connection will be skipped');
    } else {
      await sequelize.authenticate();
      console.log('✅ Database connection established');
      dbConnected = true;

      // Sync database (create tables if they don't exist)
      // In production, use migrations instead
      // On Railway, allow sync for initial setup (can be disabled later)
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || 
                       process.env.RAILWAY === 'true' ||
                       process.env.RAILWAY_SERVICE_NAME ||
                       (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway'));
      const shouldSync = process.env.NODE_ENV !== 'production' || 
                        process.env.RAILWAY_SYNC_DB === 'true' ||
                        (isRailway && process.env.RAILWAY_SYNC_DB !== 'false');
      
      if (shouldSync && dbConnected) {
        try {
          await sequelize.sync({ alter: true });
          console.log('✅ Database synced');
        } catch (syncError) {
          console.warn('⚠️  Database sync warning:', syncError.message);
          // Don't fail startup if sync has issues
        }
      } else if (!dbConnected) {
        console.log('ℹ️  Database sync skipped (database not connected)');
      } else {
        console.log('ℹ️  Database sync skipped (production mode)');
      }
    }
  } catch (dbError) {
    console.warn('⚠️  Database connection failed:', dbError.message);
    console.warn('⚠️  Server will start but database-dependent endpoints will not work');
    console.warn('⚠️  To fix: Install/start PostgreSQL or update DATABASE_URL in .env');
    console.warn('');
    dbConnected = false;
  }

  // Start server even if database is not connected
  // This allows health checks and testing without database
  // Railway provides PORT automatically, bind to 0.0.0.0 to accept connections
  const host = '0.0.0.0';
  
  app.listen(PORT, host, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Detect Railway environment
    const isRailway = process.env.RAILWAY_ENVIRONMENT || 
                     process.env.RAILWAY || 
                     process.env.RAILWAY_SERVICE_NAME ||
                     (process.env.PORT && process.env.PORT !== '3000'); // Railway sets dynamic PORT
    
    if (isRailway) {
      console.log(`🌐 Railway deployment detected`);
      console.log(`   - Port: ${PORT}`);
      console.log(`   - Public URL: Check Railway dashboard for domain`);
    } else {
      console.log(`🌐 Accessible at:`);
      console.log(`   - http://localhost:${PORT} (local)`);
      console.log(`   - http://10.0.2.2:${PORT} (Android emulator)`);
      console.log(`   - http://[your-ip]:${PORT} (devices on same network)`);
    }
    
    console.log('');
    if (!dbConnected) {
      console.log('⚠️  DATABASE STATUS: Not connected');
      console.log('⚠️  Some endpoints may not work until PostgreSQL is available');
      if (isRailway) {
        console.log('⚠️  Make sure PostgreSQL service is added and connected in Railway');
      }
    } else {
      console.log('✅ DATABASE STATUS: Connected');
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      console.error('   Please stop the other process or use a different port');
    } else {
      console.error('❌ Server startup error:', err);
      console.error('Error details:', err.message);
    }
    // In Railway, let it restart automatically
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
  });
};

startServer();

module.exports = app;

