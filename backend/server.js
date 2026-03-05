require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use((req, res, next) => {
  console.log('Request received:', req.method, req.path);
  next();
});

app.use(
  cors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /\.vercel\.app$/,
    ],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/translate', require('./routes/translate'));

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong on the server.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('Server listen error:', error);
});

server.on('close', () => {
  console.warn('Server closed unexpectedly.');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
