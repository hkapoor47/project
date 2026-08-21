const express = require("express");
const router = express.Router();

const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { handleGetToken } = require("../controller/agoraController");

router.get("/token", handleGetToken);

module.exports = router;