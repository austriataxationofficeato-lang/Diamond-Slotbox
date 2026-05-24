// Diamond Slotbox - Game Logic

// Game State
const gameState = {
    credits: 1000,
    bet: 10,
    isSpinning: false,
    symbols: ['💎', '🎰', '⭐', '🍀', '7️⃣', '🍒'],
    winningCombinations: [
        { symbols: ['💎', '💎', '💎'], multiplier: 50 },
        { symbols: ['7️⃣', '7️⃣', '7️⃣'], multiplier: 30 },
        { symbols: ['⭐', '⭐', '⭐'], multiplier: 20 },
        { symbols: ['🎰', '🎰', '🎰'], multiplier: 15 },
        { symbols: ['🍀', '🍀', '🍀'], multiplier: 10 },
        { symbols: ['🍒', '🍒', '🍒'], multiplier: 5 },
        { symbols: ['💎', '💎', '🎰'], multiplier: 3 },
        { symbols: ['7️⃣', '7️⃣', '⭐'], multiplier: 3 },
        { symbols: ['⭐', '⭐', '🍀'], multiplier: 3 },
    ]
};

// DOM Elements
const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');
const spinBtn = document.getElementById('spinBtn');
const creditsDisplay = document.getElementById('credits');
const betDisplay = document.getElementById('bet');
const inviteBtn = document.getElementById('inviteBtn');
const winMessage = document.getElementById('winMessage');
const winText = document.getElementById('winText');

// Initialize Game
function initGame() {
    updateDisplay();
    loadGameState();
    setupEventListeners();
}

// Update Display
function updateDisplay() {
    creditsDisplay.textContent = gameState.credits;
    betDisplay.textContent = gameState.bet;
    spinBtn.disabled = gameState.isSpinning || gameState.credits < gameState.bet;
}

// Load Game State from LocalStorage
function loadGameState() {
    const saved = localStorage.getItem('diamondSlotboxState');
    if (saved) {
        const parsed = JSON.parse(saved);
        gameState.credits = parsed.credits || 1000;
        gameState.bet = parsed.bet || 10;
    }
}

// Save Game State to LocalStorage
function saveGameState() {
    localStorage.setItem('diamondSlotboxState', JSON.stringify({
        credits: gameState.credits,
        bet: gameState.bet
    }));
}

// Setup Event Listeners
function setupEventListeners() {
    spinBtn.addEventListener('click', spin);
    inviteBtn.addEventListener('click', inviteFriends);
}

// Spin Reels
async function spin() {
    if (gameState.isSpinning || gameState.credits < gameState.bet) {
        return;
    }

    // Deduct bet
    gameState.credits -= gameState.bet;
    saveGameState();
    updateDisplay();

    // Set spinning state
    gameState.isSpinning = true;
    spinBtn.disabled = true;
    winMessage.classList.add('hidden');

    // Spin each reel with delay
    await spinReel(reel1, 1000);
    await spinReel(reel2, 1500);
    await spinReel(reel3, 2000);

    // Check for win
    checkWin();

    // Reset spinning state
    gameState.isSpinning = false;
    spinBtn.disabled = false;
}

// Spin Single Reel
function spinReel(reel, delay) {
    return new Promise((resolve) => {
        reel.classList.add('spinning');

        setTimeout(() => {
            reel.classList.remove('spinning');
            const randomSymbol = gameState.symbols[Math.floor(Math.random() * gameState.symbols.length)];
            reel.textContent = randomSymbol;
            resolve();
        }, delay);
    });
}

// Check for Win
function checkWin() {
    const result = [reel1.textContent, reel2.textContent, reel3.textContent];
    let winAmount = 0;
    let winMessageText = '';

    // Check for exact matches
    for (const combo of gameState.winningCombinations) {
        if (result[0] === combo.symbols[0] &&
            result[1] === combo.symbols[1] &&
            result[2] === combo.symbols[2]) {
            winAmount = gameState.bet * combo.multiplier;
            winMessageText = `🎉 You won ${winAmount} credits!`;
            break;
        }
    }

    // Check for partial matches (2 symbols)
    if (winAmount === 0) {
        const symbolCounts = {};
        result.forEach(symbol => {
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        });

        for (const [symbol, count] of Object.entries(symbolCounts)) {
            if (count >= 2) {
                winAmount = Math.floor(gameState.bet * 1.5);
                winMessageText = `✨ Nice! You got ${count} ${symbol}s!`;
                break;
            }
        }
    }

    // Update credits if won
    if (winAmount > 0) {
        gameState.credits += winAmount;
        saveGameState();
        updateDisplay();
        winText.textContent = winMessageText;
        winMessage.classList.remove('hidden');
    }

    // Check for game over
    if (gameState.credits < gameState.bet) {
        setTimeout(() => {
            winText.textContent = '😢 Out of credits! Refresh to restart.';
            winMessage.classList.remove('hidden');
        }, 1000);
    }
}

// Invite Friends
function inviteFriends() {
    const inviteLink = 'https://t.me/DiamondSlotboxBot';
    const message = `💎 Come play Diamond Slotbox with me! Spin to win big! 🎰`;

    // Copy to clipboard
    navigator.clipboard.writeText(`${message} ${inviteLink}`).then(() => {
        alert('Invite link copied! Share it with your friends!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });

    // Send to Telegram
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify({
            action: 'invite',
            message: message,
            link: inviteLink
        }));
    }
}

// Initialize on load
initGame();

// Telegram Mini App Integration
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();

    // Handle data from Telegram
    window.Telegram.WebApp.onDataReceived = (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.action === 'invite') {
                alert(`Invited ${parsed.invitedBy} to play!`);
            }
        } catch (e) {
            console.error('Error parsing data:', e);
        }
    };
}

// Export for debugging
window.gameState = gameState;