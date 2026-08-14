const { GoogleGenAI } = require("@google/genai");

async function askLLM(transcript) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from environment variables");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `
You are an expert AI meeting assistant.

Your task is to convert the following meeting transcript into
professional and concise Minutes of Meeting (MoM).

IMPORTANT INSTRUCTIONS:

1. Do NOT simply repeat the transcript.
2. Do NOT return a cleaned-up transcript.
3. Remove repeated and duplicate sentences.
4. Combine multiple statements discussing the same topic.
5. Identify the important topics discussed during the meeting.
6. Identify important decisions made during the meeting.
7. Identify action items/tasks discussed.
8. Identify the person responsible for an action item whenever the speaker's name is available.
9. Include deadlines only when they were actually mentioned.
10. Do NOT invent names, tasks, decisions, dates, or deadlines.
11. Ignore greetings, filler words, background noise, and irrelevant conversation.
12. Preserve important technical information.
13. If a speaker is identified in the transcript, use their name.
14. If a speaker is unknown, use "Unknown" instead of guessing.
15. Focus on what was discussed, decided, and what needs to be done.
16. If there are no decisions or action items, write "None identified."
17. Make the result professional enough to be used as an official meeting record.

Return the result using EXACTLY this structure:

Topic:

Key Discussion Points

1.
2.
3.

Decisions Made

-
-

Issues

-
-

Next Steps

-
-

MEETING TRANSCRIPT:

${transcript}
`;

  try {
    console.log("Calling Gemini...");
    console.log("Transcript length:", transcript.length);
    console.log(
      "Gemini API key exists:",
      !!process.env.GEMINI_API_KEY
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    console.log("Gemini response received");

    const text = response.text;

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;

  } catch (error) {
    console.error("========== GEMINI ERROR ==========");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Name:", error.name);
    console.error("Full error:", error);
    console.error("==================================");

    throw new Error(
      `Gemini API failed: ${error.message || "Unknown Gemini error"}`
    );
  }
}

module.exports = {
  askLLM,
};