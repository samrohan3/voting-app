import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { createServer as createViteServer } from 'vite';
import User from './models/User';
import Block from './models/Block';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Twilio Client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/securechain';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Authentication Layer ---

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

  try {
    if (twilioClient && VERIFY_SERVICE_SID) {
      try {
        await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
          .verifications.create({ to: `+91${mobile}`, channel: 'sms' });
      } catch (twilioErr: any) {
        console.error('Twilio API error:', twilioErr);
        return res.status(500).json({ 
          error: `Twilio Error: ${twilioErr.message}. Please check your credentials.` 
        });
      }
    }
    // For demo purposes, we always succeed if Twilio is not configured or succeeds.
    res.json({ success: true, message: 'OTP sent' });
  } catch (error: any) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Verify OTP & Login
app.post('/api/auth/verify-otp', async (req, res) => {
  const { mobile, code } = req.body;
  
  // Lazy check for environment variables to handle dynamic updates
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const hasTwilio = !!(sid && auth && serviceSid);

  try {
    let verified = false;

    if (hasTwilio) {
      try {
        const client = twilio(sid, auth);
        const verification = await client.verify.v2.services(serviceSid!)
          .verificationChecks.create({ to: `+91${mobile}`, code });
        verified = verification.status === 'approved';
      } catch (twilioErr: any) {
        console.error('Twilio Verification Error:', twilioErr);
        return res.status(401).json({ error: `Twilio Error: ${twilioErr.message}` });
      }
    } else {
      // Demo mode fallback
      verified = code === '123456';
      if (!verified) {
        return res.status(401).json({ 
          error: 'Twilio credentials not found. The system has reverted to Demo Mode. Use 123456 or re-add your API keys in the platform settings.' 
        });
      }
    }

    if (!verified) {
      return res.status(401).json({ error: 'Invalid OTP. Please check the code and try again.' });
    }

    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.create({ mobile });
    }

    const token = jwt.sign(
      { id: user._id, mobile: user.mobile, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1h' }
    );

    res.json({ token, user: { mobile: user.mobile, hasVoted: user.hasVoted, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// --- Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Business Logic & Blockchain Layer ---

app.post('/api/vote', authenticate, async (req: any, res) => {
  const { partyId } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user || user.hasVoted) {
      return res.status(400).json({ error: 'User has already voted or not found' });
    }

    // Get last block
    const lastBlock = await Block.findOne().sort({ index: -1 });
    const index = lastBlock ? lastBlock.index + 1 : 0;
    const previousHash = lastBlock ? lastBlock.hash : '0';
    const timestamp = Date.now();
    const voterId = crypto.createHash('sha256').update(user.mobile).digest('hex');

    // Simple PoW simulation
    let nonce = 0;
    let hash = '';
    while (true) {
      hash = crypto.createHash('sha256')
        .update(`${index}${previousHash}${timestamp}${partyId}${voterId}${nonce}`)
        .digest('hex');
      if (hash.startsWith('00')) break; // Difficulty 2
      nonce++;
    }

    const newBlock = await Block.create({
      index,
      timestamp,
      partyId,
      voterId,
      previousHash,
      hash,
      nonce
    });

    user.hasVoted = true;
    await user.save();

    res.json({ success: true, block: newBlock });
  } catch (error) {
    res.status(500).json({ error: 'Voting failed' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const blocks = await Block.find().sort({ index: 1 });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
