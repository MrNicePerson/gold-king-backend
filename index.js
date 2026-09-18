// index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import connectDB from './config/database.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { globalLimiter } from './middleware/rateLimit.js';

// ✅ LINE 1 — import the polling function
import { startLivePolling } from './utils/goldPriceCalculator.js';

dotenv.config();
connectDB();

const app = express();

// Trust proxy for Render / Vercel / reverse proxies (needed for rate limiting & secure protocol)
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
// Middleware to mark SSE route for no compression
app.use((req, res, next) => {
  if (req.path === '/api/super-admin/prices/stream') {
    req.skipCompression = true;
  }
  next();
});
app.use(compression({
  filter: (req, res) => !req.skipCompression
}));
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://gold-king-fontend.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/localhost:[0-9]+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin) ||
      /^https:\/\/gold-king-fontend.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static('uploads'));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/public', publicRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Gold Shop API is running',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);

  // ✅ LINE 2 — start live polling AFTER server is up
  startLivePolling();
});

export default app;