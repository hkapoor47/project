const { askLLM } = require("../services/llmService");

async function generateAnswer(req, res) {
    console.log("Request Body:", req.body);
  console.log("Headers:", req.headers);

  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({
        message: "Transcript is required",
      });
    }

    const answer = await askLLM(transcript);

    res.json({
      answer,
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