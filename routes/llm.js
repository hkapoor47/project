const express = require("express");

const router = express.Router();

const { generateAnswer } = require("../controller/llmController");

router.post("/summarize", generateAnswer);

module.exports = router;