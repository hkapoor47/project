const axios = require("axios");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

console.log("Inside speechService");

async function startSpeechToText(channel, uid) {
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
   
    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString("base64");
   
    const role = RtcRole.PUBLISHER;
    const expireTime = Math.floor(Date.now() / 1000) + 3600;
    const pubBotUid = 5001;
    const subBotUid = 5002;

     const pubBotToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        pubBotUid,
        role,
        expireTime
    );
    const subBotToken = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        subBotUid,
        role,
        expireTime
    );

    const url =
        `https://api.agora.io/api/speech-to-text/v1/projects/${appId}/join`;

    const body = { 
        name: channel,
       languages: ["en-US"],
        maxIdleTime: 60,
        rtcConfig:{
            channelName: channel,

            pubBotUid: String(pubBotUid),
            subBotUid: String(subBotUid),

        
            pubBotToken,
            subBotToken
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
    console.log("Agora Error:");

    
    console.log(JSON.stringify(error.response?.data, null, 2)
);
    throw error;
  }
}
module.exports = {startSpeechToText};