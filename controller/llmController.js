const { askLLM } = require("../services/llmService");

async function generateAnswer(req, res) {
  console.log("Body:", req.body);

  if (!req.body) {
    return res.status(500).json({
      error: "req.body is undefined",
    });
  }

  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({
        message: "Transcript is required",
      });
    }

    const answer = await askLLM(transcript);

    res.json({
      summary:answer,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
}

module.exports = {
  generateAnswer,
};