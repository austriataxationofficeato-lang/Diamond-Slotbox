// ═══════════════════════════════════════════════════════
// DIAMOND SLOTBOX - FRONTEND API INTEGRATION
// This file handles all communication with the backend server
// ═══════════════════════════════════════════════════════

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8080'
  : 'https://diamond-slotbox-production.up.railway.app';

// ═══════════════════════════════════════════════════════
// TELEGRAM WEB APP INTEGRATION
// ═══════════════════════════════════════════════════════

let tg = null;
let webApp = null;

function initTelegram() {
  try {
    webApp = window.Telegram.WebApp;
    tg = webApp.initData;
    
    if (!tg) {
      console.warn('⚠️ Not running in Telegram (local development)');
      // Mock data for testing
      return {
        mockMode: true,
        initData: 'mock_data_for_testing'
      };
    }
    
    console.log('✅ Telegram Web App initialized');
    return {
      mockMode: false,
      initData: tg
    };
  } catch (err) {
    console.error('❌ Telegram initialization failed:', err);
    return {
      mockMode: true,
      initData: 'mock_data_for_testing'
    };
  }
}

// ═══════════════════════════════════════════════════════
// PLAYER REGISTRATION & LOGIN
// ═══════════════════════════════════════════════════════

async function registerPlayer(initData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/player/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData })
    });

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Player registered:', data.player);
    return data;
  } catch (err) {
    console.error('❌ Registration error:', err);
    throw err;
  }
}

async function getPlayerProfile(uid) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/player/${uid}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`);
    }

    const data = await response.json();
    return data.player;
  } catch (err) {
    console.error('❌ Profile fetch error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// SPIN RESULT - SEND SCORE TO BACKEND
// ═══════════════════════════════════════════════════════

async function submitSpinResult(uid, pointsWon, ticketsSpent = 1) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/player/${uid}/spin-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pointsWon,
        ticketsSpent
      })
    });

    if (!response.ok) {
      throw new Error(`Spin result submission failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Spin result submitted:', data.message);
    return data.player;
  } catch (err) {
    console.error('❌ Spin result error:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// LEADERBOARD - GET GLOBAL SCORES
// ═══════════════════════════════════════════════════════

async function getLeaderboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
    
    if (!response.ok) {
      throw new Error(`Failed to get leaderboard: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Leaderboard fetched:', data.leaderboard.length, 'players');
    return data.leaderboard;
  } catch (err) {
    console.error('❌ Leaderboard fetch error:', err);
    // Return empty array on error so app doesn't crash
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// HELPER FUNCTION - SYNC PLAYER DATA FROM BACKEND
// ═══════════════════════════════════════════════════════

async function syncPlayerData(uid) {
  try {
    const updatedPlayer = await getPlayerProfile(uid);
    
    // Update local state S with backend data
    S.tickets = updatedPlayer.tickets;
    S.diamonds = updatedPlayer.diamonds;
    S.points = updatedPlayer.points;
    S.balance = updatedPlayer.balance;
    
    // Update UI
    updateHUD();
    
    console.log('✅ Player data synced from backend');
    return updatedPlayer;
  } catch (err) {
    console.error('❌ Sync error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// ERROR HANDLER FOR NETWORK ISSUES
// ═══════════════════════════════════════════════════════

function handleNetworkError(err) {
  console.error('🌐 Network Error:', err);
  
  const netErr = document.getElementById('netErr');
  if (netErr) {
    netErr.style.display = 'flex';
    setTimeout(() => {
      netErr.style.display = 'none';
    }, 4000);
  }
}

// ═══════════════════════════════════════════════════════
// EXPORT FOR USE IN MAIN SCRIPT
// ═══════════════════════════════════════════════════════

// These will be used in your main script.js