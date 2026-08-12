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
// Key format:
// channel + uid + normalized text
//
// This prevents Agora from sending the exact same
// final transcript multiple times.
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

        const meeting =
            await Meeting.findOne({
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
            meeting.hostId.toString() !==
                userId.toString()
        ) {
            return res.status(403).json({
                message:
                    "Only host can start STT"
            });
        }

        if (meeting.isRecording) {
            return res.status(400).json({
                message:
                    "STT already running"
            });
        }

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

        meeting.agentId =
            result.agent_id;

        meeting.isRecording = true;

        meeting.status = "active";

        meeting.startedAt =
            new Date();

        await meeting.save();

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

async function handleSpeechCallback(
    req,
    res
) {

    try {

        console.log(
            "================ STT CALLBACK ================"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const io =
            req.app.get("io");

        const body =
            req.body || {};


        // =====================================================
        // CHANNEL
        // =====================================================

        const channel =
            body.channelName ||
            body.channel ||
            body.rtcChannelName;

        if (!channel) {

            console.log(
                "Channel missing"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // UID
        // =====================================================

        const rawUid =
            body.uid ??
            body.rtcUid ??
            body.rtcuid;

        const uid =
            Number(rawUid);

        console.log(
            "Detected UID:",
            uid
        );

        if (!Number.isFinite(uid)) {

            console.log(
                "Could not determine speaker UID"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // WORDS
        // =====================================================

        const words =
            Array.isArray(body.words)
                ? body.words
                : [];

        console.log(
            "Agora Words:",
            words
        );


        // =====================================================
        // ONLY FINAL WORDS
        // =====================================================

        const finalWords =
            words.filter(
                (word) =>
                    word &&
                    (
                        word.is_final === true ||
                        word.isFinal === true
                    )
            );


        // =====================================================
        // CREATE TEXT
        // =====================================================

        let text =
            finalWords
                .map(
                    (word) =>
                        word.text
                )
                .filter(Boolean)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();


        if (!text) {

            console.log(
                "No final transcript received"
            );

            return res.sendStatus(200);
        }

        console.log(
            "Raw final transcript:",
            text
        );


        // =====================================================
        // LANGUAGE DETECTION
        // =====================================================

        const detectedLanguage =
            body.language ||
            body.lang ||
            body.languageCode;

        console.log(
            "Detected language:",
            detectedLanguage
        );


        // =====================================================
        // HINDI DETECTION
        // =====================================================

        const containsHindi =
            /[\u0900-\u097F]/.test(text);


        // =====================================================
        // HINDI -> ROMAN HINDI
        // =====================================================

        if (
            detectedLanguage === "hi-IN" ||
            detectedLanguage === "hi" ||
            containsHindi
        ) {

            console.log(
                "Hindi detected"
            );

            console.log(
                "Before transliteration:",
                text
            );

            try {

                text =
                    await transliterateHindi(
                        text
                    );

                text =
                    String(text || "")
                        .replace(/\s+/g, " ")
                        .trim();

                console.log(
                    "After transliteration:",
                    text
                );

            } catch (
                transliterationError
            ) {

                console.error(
                    "Transliteration failed:",
                    transliterationError
                );

                // Do NOT save or emit Hindi
                return res.sendStatus(200);
            }


            // =================================================
            // SAFETY CHECK
            // =================================================
            // If Gemini somehow returns Devanagari,
            // reject it completely.
            // =================================================

            if (
                /[\u0900-\u097F]/.test(text)
            ) {

                console.log(
                    "Devanagari still present after transliteration."
                );

                console.log(
                    "Transcript rejected:",
                    text
                );

                return res.sendStatus(200);
            }
        }


        // =====================================================
        // EMPTY TEXT CHECK AFTER TRANSLITERATION
        // =====================================================

        if (!text) {

            console.log(
                "Transcript empty after processing"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // DUPLICATE PROTECTION
        // =====================================================
        //
        // IMPORTANT:
        // Duplicate checking happens AFTER transliteration.
        //
        // This means:
        //
        // Hindi -> Roman Hindi -> normalize -> duplicate check
        //
        // Example:
        //
        // Aaj hum meeting karenge
        // Aaj hum meeting karenge
        //
        // Only one will be accepted.
        // =====================================================

        const normalizedText =
            String(text)
                .toLowerCase()
                .replace(
                    /[.,!?;:"'`]/g,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        const duplicateKey =
            `${channel}:${uid}:${normalizedText}`;


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
        // STORE DUPLICATE KEY
        // =====================================================

        transcriptCache.set(
            duplicateKey,
            Date.now()
        );


        // =====================================================
        // REMOVE CACHE AFTER 10 SECONDS
        // =====================================================
        //
        // This allows the same sentence to legitimately
        // be spoken again after some time.
        // =====================================================

        setTimeout(
            () => {

                transcriptCache.delete(
                    duplicateKey
                );

            },
            10000
        );


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
                    (member) =>
                        Number(
                            member.uid
                        ) === uid
                )
                : null;


        // =====================================================
        // SPEAKER MAPPING
        // =====================================================

        let speaker =
            "Unknown";


        // Host mapping
        if (
            meeting.hostId &&
            meeting.hostId.toString() ===
                uid.toString()
        ) {

            speaker =
                meeting.hostName ||
                "Host";
        }


        // Existing host UID fallback
        else if (
            uid === 1
        ) {

            speaker =
                "Host";
        }


        // Participant mapping
        else if (member) {

            speaker =
                member.name;
        }


        console.log(
            "SPEAKER MAPPING:",
            {
                uid,
                speaker,
                memberFound:
                    !!member,
                text
            }
        );


        // =====================================================
        // SAVE TRANSCRIPT TO MONGODB
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
        // SEND TRANSCRIPT TO FRONTEND
        // =====================================================

        const transcriptData = {

            meetingId:
                channel,

            uid,

            speaker,

            text
        };


        console.log(
            "EMITTING TRANSCRIPT:",
            transcriptData
        );


        io.to(channel).emit(
            "transcript",
            transcriptData
        );


        console.log(
            "Transcript emitted successfully."
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


        // =====================================================
        // AUTHENTICATED USER
        // =====================================================

        const userId =
            req.user.id ||
            req.user._id ||
            req.user.userId;


        // =====================================================
        // ONLY HOST CAN STOP
        // =====================================================

        if (
            !userId ||
            meeting.hostId.toString() !==
                userId.toString()
        ) {

            return res.status(403).json({
                message:
                    "Only host can stop STT"
            });
        }


        // =====================================================
        // CHECK STT
        // =====================================================

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


        // =====================================================
        // STOP AGORA STT
        // =====================================================

        const result =
            await stopSpeechToText(
                meeting.agentId
            );


        // =====================================================
        // UPDATE MEETING
        // =====================================================

        meeting.isRecording =
            false;

        meeting.status =
            "ended";

        meeting.endedAt =
            new Date();

        await meeting.save();


        // =====================================================
        // NOTIFY FRONTEND
        // =====================================================

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