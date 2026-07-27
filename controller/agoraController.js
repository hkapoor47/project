const { 
    RtcTokenBuilder, 
    RtcRole 
} = require("agora-token");


async function handleGetToken(req, res) {

    try {
        const { meetingId } = req.query;
        const uid = Math.floor(
            Math.random() * 1000000
        );
        if (!meetingId) {
            return res.status(400).json({
                message: "Meeting ID is required",
            });
        }

        const appId = process.env.AGORA_APP_ID;


        const appCertificate =
            process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            return res.status(500).json({
                message: 
                "Agora credentials are missing in .env",
            });
        }
        const role = RtcRole.PUBLISHER;
        const privilegeExpireTime =
            Math.floor(Date.now() / 1000) + 3600;
        const token =
            RtcTokenBuilder.buildTokenWithUid(

                appId,

                appCertificate,

                meetingId,

                uid,

                role,

                privilegeExpireTime

            );



        return res.status(200).json({

            message:
            "Agora token generated successfully",

            channel:
            meetingId,

            uid,

            token,

            expireAt:
            privilegeExpireTime

        });


    } catch(error) {


        console.error(

            "Token Generation Error:",

            error

        );


        return res.status(500).json({

            message:
            "Failed to generate token",

            error:
            error.message

        });

    }

}


module.exports = {

    handleGetToken

};