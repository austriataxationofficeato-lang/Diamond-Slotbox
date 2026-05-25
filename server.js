const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Simple in-memory database (replace with real DB like MongoDB in production)
const players = new Map();
const leaderboard = [];

// ════════════════════════════════════════
// TELEGRAM AUTHENTICATION
// ════════════════════════════════════════
async function verifyTelegramWebApp(initData) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return null;
  }

  try {
    const data = new URLSearchParams(initData);
    const hash = data.get('hash');
    data.delete('hash');

    const dataToCheck = Array.from(data.keys())
      .sort()
      .map(key => `${key}=${data.get(key)}`)
      .join('\n');

    const crypto = require('crypto');
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataToCheck)
      .digest('hex');

    if (calculatedHash !== hash) {
      console.error('Invalid Telegram signature');
      return null;
    }

    const userStr = data.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (err) {
    console.error('Telegram verification failed:', err);
    return null;
  }
}

// ════════════════════════════════════════
// PLAYER ENDPOINTS
// ════════════════════════════════════════

// Register/Login player
app.post('/api/player/register', async (req, res) => {
  const { initData } = req.body;
  
  if (!initData) {
    return res.status(400).json({ error: 'Missing initData' });
  }

  const tgUser = await verifyTelegramWebApp(initData);
  if (!tgUser) {
    return res.status(401).json({ error: 'Invalid Telegram data' });
  }

  const uid = tgUser.id.toString();
  
  if (!players.has(uid)) {
    players.set(uid, {
      uid,
      name: tgUser.first_name || 'Player',
      username: tgUser.username || `@user${uid}`,
      avatar: '🧑',
      tickets: 10,
      diamonds: 0,
      points: 0,
      balance: 0,
      joinedAt: Date.now(),
      lastUpdated: Date.now()
    });
  }

  const player = players.get(uid);
  res.json({
    success: true,
    player,
    uid
  });
});

// Get player profile
app.get('/api/player/:uid', (req, res) => {
  const { uid } = req.params;
  const player = players.get(uid);
  
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  res.json({ success: true, player });
});

// Update player score (after spin)
app.post('/api/player/:uid/spin-result', (req, res) => {
  const { uid } = req.params;
  const { pointsWon, ticketsSpent } = req.body;

  const player = players.get(uid);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Only update points (NO fake money crediting)
  player.points += pointsWon;
  player.tickets -= ticketsSpent;
  player.lastUpdated = Date.now();

  // Update leaderboard
  updateLeaderboard();

  res.json({
    success: true,
    player,
    message: `+${pointsWon} points!`
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const topPlayers = Array.from(players.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, 100)
    .map((p, idx) => ({
      rank: idx + 1,
      ...p
    }));

  res.json({
    success: true,
    leaderboard: topPlayers,
    timestamp: Date.now()
  });
});

// ════════════════════════════════════════
// REMOVE FAKE WALLET ENDPOINTS
// ════════════════════════════════════════
// NO /api/wallet/connect
// NO /api/wallet/balance
// NO /api/player/claim-rewards
// All wallet functions are DISABLED

// ════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════
function updateLeaderboard() {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.points - a.points);
  
  leaderboard.length = 0;
  leaderboard.push(...sorted);
}

// ════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎰 Diamond Slotbox Backend running on port ${PORT}`);
});
