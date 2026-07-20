const express = require("express");

const router = express.Router();

const { generateAnswer } = require("../controller/llmController");

router.post("/ask", generateAnswer);

module.exports = router;