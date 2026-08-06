const axios = require("axios");


async function startCloudRecording(channel) {

    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const appId = process.env.AGORA_APP_ID;

    if (!customerId || !customerSecret || !appId) {
        throw new Error("Agora environment variables are missing");
    }

    if (!channel) {
        throw new Error("Channel is required");
    }

    const auth = Buffer.from(
        `${customerId}:${customerSecret}`
    ).toString("base64");

    console.log("========== START CLOUD RECORDING ==========");
    console.log({
        appId,
        channel
    });

    try {

        // STEP 1
        const acquireUrl =
            `https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire`;

        console.log("Acquiring Recording Resource...");

        const acquireResponse = await axios.post(
            acquireUrl,
            {
                cname: channel,
                uid: "9999",
                clientRequest: {
                    resourceExpiredHour: 24
                }
            },
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const resourceId =
            acquireResponse.data.resourceId;

        console.log("Resource ID:", resourceId);

        // STEP 2
        const startUrl =
            `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;

        console.log("Starting Cloud Recording...");

        const startResponse = await axios.post(
            startUrl,
            {
                cname: channel,
                uid: "9999",
                clientRequest: {
                    recordingConfig: {
                        channelType: 0,
                        streamTypes: 0,
                        audioProfile: 1
                    },
                    storageConfig: {
                        vendor: Number(process.env.AGORA_STORAGE_VENDOR),
                        region: Number(process.env.AGORA_STORAGE_REGION),
                        bucket: process.env.AGORA_STORAGE_BUCKET,
                        accessKey: process.env.AGORA_STORAGE_ACCESS_KEY,
                        secretKey: process.env.AGORA_STORAGE_SECRET_KEY,
                        fileNamePrefix: [
                            "recordings",
                            channel
                        ]
                    }
                }
            },
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Cloud Recording Started Successfully");
        console.log(startResponse.data);

        return {
            resourceId,
            sid: startResponse.data.sid
        };

    } catch (error) {

        console.log("Cloud Recording Failed");
        console.log("Status:", error.response?.status);
        console.log("Response:", error.response?.data);
        console.log("Message:", error.message);

        throw error;
    }
}

async function stopCloudRecording(
    channel,
    resourceId,
    sid
) {

    if (!channel || !resourceId || !sid) {
        throw new Error(
            "channel, resourceId and sid are required"
        );
    }

    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const appId = process.env.AGORA_APP_ID;

    if (!customerId || !customerSecret || !appId) {
        throw new Error("Agora environment variables are missing");
    }

    const auth = Buffer.from(
        `${customerId}:${customerSecret}`
    ).toString("base64");

    console.log("========== STOP CLOUD RECORDING ==========");
    console.log({
        channel,
        resourceId,
        sid
    });

    try {

        const url =
            `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`;

        const response = await axios.post(
            url,
            {
                cname: channel,
                uid: "9999",
                clientRequest: {}
            },
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Cloud Recording Stopped Successfully");
        console.log(response.data);

        return response.data;

    } catch (error) {

        console.log("Cloud Recording Stop Failed");
        console.log("Status:", error.response?.status);
        console.log("Response:", error.response?.data);
        console.log("Message:", error.message);

        throw error;
    }
}

module.exports = {
    startCloudRecording,
    stopCloudRecording
};