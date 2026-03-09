const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');
const errorHandler = require('./middleware/errorHandler.middleware');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// API routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  const dbConnected = await testConnection();
  if (dbConnected) {
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      if (process.env.MAIL_CRON_ENABLED !== 'false') {
        const cron = require('node-cron');
        const { runConnectorNoSessionCheck } = require('./services/connector-check.service');
        const minutes = Math.max(1, parseInt(process.env.MAIL_CRON_INTERVAL_MINUTES || '5', 10));
        cron.schedule(`*/${minutes} * * * *`, () => {
          runConnectorNoSessionCheck().catch((err) => console.error('[Cron] runConnectorNoSessionCheck:', err.message));
        });
        console.log(`📧 Mail cron: every ${minutes} min (connector no-session check)`);
      }
    });
  } else {
    console.error('❌ Failed to start server due to database connection error');
    process.exit(1);
  }
};

startServer();

module.exports = app;
