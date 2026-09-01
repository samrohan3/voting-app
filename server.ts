import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { createServer as createViteServer } from 'vite';
import User from './models/User';
import Block from './models/Block';
import Settings from './models/Settings';
import VoterIssue from './models/VoterIssue';
import crypto from 'crypto';

// Encryption setup
const ENCRYPTION_KEY = crypto.scryptSync(process.env.VOTING_SECRET || 'default_secret', 'salt', 32);
const IV_LENGTH = 16;

function encryptVote(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptVote(text: string) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch(e) {
    return text; // Fallback for old unencrypted votes
  }
}

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

// Admin Login (for demo purposes)
app.post('/api/auth/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    const token = jwt.sign(
      { id: 'admin-id', mobile: 'admin', role: 'admin' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid admin password' });
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

// Helper for formatting time (e.g. "09:00" -> "9:00 AM", "17:00" -> "5:00 PM")
function formatTimeTo12Hour(timeStr: string): string {
  if (!timeStr) return '9:00 AM';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

export function isWithinVotingHours(
  startTime = '09:00',
  endTime = '17:00',
  customDate?: Date
): {
  allowed: boolean;
  message: string;
  serverTime: string;
  allowedWindow: string;
} {
  const now = customDate || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startTotal = (startH ?? 9) * 60 + (startM ?? 0);
  const endTotal = (endH ?? 17) * 60 + (endM ?? 0);

  const allowed = currentMinutes >= startTotal && currentMinutes < endTotal;
  
  const startFmt = formatTimeTo12Hour(startTime);
  const endFmt = formatTimeTo12Hour(endTime);
  const allowedWindow = `${startFmt} and ${endFmt}`;

  return {
    allowed,
    message: allowed
      ? 'Voting is open'
      : `Voting is closed. Allowed timing is strictly between ${allowedWindow}.`,
    serverTime: now.toISOString(),
    allowedWindow
  };
}

// --- Business Logic & Blockchain Layer ---

// Settings APIs
app.get('/api/settings', async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      isVotingActive: true,
      startTime: '09:00',
      endTime: '17:00',
      enforceTimeWindow: true
    });
  }
  const timeCheck = isWithinVotingHours(settings.startTime || '09:00', settings.endTime || '17:00');
  res.json({
    ...settings.toObject(),
    isWithinHours: timeCheck.allowed,
    serverTime: new Date().toISOString(),
    serverTimeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  });
});

app.post('/api/settings/toggle', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      isVotingActive: true,
      startTime: '09:00',
      endTime: '17:00',
      enforceTimeWindow: true
    });
  }
  settings.isVotingActive = !settings.isVotingActive;
  await settings.save();
  const timeCheck = isWithinVotingHours(settings.startTime || '09:00', settings.endTime || '17:00');
  res.json({
    ...settings.toObject(),
    isWithinHours: timeCheck.allowed,
    serverTime: new Date().toISOString(),
    serverTimeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  });
});

app.post('/api/settings/hours', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { startTime, endTime, enforceTimeWindow } = req.body;
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      isVotingActive: true,
      startTime: '09:00',
      endTime: '17:00',
      enforceTimeWindow: true
    });
  }

  if (startTime !== undefined) settings.startTime = startTime;
  if (endTime !== undefined) settings.endTime = endTime;
  if (enforceTimeWindow !== undefined) settings.enforceTimeWindow = enforceTimeWindow;

  await settings.save();
  const timeCheck = isWithinVotingHours(settings.startTime || '09:00', settings.endTime || '17:00');
  res.json({
    ...settings.toObject(),
    isWithinHours: timeCheck.allowed,
    serverTime: new Date().toISOString(),
    serverTimeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  });
});

// Issues API
app.post('/api/issues', async (req, res) => {
  const { mobile, photoBase64 } = req.body;
  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const issue = await VoterIssue.create({ userId: user._id, photoBase64 });
  res.json({ success: true, issue });
});

app.get('/api/issues', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const issues = await VoterIssue.find({ status: 'pending' }).populate('userId');
  res.json(issues);
});

app.post('/api/issues/:id/resolve', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const issue = await VoterIssue.findById(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  issue.status = 'resolved';
  await issue.save();
  
  const user = await User.findById(issue.userId);
  if (user) {
    user.hasVoted = false;
    await user.save();
  }
  res.json({ success: true });
});

app.post('/api/vote', authenticate, async (req: any, res) => {
  const { partyId } = req.body;
  const userId = req.user.id;

  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        isVotingActive: true,
        startTime: '09:00',
        endTime: '17:00',
        enforceTimeWindow: true
      });
    }

    // 1. Time-based restriction check (Strict 9:00 AM - 5:00 PM window)
    if (settings.enforceTimeWindow !== false) {
      const timeCheck = isWithinVotingHours(settings.startTime || '09:00', settings.endTime || '17:00');
      if (!timeCheck.allowed) {
        return res.status(403).json({
          error: timeCheck.message
        });
      }
    }

    // 2. Voting process manual status check
    if (!settings.isVotingActive) {
      return res.status(400).json({ error: 'Voting process is currently closed' });
    }

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

    const encryptedPartyId = encryptVote(partyId);

    // Simple PoW simulation
    let nonce = 0;
    let hash = '';
    while (true) {
      hash = crypto.createHash('sha256')
        .update(`${index}${previousHash}${timestamp}${encryptedPartyId}${voterId}${nonce}`)
        .digest('hex');
      if (hash.startsWith('00')) break; // Difficulty 2
      nonce++;
    }

    const newBlock = await Block.create({
      index,
      timestamp,
      partyId: encryptedPartyId,
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
    let settings = await Settings.findOne();
    const isVotingActive = settings ? settings.isVotingActive : true;
    
    const blocks = await Block.find().sort({ index: 1 });
    
    if (isVotingActive) {
      const hiddenBlocks = blocks.map(b => ({ ...b.toObject(), partyId: 'HIDDEN' }));
      return res.json({ isVotingActive, blocks: hiddenBlocks });
    }

    const decryptedBlocks = blocks.map(b => ({
      ...b.toObject(),
      partyId: decryptVote(b.partyId)
    }));
    
    res.json({ isVotingActive, blocks: decryptedBlocks });
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
