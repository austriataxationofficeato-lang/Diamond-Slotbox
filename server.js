
// At the top of your main server file (app.js or server.js)
const express = require('express');
const app = express();
const apiRouter = require('./routes/api');


// ... your other middleware and routes



// List all routes for debugging (helpful during development)
app.get('/debug-routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        }
    });
    res.json({ routes });
});

// Make sure your API routes are mounted correctly
app.use('/api' , apiRouter);
// Catch-all for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found' 
    });
});


const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');


const PORT = process.env.PORT || 8080;

// ====================== CONFIG ======================
const CONFIG = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8963441849:AAG-2jXIKg1tal1dRXRATTSLM2Pef3buNio',
    TON_API_URL: 'https://toncenter.com/api/v2',
    ADMIN_IDS: ['8302852788'] // Add your admin Telegram IDs here
};

// Enable CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// Serve static files (for your Mini App frontend)
app.use(express.static(path.join(__dirname, 'public')));

// ====================== IN-MEMORY DATABASE ======================
const players = new Map(); // uid → player data

// ====================== PLAYER INITIALIZATION ======================
function initPlayer(uid, name, username) {
    if (!players.has(uid)) {
        players.set(uid, {
            uid: uid,
            name: name,
            username: username || '',
            avatar: '',
            points: 0,
            balance: 0,
            walletAddress: null,
            spinsToday: 0,
            lastSpin: 0
        });
    }
    return players.get(uid);
}

// ====================== ROUTES ======================

// Initialize Player (Important for Telegram Mini App)
app.post('/api/init-player', (req, res) => {
    const { uid, name, username } = req.body;

    if (!uid || !name) {
        return res.status(400).json({ 
            success: false, 
            error: 'UID and name are required' 
        });
    }

    const player = initPlayer(uid, name, username);

    res.json({
        success: true,
        player: player
    });
});

// Get Leaderboard
app.get('/api/leaderboard', (req, res) => {
    const allPlayers = Array.from(players.values());
    
    const leaderboard = allPlayers
        .sort((a, b) => b.points - a.points)
        .slice(0, 100)
        .map((p, index) => ({
            rank: index + 1,
            uid: p.uid,
            name: p.name,
            username: p.username,
            avatar: p.avatar,
            points: p.points
        }));

    res.json({
        success: true,
        leaderboard,
        timestamp: Date.now()
    });
});

// Get Wallet Address
app.get('/api/ton/wallet/:uid', (req, res) => {
    const { uid } = req.params;
    const player = players.get(uid);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
        success: true,
        walletAddress: player.walletAddress
    });
});

// Deposit (Mock)
app.post('/api/ton/deposit', (req, res) => {
    const { uid, amount } = req.body;
    const player = players.get(uid);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    player.balance = (player.balance || 0) + Number(amount);

    res.json({
        success: true,
        balance: player.balance
    });
});

// Verify Spin
app.get('/api/verify/spin/:uid', (req, res) => {
    const { uid } = req.params;
    const player = players.get(uid);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
        success: true,
        spins: []
    });
});

// Error Handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Diamond Slotbox Backend running on port ${PORT}`);
    console.log(`🤖 Telegram Bot Token: ${CONFIG.TELEGRAM_BOT_TOKEN ? '✅ Loaded' : '❌ Not set'}`);
});