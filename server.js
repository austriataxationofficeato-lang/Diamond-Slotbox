const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database
function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        score INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// API Routes

// Check if account exists
app.get('/API/check-account', (req, res) => {
    const { username } = req.query;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Error checking account:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ exists: !!row });
    });
});

// Register new account
app.post('/API/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Error checking username:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        if (row) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Insert new user
        db.run('INSERT INTO users (username, password, score) VALUES (?, ?, 0)', 
            [username, password], 
            function(err) {
                if (err) {
                    console.error('Error inserting user:', err);
                    return res.status(500).json({ error: 'Server error' });
                }
                
                res.json({ 
                    success: true, 
                    data: { 
                        id: this.lastID, 
                        username, 
                        score: 0 
                    } 
                });
            }
        );
    });
});

// Login account
app.post('/API/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', 
        [username, password], 
        (err, row) => {
            if (err) {
                console.error('Error logging in:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            
            if (!row) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }
            
            res.json({ 
                success: true, 
                data: { 
                    id: row.id, 
                    username: row.username, 
                    score: row.score 
                } 
            });
        }
    );
});

// Get leaderboard
app.get('/API/leaderboard', (req, res) => {
    db.all('SELECT username, score FROM users ORDER BY score DESC LIMIT 100', 
        (err, rows) => {
            if (err) {
                console.error('Error fetching leaderboard:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            
            res.json({ players: rows || [] });
        }
    );
});

// Save score
app.post('/API/save-score', (req, res) => {
    const { userId, score } = req.body;
    
    if (!userId || score === undefined) {
        return res.status(400).json({ error: 'userId and score are required' });
    }
    
    db.run('UPDATE users SET score = ? WHERE id = ?', 
        [score, userId], 
        function(err) {
            if (err) {
                console.error('Error saving score:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            
            res.json({ success: true });
        }
    );
});

// Get current score
app.get('/API/get-score', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    db.get('SELECT score FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error('Error getting score:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ score: row.score || 0 });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});