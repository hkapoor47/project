const express = require("express");
const router = express.Router();

const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

router.get("/token", (req, res) => {

    const channelName = req.query.channel;
    const uid = Number(req.query.uid);

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    console.log("App ID:", appId);
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        privilegeExpireTime
    );

    res.json({
        token,
        expireAt: privilegeExpireTime
    });
});

module.exports = router;