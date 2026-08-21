const express = require("express");
const router = express.Router();

const {
    translateTranscript
} = require("../services/translationService");

router.post("/translate", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                message: "Text is required"
            });
        }

        const translatedText = await translateTranscript(text);

        return res.status(200).json({
            translatedText
        });

    } catch (error) {
        console.error("Translation route error:", error);

        return res.status(500).json({
            message: "Translation failed",
            error: error.message
        });
    }
});

module.exports = router;