const axios = require("axios");

async function translateTranscript(text) {
    if (!text || !text.trim()) {
        return "";
    }

    try {
        const response = await axios.post(
            `${process.env.LIBRETRANSLATE_URL}`,
            {
                q: text,
                source: "auto",
                target: "en",
                format: "text"
            },
            {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }
        );

        const translatedText = response.data?.translatedText;

        if (!translatedText) {
            throw new Error("LibreTranslate returned empty translation");
        }

        return translatedText.trim();

    } catch (error) {
        console.error("LibreTranslate ERROR");
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);
        console.error("Message:", error.message);

        throw error;
    }
}

module.exports = {
    translateTranscript
};