const express = require("express");
const router = express.Router();
const { startSpeechToText,  stopSpeechToText} = require("../services/speechService");
const { handleSpeechToTextStart ,handleSpeechToTextStop, handleSpeechCallback } = require("../controller/speechController");

router.post("/start", handleSpeechToTextStart);

router.post("/stop", handleSpeechToTextStop);

router.post("/callback", handleSpeechCallback);

module.exports = router;