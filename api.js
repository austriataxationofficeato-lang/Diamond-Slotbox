// =============================================
// DIAMOND SLOTBOX API CLIENT
// Backend: https://diamond-slotbox-production.up.railway.app
// =============================================

const API = {
    // Base URL - Your Railway Backend
    baseUrl: 'https://diamond-slotbox-production.up.railway.app',

    // Helper for API requests
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        // Stringify body if it's an object
        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'API Error');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Auth - Register/Login with Telegram
    async register(initData) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: { initData }
        });
    },

    // Get player profile
    async getPlayer(uid) {
        return this.request(`/api/player/${uid}`);
    },

    // Spin (Server-side RNG)
    async spin(uid, ticketsSpent = 1) {
        return this.request('/api/game/spin', {
            method: 'POST',
            body: { uid, ticketsSpent }
        });
    },

    // Get Leaderboard
    async getLeaderboard() {
        return this.request('/api/leaderboard');
    },

    // TON Wallet
    async getWalletAddress(uid) {
        return this.request(`/api/ton/wallet/${uid}`);
    },

    // TON Deposit
    async deposit(uid, amount) {
        return this.request('/api/ton/deposit', {
            method: 'POST',
            body: { uid, amount }
        });
    },

    // Anti-Cheat: Verify Spin
    async verifySpin(uid) {
        return this.request(`/api/verify/spin/${uid}`);
    }
};

// =============================================
// GAME STATE
// =============================================

const Game = {
    state: {
        loggedIn: false,
        user: null,
        tickets: 10,
        points: 0,
        balance: 0,
        isPremium: false
    },

    // Initialize with Telegram WebApp
    async init() {
        if (window.Telegram?.WebApp) {
            const tg = Telegram.WebApp;
            tg.ready();
            tg.expand();

            const initData = tg.initData;
            const user = tg.initDataUnsafe?.user;

            if (initData && user) {
                try {
                    const result = await API.register(initData);

                    this.state.loggedIn = true;
                    this.state.user = {
                        id: user.id,
                        name: user.first_name || 'Player',
                        username: user.username || `@user${user.id}`,
                    };

                    // Sync data from server
                    this.state.tickets = result.player?.tickets ?? 10;
                    this.state.points = result.player?.points ?? 0;
                    this.state.balance = result.player?.balance ?? 0;
                    this.state.isPremium = result.player?.isPremium ?? false;

                    this.updateHUD();
                    console.log('✅ Game initialized successfully');
                    return true;
                } catch (error) {
                    console.error('Login failed:', error);
                    return false;
                }
            }
        }
        console.warn('Telegram WebApp not detected');
        return false;
    },

    // Perform Spin
    async doSpin(ticketsSpent = 1) {
        if (!this.state.loggedIn || !this.state.user) {
            toast('Please login first!', 2000);
            return null;
        }

        if (this.state.tickets < ticketsSpent) {
            toast('Not enough tickets!', 2000);
            return null;
        }

        try {
            const result = await API.spin(this.state.user.id, ticketsSpent);

            this.state.tickets = result.tickets;
            this.state.points = result.points;

            this.updateHUD();

            return {
                reels: result.reels,
                payout: result.payout
            };
        } catch (error) {
            toast('Spin failed: ' + (error.message || 'Unknown error'), 2000);
            return null;
        }
    },

    // Get Leaderboard
    async getLeaderboard() {
        try {
            const result = await API.getLeaderboard();
            return result.leaderboard || [];
        } catch (error) {
            console.error('Leaderboard error:', error);
            return [];
        }
    },

    // Update HUD
    updateHUD() {
        const ticketsEl = document.getElementById('tickets');
        const pointsEl = document.getElementById('points');
        const balanceEl = document.getElementById('balance');

        if (ticketsEl) ticketsEl.textContent = this.state.tickets;
        if (pointsEl) pointsEl.textContent = this.state.points.toLocaleString();
        if (balanceEl) balanceEl.textContent = this.state.balance.toFixed(2);
    }
};

// Make available globally
window.API = API;
window.Game = Game;