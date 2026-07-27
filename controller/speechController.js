const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");


async function handleSpeechToTextStart(req, res) {
      console.log("Speech API Hit");
    try {
        const { channel, uid } = req.body;
        if (!channel || uid === undefined) {
            return res.status(400).json({
                message: "channel and uid are required"
            });
        }
         console.log("Calling speechService...");

        const result = await startSpeechToText(channel, uid);
        res.status(200).json(result);

    } catch (error) {
        console.error("Speech-to-Text Error:", error.message);
        res.status(500).json({
            message: "Failed to start Speech-to-Text",
            error: error.message
        });
    }
};

const Meeting = require("../models/meeting");


async function handleSpeechCallback(req, res) {
    try {
        console.log("Speech Callback:");
        console.log(req.body);
        const io = req.app.get("io");
        const body = req.body || {};
        const words = body.words || [];

        const text = words
            .filter(word => word.is_final)
            .map(word => word.text)
            .join(" ");

        const uid = Number(
            body.uid
        );

        const channel =
            body.channelName;

        if (!text || !uid || !channel) {
            return res.sendStatus(200);
        }
        const meeting =
            await Meeting.findOne({
                meetingId: channel
            });

        if (!meeting) {
            console.log(
                "Meeting not found"
            );
            return res.sendStatus(200);
        }

        const member =
            meeting.members.find(
                member =>
                member.uid === uid
            );

        let speaker = "Unknown";
        if(member){
            speaker = member.name;
        }
        meeting.transcript.push({
            uid,
            speaker,
            text
        });
        await meeting.save();
        console.log(
            `${speaker}: ${text}`
        );
        
        io.emit(
            "transcript",
            {
                uid,
                speaker,
                text
            }
        );
        res.sendStatus(200);
    } catch(error){
        console.error(
            "Speech Callback Error:",
            error
        );
        res.sendStatus(500);
    }
}

async function handleSpeechToTextStop(req, res) {
    try {
        const { agent_id } = req.body;
        if (!agent_id) {
            return res.status(400).json({
                message: "agent_id is required"
            });
        }
        const result = await stopSpeechToText(agent_id);
        res.json(result);
    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({
            message: "Failed to stop Speech-to-Text",
            error: error.message
        });
    }

};
module.exports = { handleSpeechToTextStart, handleSpeechToTextStop, handleSpeechCallback };
