const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");

const Meeting = require("../models/meeting");

async function handleSpeechToTextStart(req, res) {
    try {
        console.log("Request Body:", req.body);
        console.log("Authenticated User:", req.user);

        const { channel } = req.body;

        if (!channel) {
            return res.status(400).json({
                message:"channel is required"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId: channel
        });

        if(!meeting){
            return res.status(404).json({
                message:"Meeting not found"
            });
        }

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;

        if(
            !userId ||
            meeting.hostId.toString() !== userId.toString()
        ){
            return res.status(403).json({
                message:"Only host can start STT"
            });
        }

        if(meeting.isRecording){
            return res.status(400).json({
                message:"STT already running"
            });
        }

        console.log("Starting Agora Speech To Text...");

        const result =
            await startSpeechToText(channel);

        console.log(
            "Agora STT Result:",
            result
        );

        meeting.agentId =
            result.agent_id;

        meeting.isRecording = true;
        meeting.status="active";
        meeting.startedAt = new Date();

        await meeting.save();

        const io = req.app.get("io");

        io.to(channel).emit(
            "recording-started"
        );

        return res.status(200).json({
            message:
            "Speech To Text started successfully",

            agent_id:
            result.agent_id
        });

    } catch(error){
        console.log(
            error.response?.data ||
            error.message
        );

        return res.status(500).json({
            message:"Failed to start STT",
            error:
            error.response?.data ||
            error.message
        });
    }
}

async function handleSpeechCallback(req, res) {
    try {
        console.log(
            JSON.stringify(req.body, null, 2)
        );

        const io = req.app.get("io");
        const body = req.body || {};

        const channel =
            body.channelName ||
            body.channel ||
            body.rtcChannelName;

        if (!channel) {
            console.log("Channel missing");
            return res.sendStatus(200);
        }

        const rawUid =
            body.uid ??
            body.rtcUid ??
            body.rtcuid;

        const uid = Number(rawUid);

        console.log("Detected UID:", uid);

        if (!Number.isFinite(uid)) {
            console.log(
                "Could not determine speaker UID"
            );
            return res.sendStatus(200);
        }

        const words = Array.isArray(body.words)
            ? body.words
            : [];

        const finalWords = words.filter(
            word =>
                word.is_final === true ||
                word.isFinal === true
        );

        const text = finalWords
            .map(word => word.text)
            .filter(Boolean)
            .join(" ")
            .trim();

        if (!text) {
            console.log(
                "No final transcript received"
            );

            return res.sendStatus(200);
        }

        const meeting =
            await Meeting.findOne({
                meetingId: channel
            });

        if (!meeting) {
            console.log(
                "Meeting not found:",
                channel
            );
            return res.sendStatus(200);
        }

        const member =
            meeting.members.find(
                member =>
                    Number(member.uid) === uid
            );

        let speaker = "Unknown";

        if (uid === 1) {
            speaker = "Host";
        } else if (member) {
            speaker = member.name;
        }

        console.log(
            "Speaker Mapping:",
            {
                uid,
                speaker,
                memberFound: !!member
            }
        );

        meeting.transcript.push({
            uid,
            speaker,
            text
        });

        await meeting.save();

        console.log(
            `Transcript Saved -> ${speaker}: ${text}`
        );

        io.to(channel).emit(
            "transcript",
            {
                uid,
                speaker,
                text
            }
        );
        console.log(
            "Transcript emitted to clients."
        );
        return res.sendStatus(200);
    } catch (error) {
        console.error(
            "Speech callback error:",
            error
        );
        return res.sendStatus(500);
    }
}

async function handleSpeechToTextStop(req,res){
    try{
        const {channel}=req.body;
        if(!channel){
            return res.status(400).json({
                message:"channel is required"
            });
        }

        const meeting =
        await Meeting.findOne({
            meetingId:channel
        });

        if(!meeting){
            return res.status(404).json({
                message:"Meeting not found"
            });
        }

        const userId =
        req.user.id ||
        req.user._id ||
        req.user.userId;

        if(
            !userId ||
            meeting.hostId.toString()
            !== userId.toString()
        ){
            return res.status(403).json({
                message:"Only host can stop STT"
            });
        }

        if(!meeting.agentId){
            return res.status(400).json({
                message:"STT is not running"
            });
        }

        console.log(
            "Stopping Agora STT:",
            meeting.agentId
        );

        const result =
        await stopSpeechToText(
            meeting.agentId
        );

        meeting.isRecording=false;
        meeting.status="ended";
        meeting.endedAt=new Date();

        await meeting.save();

        const io=req.app.get("io");

        io.to(channel).emit(
            "recording-stopped"
        );

        return res.json({
            message: "Speech To Text stopped successfully",
            result
        });

    }catch(error){
        console.log(
            error.response?.data ||
            error.message
        );

        return res.status(500).json({
            message:"Failed to stop STT",
            error:
            error.response?.data ||
            error.message
        });
    }
}

module.exports = { handleSpeechToTextStart, handleSpeechToTextStop, handleSpeechCallback };