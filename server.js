const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

// Serve static files from current directory (frontend)
app.use(express.static(__dirname));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Database error:', err.message);
        process.exit(1);
    }
    console.log('Database connected');
    initDatabase();
});

function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        score INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        score INTEGER NOT NULL
    )`);
    console.log('Database initialized');
}

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve index.html at root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes - Fixed to match frontend expectations (/api/ instead of /API/)
app.get('/api/leaderboard', (req, res) => {
    db.all('SELECT username, score FROM users ORDER BY score DESC LIMIT 100', (err, rows) => {
        res.json({ leaderboard: rows || [] });
    });
});

app.post('/api/player/register', (req, res) => {
    const { initData } = req.body;
    // Generate a unique username from initData
    const username = 'player_' + initData.substring(0, 8);
    const password = 'default_password';
    
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (row) return res.status(400).json({ error: 'Username exists' });
        db.run('INSERT INTO users (username, password, score) VALUES (?, ?, 0)', 
            [username, password], function() {
                res.json({ 
                    success: true, 
                    player: { 
                        id: this.lastID, 
                        username: username,
                        tickets: 100,
                        diamonds: 10,
                        points: 0,
                        balance: 0
                    } 
                });
            });
    });
});

app.post('/api/player/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', 
        [username, password], (err, row) => {
            if (!row) return res.status(401).json({ error: 'Invalid credentials' });
            res.json({ 
                success: true, 
                player: { 
                    id: row.id, 
                    username: row.username, 
                    score: row.score,
                    tickets: 100,
                    diamonds: 10,
                    points: row.score,
                    balance: 0
                } 
            });
        });
});

app.post('/api/player/:uid/spin-result', (req, res) => {
    const { uid } = req.params;
    const { pointsWon, ticketsSpent } = req.body;
    
    db.get('SELECT * FROM users WHERE id = ?', [uid], (err, row) => {
        if (!row) return res.status(404).json({ error: 'User not found' });
        
        const newScore = row.score + pointsWon;
        db.run('UPDATE users SET score = ? WHERE id = ?', [newScore, uid], function() {
            res.json({ 
                success: true, 
                message: 'Spin result submitted',
                player: {
                    id: row.id,
                    username: row.username,
                    score: newScore,
                    tickets: row.tickets - ticketsSpent,
                    diamonds: row.diamonds,
                    points: newScore,
                    balance: 0
                }
            });
        });
    });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));