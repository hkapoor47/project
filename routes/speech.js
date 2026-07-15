const express = require("express");
const router = express.Router();

const { startSpeechToText } = require("../services/speechService");

router.post("/start", async (req, res) => {
      console.log("Speech API Hit");
    try {
        const { channel, uid } = req.body;

        if (!channel || uid === undefined) {
            return res.status(400).json({
                message: "channel and uid are required"
            });
        }
         console.log("Calling speechService...");
         
        const result = await startSpeechToText(channel, uid);

        res.status(200).json(result);

    } catch (error) {
        console.error("Speech-to-Text Error:", error.message);

        res.status(500).json({
            message: "Failed to start Speech-to-Text",
            error: error.message
        });
    }
});

module.exports = router;