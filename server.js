const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/API/leaderboard', (req, res) => {
    db.all('SELECT username, score FROM users ORDER BY score DESC LIMIT 100', (err, rows) => {
        res.json({ players: rows || [] });
    });
});

app.post('/API/register', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (row) return res.status(400).json({ error: 'Username exists' });
        db.run('INSERT INTO users (username, password, score) VALUES (?, ?, 0)', 
            [username, password], function() {
                res.json({ success: true, data: { id: this.lastID, username, score: 0 } });
            });
    });
});

app.post('/API/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', 
        [username, password], (err, row) => {
            if (!row) return res.status(401).json({ error: 'Invalid credentials' });
            res.json({ success: true, data: { id: row.id, username: row.username, score: row.score } });
        });
});
/*5*/
app.listen(PORT, () => console.log(`Server on port ${PORT}`));