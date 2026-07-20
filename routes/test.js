const express = require("express");
const router = express.Router();

const { askLLM } = require("../services/llmService");

router.get("/", async (req, res) => {
  try {
    const answer = await askLLM("Tell me a joke.");

    res.json({
      answer,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;