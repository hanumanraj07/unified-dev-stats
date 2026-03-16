const express = require("express");
const router = express.Router();
const getSololearnStats = require("../services/sololearnScraper");

router.get("/scraper", async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ success: false, message: "Profile URL is required" });
        }

        const data = await getSololearnStats(url);

        res.set({
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "ETag": ""
        });

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("Sololearn scraper error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: process.env.NODE_ENV !== "production" ? error.stack : undefined
        });
    }
});

module.exports = router;
