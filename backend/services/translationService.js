const axios = require("axios");

async function translateTranscript(text) {

    if (!text || !text.trim()) {
        return "";
    }

    const response = await axios.post(
        `${process.env.LIBRETRANSLATE_URL}/translate`,
        {
            q: text,
            source: "auto",
            target: "en",
            format: "text"
        },
        {
            timeout: 10000
        }
    );

    return response.data.translatedText;
}

module.exports = {
    translateTranscript
};