const axios = require("axios");

const {
  RtcTokenBuilder,
  RtcRole,
} = require("agora-token");

console.log("Inside speechService");

async function startSpeechToText(channel) {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!customerId || !customerSecret || !appId || !appCertificate) {
    throw new Error("Agora environment variables are missing");
  }

  if (!channel) {
    throw new Error("Channel name is required");
  }

  const auth = Buffer.from(`${customerId}:${customerSecret}`).toString("base64");
  const role = RtcRole.SUBSCRIBER;
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

  const url = `https://api.agora.io/api/speech-to-text/v1/projects/${appId}/join`;

  const body = {
    name: channel,
    languages: ["en-US", "hi-IN"],
    maxIdleTime: 60,
    // Deliberately no translateConfig: Agora performs STT only. Hindi-to-
    // English translation is handled by our self-hosted service for free.
    rtcConfig: {
      channelName: channel,
      pubBotUid: String(pubBotUid),
      subBotUid: String(subBotUid),
      pubBotToken,
      subBotToken,
    },
    callback: {
      url: `${process.env.BACKEND_URL}/api/speech/callback`,
    },
  };

  console.log({
    channel,
    appId,
    languages: body.languages,
    callback: body.callback.url,
  });

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Agora STT Started Successfully");
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("Agora STT Failed");
    console.error("Status:", error.response?.status);
    console.error("Response:", error.response?.data);
    console.error("Message:", error.message);
    throw error;
  }
}

async function stopSpeechToText(agent_id) {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
  const appId = process.env.AGORA_APP_ID;

  if (!customerId || !customerSecret || !appId) {
    throw new Error("Agora environment variables are missing");
  }

  if (!agent_id) {
    throw new Error("agent_id is required");
  }

  const auth = Buffer.from(`${customerId}:${customerSecret}`).toString("base64");
  const url = `https://api.agora.io/api/speech-to-text/v1/projects/${appId}/agents/${agent_id}/leave`;

  console.log({ appId, customerId, agent_id });

  try {
    const response = await axios.post(url, {}, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Agora STT Stopped Successfully");
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("Agora STT Stop Failed");
    console.error("Status:", error.response?.status);
    console.error("Response:", error.response?.data);
    console.error("Message:", error.message);
    throw error;
  }
}

module.exports = {
  startSpeechToText,
  stopSpeechToText,
};