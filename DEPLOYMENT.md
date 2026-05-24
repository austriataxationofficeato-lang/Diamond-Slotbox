# Deployment Guide

## 🚀 Quick Deploy to Netlify

1. Push to GitHub (already done!)
2. Go to Netlify
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Deploy!
6. Get your Netlify URL

## 🚀 Quick Deploy to Vercel

1. Push to GitHub (already done!)
2. Go to Vercel
3. Click "New Project"
4. Select your GitHub repository
5. Click "Deploy"
6. Get your Vercel URL

## 📱 Telegram Mini App Setup

### Step 1: Create a Telegram Bot
1. Open @BotFather
2. Send /newbot
3. Follow the instructions to create your bot
4. Save your bot token

### Step 2: Set up WebApp
1. In BotFather, send /newapp
2. Provide your WebApp URL
3. Get the WebApp URL
4. Configure your bot to use the WebApp

## 🎨 Customization

### Change Colors
Edit styles.css:
```css
:root {
    --primary-color: #00d4ff;  /* Change this */
    --secondary-color: #ff00ff; /* Change this */
    --gold-color: #ffd700;      /* Change this */
}
```

### Change Symbols
Edit script.js:
```javascript
const symbols = ['💎', '🎰', '⭐', '🍀', '7️⃣', '🍒'];
```

### Change Winning Combinations
Edit script.js:
```javascript
const winningCombinations = [
    { symbols: ['💎', '💎', '💎'], multiplier: 50 },
    // Add your own combinations
];
```

## 📊 Analytics (Optional)

Add Google Analytics to track usage:

```html
<!-- Add to index.html head -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR_GA_ID');
</script>
```

## 🐛 Troubleshooting

**Game not loading?**
- Check your WebApp URL is correct
- Ensure all files are deployed
- Check browser console for errors

**Bot not responding?**
- Verify bot token is correct
- Check WebApp URL is accessible
- Restart your bot

**Credits not saving?**
- Check LocalStorage is enabled
- Clear browser cache and try again

---
Happy gaming! 🎰💎