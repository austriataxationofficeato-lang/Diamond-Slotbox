const express = require('express');
const router = express.Router();

// Initialize Player (Important for Telegram Mini App)
router.post('/init-player', (req, res) => {
    const { uid, name, username } = req.body;

    if (!uid || !name) {
        return res.status(400).json({ 
            success: false, 
            error: 'UID and name are required' 
        });
    }

    const player = {
        uid: uid,
        name: name,
        username: username || '',
        avatar: '',
        points: 0,
        balance: 0,
        walletAddress: null,
        spinsToday: 0,
        lastSpin: 0
    };

    // Store in in-memory database (in a real app, use a proper database)
    players.set(uid, player);

    res.json({
        success: true,
        player: player
    });
});

// Get Leaderboard
router.get('/leaderboard', (req, res) => {
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
router.get('/ton/wallet/:uid', (req, res) => {
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
router.post('/ton/deposit', (req, res) => {
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
router.get('/verify/spin/:uid', (req, res) => {
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

module.exports = router;