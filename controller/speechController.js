const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");

const {
    transliterateHindi
} = require("../services/transliterationService");

const Meeting = require("../models/meeting");


// =====================================================
// DUPLICATE TRANSCRIPT CACHE
// =====================================================

const transcriptCache = new Map();


// =====================================================
// START SPEECH TO TEXT
// =====================================================

async function handleSpeechToTextStart(req, res) {

    try {

        console.log(
            "Request Body:",
            req.body
        );

        console.log(
            "Authenticated User:",
            req.user
        );

        const { channel } = req.body;

        if (!channel) {
            return res.status(400).json({
                message: "channel is required"
            });
        }


        // =================================================
        // FIND MEETING
        // =================================================

        const meeting =
            await Meeting.findOne({
                meetingId: channel
            });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }


        // =================================================
        // AUTHENTICATED USER
        // =================================================

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
                    "Only host can start STT"
            });
        }


        // =================================================
        // CHECK IF ALREADY RECORDING
        // =================================================

        if (meeting.isRecording) {
            return res.status(400).json({
                message:
                    "STT already running"
            });
        }


        // =================================================
        // START AGORA STT
        // =================================================

        console.log(
            "Starting Agora Speech To Text..."
        );

        const result =
            await startSpeechToText(
                channel
            );

        console.log(
            "Agora STT Result:",
            result
        );


        // =================================================
        // SAVE STT INFORMATION
        // =================================================

        meeting.agentId =
            result.agent_id;

        meeting.isRecording =
            true;

        meeting.status =
            "active";

        meeting.startedAt =
            new Date();

        await meeting.save();


        // =================================================
        // NOTIFY PARTICIPANTS
        // =================================================

        const io =
            req.app.get("io");

        io.to(channel).emit(
            "recording-started"
        );


        return res.status(200).json({

            message:
                "Speech To Text started successfully",

            agent_id:
                result.agent_id
        });


    } catch (error) {

        console.error(
            "STT START ERROR:",
            error.response?.data ||
            error.message
        );

        return res.status(500).json({

            message:
                "Failed to start STT",

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

        console.log(
            "================ STT CALLBACK ================"
        );

        const body = req.body || {};
        const io = req.app.get("io");

        console.log(
            "Agora Callback:",
            JSON.stringify(body, null, 2)
        );


        // =====================================================
        // CHANNEL
        // =====================================================

        const channel =
            body.channelName ||
            body.channel ||
            body.rtcChannelName;

        if (!channel) {
            console.log("Channel missing");
            return res.sendStatus(200);
        }


        // =====================================================
        // UID
        // =====================================================

        const rawUid =
            body.uid ??
            body.rtcUid ??
            body.rtcuid;

        const uid = Number(rawUid);

        if (!Number.isFinite(uid)) {
            console.log(
                "Invalid UID:",
                rawUid
            );

            return res.sendStatus(200);
        }

        console.log(
            "Detected UID:",
            uid
        );


        // =====================================================
        // WORDS
        // =====================================================

        const words =
            Array.isArray(body.words)
                ? body.words
                : [];

        if (!words.length) {
            console.log(
                "No words received"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // ONLY FINAL WORDS
        // =====================================================

        const finalWords =
            words.filter(word => {

                if (!word) {
                    return false;
                }

                return (
                    word.is_final === true ||
                    word.isFinal === true
                );
            });


        if (!finalWords.length) {

            console.log(
                "No final words received"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // CREATE TRANSCRIPT TEXT
        // =====================================================

        let text =
            finalWords
                .map(word => word.text)
                .filter(
                    value =>
                        typeof value === "string" &&
                        value.trim()
                )
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();


        if (!text) {

            console.log(
                "Empty transcript"
            );

            return res.sendStatus(200);
        }


        console.log(
            "Raw transcript:",
            text
        );


        // =====================================================
        // HINDI DETECTION
        // =====================================================

        const containsHindi =
            /[\u0900-\u097F]/.test(text);


        // =====================================================
        // HINDI -> ROMAN HINDI
        // =====================================================

        if (containsHindi) {

            console.log(
                "Hindi detected"
            );

            console.log(
                "Before transliteration:",
                text
            );

            try {

                const transliteratedText =
                    await transliterateHindi(text);


                text =
                    String(
                        transliteratedText || ""
                    )
                        .replace(/\s+/g, " ")
                        .trim();


                console.log(
                    "After transliteration:",
                    text
                );

            } catch (error) {

                console.error(
                    "Transliteration error:",
                    error.message
                );

                // Never send original Hindi
                return res.sendStatus(200);
            }


            // =================================================
            // REJECT IF HINDI STILL EXISTS
            // =================================================

            if (
                /[\u0900-\u097F]/.test(text)
            ) {

                console.log(
                    "Hindi still exists after transliteration."
                );

                return res.sendStatus(200);
            }
        }


        // =====================================================
        // EMPTY AFTER TRANSLITERATION
        // =====================================================

        if (!text) {

            console.log(
                "Transcript empty after transliteration"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // FINAL HINDI SAFETY CHECK
        // =====================================================

        if (
            /[\u0900-\u097F]/.test(text)
        ) {

            console.log(
                "BLOCKED Hindi transcript:",
                text
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // NORMALIZE TEXT FOR DUPLICATE CHECK
        // =====================================================

        const normalizedText =
            text
                .toLowerCase()
                .replace(
                    /[.,!?;:"'`।]/g,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!normalizedText) {
            return res.sendStatus(200);
        }


        // =====================================================
        // DUPLICATE KEY
        // =====================================================

        const duplicateKey =
            `${channel}:${uid}:${normalizedText}`;


        // =====================================================
        // DUPLICATE CHECK
        // =====================================================

        if (
            transcriptCache.has(
                duplicateKey
            )
        ) {

            console.log(
                "Duplicate transcript ignored:",
                text
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // SAVE DUPLICATE KEY
        // =====================================================

        transcriptCache.set(
            duplicateKey,
            Date.now()
        );


        // Remove after 10 seconds
        setTimeout(() => {

            transcriptCache.delete(
                duplicateKey
            );

        }, 10000);


        // =====================================================
        // FIND MEETING
        // =====================================================

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


        // =====================================================
        // FIND PARTICIPANT
        // =====================================================

        const member =
            Array.isArray(
                meeting.members
            )
                ? meeting.members.find(
                    member =>
                        Number(
                            member.uid
                        ) === uid
                )
                : null;


        // =====================================================
        // SPEAKER
        // =====================================================

        let speaker = "Unknown";


        if (
            meeting.hostId &&
            meeting.hostId.toString() ===
                uid.toString()
        ) {

            speaker =
                meeting.hostName ||
                "Host";

        } else if (
            uid === 1
        ) {

            speaker = "Host";

        } else if (
            member
        ) {

            speaker =
                member.name;
        }


        console.log(
            "Speaker mapping:",
            {
                uid,
                speaker,
                text
            }
        );


        // =====================================================
        // SAVE TRANSCRIPT
        // =====================================================

        meeting.transcript.push({

            uid,

            speaker,

            text
        });


        await meeting.save();


        console.log(
            `Transcript Saved -> ${speaker}: ${text}`
        );


        // =====================================================
        // SEND TO FRONTEND
        // =====================================================

        const transcriptData = {

            meetingId:
                channel,

            uid,

            speaker,

            text
        };


        io.to(channel).emit(
            "transcript",
            transcriptData
        );


        console.log(
            "Transcript emitted:",
            transcriptData
        );


        console.log(
            "================================================"
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



// =====================================================
// STOP SPEECH TO TEXT
// =====================================================

async function handleSpeechToTextStop(
    req,
    res
) {

    try {

        const { channel } =
            req.body;

        if (!channel) {

            return res.status(400).json({
                message:
                    "channel is required"
            });
        }


        // =================================================
        // FIND MEETING
        // =================================================

        const meeting =
            await Meeting.findOne({
                meetingId:
                    channel
            });

        if (!meeting) {

            return res.status(404).json({
                message:
                    "Meeting not found"
            });
        }


        // =================================================
        // AUTHENTICATED USER
        // =================================================

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;


        // =================================================
        // ONLY HOST
        // =================================================

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


        // =================================================
        // CHECK STT
        // =================================================

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


        // =================================================
        // STOP AGORA STT
        // =================================================

        const result =
            await stopSpeechToText(
                meeting.agentId
            );


        // =================================================
        // UPDATE MEETING
        // =================================================

        meeting.isRecording =
            false;

        meeting.status =
            "ended";

        meeting.endedAt =
            new Date();

        await meeting.save();


        // =================================================
        // NOTIFY FRONTEND
        // =================================================

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


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    handleSpeechToTextStart,

    handleSpeechToTextStop,

    handleSpeechCallback
};