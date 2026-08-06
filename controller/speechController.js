const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");

const {
    startCloudRecording,
    stopCloudRecording
} = require("../services/recordingService");

const Meeting = require("../models/meeting");

async function handleSpeechToTextStart(req, res) {

    console.log("========== Speech API Hit ==========");

    try {

        console.log("Request Body:", req.body);
        console.log("Authenticated User:", req.user);

        const { channel, uid } = req.body;

        if (!channel || uid === undefined) {
            return res.status(400).json({
                message: "channel and uid are required"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId: channel
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;

        if (!userId || meeting.hostId.toString() !== userId) {
            return res.status(403).json({
                message: "Only host can start recording"
            });
        }

        if (meeting.isRecording) {
            return res.status(400).json({
                message: "Recording already started"
            });
        }

        console.log("Meeting Found:", meeting.meetingId);
        console.log("Starting Cloud Recording...");

        const recording =
            await startCloudRecording(channel);

        console.log("Cloud Recording Started:");
        console.log(recording);

        let result;

        try {

            console.log("Starting Speech To Text...");

            result = await startSpeechToText(
                channel,
                uid
            );

            console.log("Speech To Text Started:");
            console.log(result);

        } catch (sttError) {

            console.log("STT failed. Stopping Cloud Recording...");

            try {

                await stopCloudRecording(
                    channel,
                    recording.resourceId,
                    recording.sid
                );

                console.log("Cloud Recording stopped successfully.");

            } catch (stopError) {

                console.log(
                    "Failed to stop Cloud Recording:"
                );

                console.log(
                    stopError.response?.data ||
                    stopError.message
                );
            }

            throw sttError;
        }

        meeting.agentId = result.agent_id;
        meeting.resourceId = recording.resourceId;
        meeting.sid = recording.sid;
        meeting.isRecording = true;
        meeting.status = "active";
        meeting.startedAt = new Date();

        await meeting.save();

        console.log("Meeting updated successfully.");

        const io = req.app.get("io");

        io.to(channel).emit("recording-started");

        return res.status(200).json({
            message: "Recording and STT started successfully",
            agent_id: result.agent_id,
            resourceId: recording.resourceId,
            sid: recording.sid
        });

    } catch (error) {

        console.log("========== Speech Start Error ==========");

        console.log("Status:", error.response?.status);

        console.log(
            "Response:",
            error.response?.data
        );

        console.log(
            "Message:",
            error.message
        );

        return res.status(500).json({
            message: "Failed to start STT",
            error: error.response?.data || error.message
        });
    }
}


async function handleSpeechCallback(req, res) {

    console.log("========== AGORA STT CALLBACK ==========");

    try {

        console.log(
            "Callback Body:",
            JSON.stringify(req.body, null, 2)
        );

        const io = req.app.get("io");

        const body = req.body || {};

        const words = body.words || [];

        const text = words
            .filter(word => word.is_final)
            .map(word => word.text)
            .join(" ");

        const uid = Number(body.uid);

        const channel = body.channelName;

        console.log({
            channel,
            uid,
            text
        });

        if (!channel) {
            console.log("Channel missing.");
            return res.sendStatus(200);
        }

        if (!uid) {
            console.log("UID missing.");
            return res.sendStatus(200);
        }

        if (!text) {
            console.log("No final transcript received.");
            return res.sendStatus(200);
        }

        const meeting = await Meeting.findOne({
            meetingId: channel
        });

        if (!meeting) {

            console.log(
                "Meeting not found:",
                channel
            );

            return res.sendStatus(200);
        }

        const member = meeting.members.find(
            member => member.uid === uid
        );

        let speaker = "Unknown";

        if (uid === 1) {

            speaker = "Host";

        } else if (member) {

            speaker = member.name;
        }

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

        console.log("========== CALLBACK ERROR ==========");

        console.log(error);

        console.log(
            error.response?.data
        );

        return res.sendStatus(500);
    }
}

async function handleSpeechToTextStop(req, res) {
    try {
        const { channel } = req.body;

        if (!channel) {
            return res.status(400).json({
                message: "channel is required"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId: channel
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;

        if (!userId || meeting.hostId.toString() !== userId) {
            return res.status(403).json({
                message: "Only host can stop recording"
            });
        }

        if (!meeting.agentId) {
            return res.status(400).json({
                message: "STT is not running"
            });
        }

        console.log("========== STOP STT ==========");
        console.log("Channel:", channel);
        console.log("Agent ID:", meeting.agentId);
        console.log("Resource ID:", meeting.resourceId);
        console.log("SID:", meeting.sid);

        // Stop Speech-to-Text
        const sttResult = await stopSpeechToText(
            meeting.agentId
        );

        // Stop Cloud Recording (if running)
        let recordingResult = null;

        if (meeting.resourceId && meeting.sid) {
            recordingResult = await stopCloudRecording(
                channel,
                meeting.resourceId,
                meeting.sid
            );
        }

        meeting.isRecording = false;
        meeting.status = "ended";
        meeting.endedAt = new Date();

        await meeting.save();

        const io = req.app.get("io");

        io.to(channel).emit("recording-stopped");

        console.log("STT stopped successfully");
        console.log("==============================");

        return res.status(200).json({
            success: true,
            message: "Recording and STT stopped successfully",
            sttResult,
            recordingResult
        });

    } catch (error) {
        console.log("STOP STT ERROR");
        console.log(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to stop STT",
            error: error.response?.data || error.message
        });
    }
}


module.exports = { handleSpeechToTextStart, handleSpeechToTextStop, handleSpeechCallback };
