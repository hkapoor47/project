const { askLLM } = require("../services/llmService");

function normalizeTranscript(transcript) {
  if (typeof transcript === "string") {
    return transcript.replace(/\s+/g, " ").trim();
  }

  if (!Array.isArray(transcript)) {
    return "";
  }

  return transcript
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (!entry || typeof entry !== "object") {
        return "";
      }

      const text = String(entry.text || "").trim();

      if (!text) {
        return "";
      }

      const speaker = String(entry.speaker || "").trim();

      return speaker ? `${speaker}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

async function generateAnswer(req, res) {
  try {
    console.log("Body:", req.body);

    const transcript = normalizeTranscript(req.body?.transcript);

    if (!transcript) {
      return res.status(400).json({
        message: "Transcript is required",
      });
    }

    const answer = await askLLM(transcript);

    return res.status(200).json({
      summary: answer,
    });
  } catch (err) {
    console.error("LLM Error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
}

module.exports = {
  generateAnswer,
};
