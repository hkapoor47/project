const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");

const Meeting = require("../models/meeting");
const User = require("../models/user");

const transcriptHistory = new Map();


// =====================================================
// START SPEECH TO TEXT
// =====================================================

async function handleSpeechToTextStart(req, res) {
    try {
        console.log("Request Body:", req.body);
        console.log("Authenticated User:", req.user);

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

        if (
            !userId ||
            !meeting.hostId ||
            meeting.hostId.toString() !== userId.toString()
        ) {
            return res.status(403).json({
                message: "Only host can start STT"
            });
        }

        if (meeting.isRecording) {
            return res.status(400).json({
                message: "STT already running"
            });
        }

        console.log(
            "Starting Agora Speech To Text..."
        );

        const result = await startSpeechToText(
            channel
        );

        console.log(
            "Agora STT Result:",
            result
        );

        meeting.agentId = result.agent_id;
        meeting.isRecording = true;
        meeting.status = "active";
        meeting.startedAt = new Date();

        await meeting.save();

        const io = req.app.get("io");

        io.to(channel).emit(
            "recording-started"
        );

        return res.status(200).json({
            message:
                "Speech To Text started successfully",
            agent_id: result.agent_id
        });

    } catch (error) {
        console.error(
            "STT START ERROR:",
            error.response?.data ||
            error.message
        );

        return res.status(500).json({
            message: "Failed to start STT",
            error:
                error.response?.data ||
                error.message
        });
    }
}


// =====================================================
// AGORA SPEECH CALLBACK
// =====================================================

async function handleSpeechCallback(req, res) {
    try {
        console.log("=================================");
        console.log("✅ CALLBACK HIT");
        console.log("=================================");

        console.log(
            "Callback received:",
            JSON.stringify(req.body, null, 2)
        );

        const io = req.app.get("io");
        const body = req.body || {};

        // =================================================
        // CHANNEL
        // =================================================

        const channel =
            body.channelName ||
            body.channel ||
            body.rtcChannelName;

        if (!channel) {
            console.log(
                "❌ Channel missing in callback"
            );

            return res.sendStatus(200);
        }

        // =================================================
        // UID
        // =================================================

        const rawUid =
            body.uid ??
            body.rtcUid ??
            body.rtcuid;

        const uid = Number(rawUid);

        console.log(
            "Speaker UID:",
            uid
        );

        if (!Number.isFinite(uid)) {
            console.log(
                "❌ Invalid UID"
            );

            return res.sendStatus(200);
        }

        // =================================================
        // FINAL WORDS
        // =================================================

        const words =
            Array.isArray(body.words)
                ? body.words
                : [];

        const finalWords =
            words.filter(
                (word) =>
                    word &&
                    (
                        word.is_final === true ||
                        word.isFinal === true
                    )
            );

        if (!finalWords.length) {
            console.log(
                "No final words - skipping"
            );

            return res.sendStatus(200);
        }

        // =================================================
        // ENGLISH TRANSLATION
        // =================================================

        const trans =
            Array.isArray(body.trans)
                ? body.trans
                : [];

        console.log(
            "Translation data:",
            JSON.stringify(trans, null, 2)
        );

        let text = "";

        /*
         * Find English translation.
         *
         * Agora may return lang in slightly
         * different formats, so support:
         *
         * en-US
         * en
         */

        const englishTrans =
            trans.find(
                (item) => {
                    const lang =
                        String(
                            item?.lang || ""
                        ).toLowerCase();

                    return (
                        (
                            lang === "en-us" ||
                            lang === "en"
                        ) &&
                        Array.isArray(
                            item?.texts
                        ) &&
                        item.texts.length > 0
                    );
                }
            );

        if (englishTrans) {
            text =
                englishTrans.texts
                    .map(
                        (value) =>
                            String(value || "")
                    )
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();

            console.log(
                "✅ English translation:",
                text
            );
        }

        /*
         * IMPORTANT:
         *
         * DO NOT FALL BACK TO finalWords.
         *
         * finalWords may contain Hindi.
         *
         * We only want English.
         */

        if (!text) {
            console.log(
                "⚠️ No English translation available yet."
            );

            return res.sendStatus(200);
        }

        // =================================================
        // DUPLICATE CHECK
        // =================================================

        const sentenceId =
            body.sentence_id ||
            body.sentenceId;

        const dedupKey =
            sentenceId
                ? `${channel}-${sentenceId}`
                : `${channel}-${uid}-${text.toLowerCase()}`;

        if (
            transcriptHistory.has(
                dedupKey
            )
        ) {
            console.log(
                "Duplicate transcript ignored:",
                dedupKey
            );

            return res.sendStatus(200);
        }

        transcriptHistory.set(
            dedupKey,
            Date.now()
        );

        // Clean old entries
        const now = Date.now();

        for (
            const [
                key,
                timestamp
            ] of transcriptHistory
        ) {
            if (
                now - timestamp > 30000
            ) {
                transcriptHistory.delete(
                    key
                );
            }
        }

        // =================================================
        // FIND MEETING
        // =================================================

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

        // =================================================
        // FIND SPEAKER
        // =================================================

        let speaker = null;

        // -------------------------------------------------
        // HOST
        // -------------------------------------------------

        if (
            uid === 1 &&
            meeting.hostId
        ) {
            const host =
                await User.findById(
                    meeting.hostId
                ).select(
                    "name email"
                );

            if (host) {
                speaker =
                    host.name ||
                    host.email ||
                    "Host";

                console.log(
                    "✅ Host resolved:",
                    {
                        speaker,
                        uid
                    }
                );
            }
        }

        // -------------------------------------------------
        // PARTICIPANT
        // -------------------------------------------------

        if (
            !speaker &&
            Array.isArray(
                meeting.members
            )
        ) {
            const member =
                meeting.members.find(
                    (member) =>
                        Number(member.uid) === uid
                );

            if (member) {
                speaker =
                    member.name ||
                    member.email ||
                    "Participant";

                console.log(
                    "✅ Participant resolved:",
                    {
                        speaker,
                        uid
                    }
                );
            }
        }

        // -------------------------------------------------
        // FALLBACK
        // -------------------------------------------------

        if (!speaker) {
            speaker = "Unknown";

            console.log(
                "⚠️ Speaker could not be resolved:",
                {
                    uid,
                    meetingId: channel,
                    members: meeting.members
                }
            );
        }

        console.log(
            "FINAL TRANSCRIPT:",
            {
                speaker,
                uid,
                text
            }
        );

        // =================================================
        // SAVE TO MONGODB
        // =================================================

        if (
            !Array.isArray(
                meeting.transcript
            )
        ) {
            meeting.transcript = [];
        }

        meeting.transcript.push({
            uid,
            speaker,
            text,
            timestamp: new Date()
        });

        await meeting.save();

        console.log(
            "✅ Transcript saved to MongoDB"
        );

        // =================================================
        // SEND TO FRONTEND
        // =================================================

        const transcriptData = {
            meetingId: channel,
            uid,
            speaker,
            text
        };

        console.log(
            "📤 EMITTING TRANSCRIPT:",
            transcriptData
        );

        io.to(channel).emit(
            "transcript",
            transcriptData
        );

        return res.sendStatus(200);

    } catch (error) {
        console.error(
            "❌ Speech callback error:",
            error
        );

        return res.sendStatus(500);
    }
}


// =====================================================
// STOP SPEECH TO TEXT
// =====================================================

async function handleSpeechToTextStop(
    req,
    res
) {
    try {
        const { channel } = req.body;

        if (!channel) {
            return res.status(400).json({
                message:
                    "channel is required"
            });
        }

        const meeting =
            await Meeting.findOne({
                meetingId: channel
            });

        if (!meeting) {
            return res.status(404).json({
                message:
                    "Meeting not found"
            });
        }

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;

        if (
            !userId ||
            !meeting.hostId ||
            meeting.hostId.toString() !==
                userId.toString()
        ) {
            return res.status(403).json({
                message:
                    "Only host can stop STT"
            });
        }

        if (!meeting.agentId) {
            return res.status(400).json({
                message:
                    "STT is not running"
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

        meeting.isRecording = false;
        meeting.status = "ended";
        meeting.endedAt = new Date();

        await meeting.save();

        const io =
            req.app.get("io");

        io.to(channel).emit(
            "recording-stopped"
        );

        return res.json({
            message:
                "Speech To Text stopped successfully",
            result
        });

    } catch (error) {
        console.error(
            "STT STOP ERROR:",
            error.response?.data ||
            error.message
        );

        return res.status(500).json({
            message:
                "Failed to stop STT",
            error:
                error.response?.data ||
                error.message
        });
    }
}


module.exports = {
    handleSpeechToTextStart,
    handleSpeechToTextStop,
    handleSpeechCallback
};