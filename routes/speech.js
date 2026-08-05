const express = require("express");
const router = express.Router();

const {
    handleSpeechToTextStart,
    handleSpeechToTextStop,
    handleSpeechCallback
} = require("../controller/speechController");

const authMiddleware = require("../middleware/authMiddleware");

router.post( "/start", authMiddleware, handleSpeechToTextStart);

router.post( "/stop", authMiddleware, handleSpeechToTextStop);

router.post("/callback",handleSpeechCallback);

module.exports = router;