const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: "Welcome to Diamond Slotbox API" });
});

// Add more routes here later
module.exports = router;