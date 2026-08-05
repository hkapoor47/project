const axios = require("axios");


async function startCloudRecording(channel) {

    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    const appId = process.env.AGORA_APP_ID;


    const auth = Buffer.from(
        `${customerId}:${customerSecret}`
    ).toString("base64");


    try {

        // STEP 1: Acquire recording resource

        const acquireUrl =
            `https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire`;


        const acquireResponse =
            await axios.post(
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



        // STEP 2: Start recording


        const startUrl =
            `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;


        const startResponse =
            await axios.post(
                startUrl,

                {
                    cname: channel,

                    uid: "9999",

                    clientRequest: {

                        // audio only
                        recordingConfig: {

                            channelType: 0,

                            streamTypes: 0,

                            audioProfile: 1
                        },


                        storageConfig: {

                            vendor: Number(process.env.AGORA_STORAGE_VENDOR),

                            region: Number(process.env.AGORA_STORAGE_REGION),

                            bucket:
                            process.env.AGORA_STORAGE_BUCKET,

                            accessKey:
                            process.env.AGORA_STORAGE_ACCESS_KEY,

                            secretKey:
                            process.env.AGORA_STORAGE_SECRET_KEY,

                            fileNamePrefix:[
                                "recordings",
                                channel
                            ]
                        }
                    }
                },

                {
                    headers:{
                        Authorization:`Basic ${auth}`,
                        "Content-Type":"application/json"
                    }
                }
            );


        return {

            resourceId,

            sid:
            startResponse.data.sid

        };


    } catch(error){

        console.log(
            "Cloud Recording Error:"
        );

        console.log(
            error.response?.data ||
            error.message
        );

        throw error;
    }
}

async function stopCloudRecording(
    channel,
    resourceId,
    sid
) {
    if(!resourceId || !sid || !channel){
    throw new Error(
        "channel, resourceId and sid are required"
    );
}

    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
    const appId = process.env.AGORA_APP_ID;


    const auth = Buffer.from(
        `${customerId}:${customerSecret}`
    ).toString("base64");


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


        return response.data;


    } catch(error) {

        console.log(
            "Stop Cloud Recording Error:"
        );

        console.log(
            error.response?.data ||
            error.message
        );

        throw error;
    }
}

module.exports = {
    startCloudRecording,
    stopCloudRecording
};