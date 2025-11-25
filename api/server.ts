import express from 'express';
import cors from 'cors';
import { webhookRouter } from './routes/webhooks';
import { frameRouter } from './routes/frames';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/frames', frameRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 WaveWarz API running on http://localhost:${PORT}`);
  console.log(`- Webhooks: http://localhost:${PORT}/api/webhooks/battles`);
  console.log(`- Frames:   http://localhost:${PORT}/api/frames/battle`);
});
