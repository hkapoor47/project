const { RtcTokenBuilder, RtcRole } = require("agora-token");

async function handleGetToken(req, res) {
    try {
        const channelName = req.query.channel;
        const uid = Number(req.query.uid);

        if (!channelName) {
            return res.status(400).json({
                message: "Channel name is required",
            });
        }

        if (isNaN(uid)) {
            return res.status(400).json({
                message: "Valid uid is required",
            });
        }

        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            return res.status(500).json({
                message: "Agora credentials are missing in .env",
            });
        }

        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpireTime =
            currentTimestamp + expirationTimeInSeconds;

        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            role,
            privilegeExpireTime
        );

        return res.status(200).json({
            token,
            expireAt: privilegeExpireTime,
        });
    } catch (error) {
        console.error("Token Generation Error:", error);

        return res.status(500).json({
            message: "Failed to generate token",
            error: error.message,
        });
    }
}

module.exports = {
    handleGetToken,
};