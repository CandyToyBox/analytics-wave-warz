import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { battleWebhookHandler } from './webhooks/battles.js';
import { frameHandler, frameImageHandler } from './frames/battle-frame.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoints for Supabase
// battleWebhookHandler uses Vercel types for serverless deployment, but is runtime-compatible
// with Express since both share the same underlying Node.js http.IncomingMessage/ServerResponse
app.post('/api/webhooks/battles', battleWebhookHandler as unknown as RequestHandler);

// Farcaster Frame endpoints
app.post('/api/frames/battle', frameHandler);
app.get('/api/frames/battle/image', frameImageHandler);
app.get('/api/frames/battle/:battleId', frameHandler);

app.listen(PORT, () => {
  console.log(`🚀 WaveWarz API Server running on port ${PORT}`);
  console.log(`📊 Webhook endpoint: http://localhost:${PORT}/api/webhooks/battles`);
  console.log(`🖼️  Frame endpoint: http://localhost:${PORT}/api/frames/battle`);
});

export default app;
