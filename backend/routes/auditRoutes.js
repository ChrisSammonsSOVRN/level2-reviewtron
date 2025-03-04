const express = require('express');
const { analyzeURL } = require('../controllers/auditController');

const router = express.Router();

// POST /audit/url
router.post('/url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "Missing 'url' in request body" });
    }
    const result = await analyzeURL(url);
    res.json(result);
});

module.exports = router;

