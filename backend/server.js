require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const productRoutes = require('./routes/products');
const taxiRoutes    = require('./routes/taxis');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 30,               // 30 requests/min per IP
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', limiter);

// ── Routes ──────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/taxis',    taxiRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error handler ───────────────────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  PriceSnap running → http://localhost:${PORT}`);
});
