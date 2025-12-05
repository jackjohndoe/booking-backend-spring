const { Sequelize } = require('sequelize');
require('dotenv').config();

// Parse DATABASE_URL if provided, otherwise use individual config
let sequelize;

// Validate DATABASE_URL before using it
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && databaseUrl.trim() !== '') {
  // Validate URL format
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.error('❌ Invalid DATABASE_URL format. Must start with postgresql:// or postgres://');
    console.error('Current DATABASE_URL:', databaseUrl.substring(0, 20) + '...');
  } else {
    try {
      // Parse DATABASE_URL format: postgresql://user:password@host:port/database
      // Railway and Supabase require SSL connections in production
      const isSupabase = databaseUrl.includes('supabase.co');
      // Detect Railway - check multiple indicators
      const isRailway = databaseUrl.includes('railway.app') || 
                       databaseUrl.includes('railway.internal') ||
                       databaseUrl.includes('railway.tech') ||
                       databaseUrl.includes('railway') ||
                       process.env.RAILWAY_ENVIRONMENT === 'true' ||
                       process.env.RAILWAY === 'true' ||
                       process.env.RAILWAY_SERVICE_NAME;
      
      // Railway PostgreSQL requires SSL in production
      const needsSSL = process.env.NODE_ENV === 'production' || isSupabase || isRailway;
      
      if (isRailway && process.env.NODE_ENV === 'development') {
        console.log('🔍 Railway database detected - SSL will be enabled');
      }
      
      sequelize = new Sequelize(databaseUrl, {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        dialectOptions: {
          ssl: needsSSL ? {
            require: true,
            rejectUnauthorized: false
          } : false
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      });
    } catch (error) {
      console.error('❌ Error creating Sequelize instance:', error.message);
      console.error('DATABASE_URL might be malformed');
      sequelize = null;
    }
  }
}

// If DATABASE_URL was not set or invalid, use individual config
if (!sequelize) {
  console.log('⚠️  Using individual database config (DATABASE_URL not set or invalid)');
  try {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'booking_db',
      process.env.DB_USER || 'user',
      process.env.DB_PASSWORD || 'password',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        // Add connection timeout for Railway
        dialectOptions: {
          connectTimeout: 10000
        }
      }
    );
  } catch (error) {
    console.error('❌ Error creating Sequelize instance with individual config:', error.message);
    sequelize = null;
  }
}

module.exports = { sequelize };





