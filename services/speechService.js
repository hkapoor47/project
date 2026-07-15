const axios = require("axios");

async function startSpeechToText(channel, uid) {
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const appId = process.env.AGORA_APP_ID;

    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString("base64");
    const url =
        `https://api.agora.io/api/speech-to-text/v1/projects/${appId}/join`;

    const body = { 
        name: `stt-${Date.now()}`,
        properties: {
            channel: channel,
            uid: String(uid),
            language: "en-US",
            maxIdleTime: 300
        }
    };
    try {
        const response = await axios.post(
            url,
            body,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data;
    }catch (error) {

    console.log("Status:", error.response?.status);

    console.log("Agora Response:");
    console.log(error.response?.data);

    throw error;
  }
}
module.exports = {startSpeechToText};