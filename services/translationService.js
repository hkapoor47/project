const TRANSLATION_SERVICE_URL = process.env.TRANSLATION_SERVICE_URL;

function containsDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}

async function translateTranscript(text) {
  // English (or another non-Devanagari caption) should remain unchanged.
  if (!containsDevanagari(text)) {
    return text;
  }

  if (!TRANSLATION_SERVICE_URL) {
    console.warn(
      "TRANSLATION_SERVICE_URL is not configured; using original Hindi transcript"
    );
    return text;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${TRANSLATION_SERVICE_URL.replace(/\/$/, "")}/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          source: "hi",
          target: "en",
          format: "text",
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Translation service returned ${response.status}`);
    }

    const result = await response.json();
    const translatedText = String(result.translatedText || "").trim();

    if (!translatedText) {
      throw new Error("Translation service returned an empty translation");
    }

    return translatedText;
  } catch (error) {
    // A temporary translation outage must not drop the meeting caption.
    console.error("Hindi translation failed; using original transcript:", error.message);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  translateTranscript,
};