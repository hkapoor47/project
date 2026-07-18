const express = require("express");
const router = express.Router();
const { startSpeechToText,  stopSpeechToText} = require("../services/speechService");
const { handleSpeechToTextStart ,handleSpeechToTextStop } = require("../controller/controller");

router.post("/start", handleSpeechToTextStart);

router.post("/stop", handleSpeechToTextStop);

module.exports = router;