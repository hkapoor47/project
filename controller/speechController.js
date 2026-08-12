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

// =====================================================
// AGORA SPEECH CALLBACK
// =====================================================

async function handleSpeechCallback(req, res) {

    try {

        console.log(
            "================ STT CALLBACK ================"
        );

        console.log(
            JSON.stringify(req.body, null, 2)
        );

        const io = req.app.get("io");

        const body = req.body || {};


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

        const uid = Number(rawUid);

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
        // HINDI DETECTION
        // =====================================================

        const containsHindi =
            /[\u0900-\u097F]/.test(text);


        // =====================================================
        // HINDI -> ROMAN HINDI
        // =====================================================

        if (containsHindi) {

            console.log(
                "Hindi/Devanagari detected"
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
                    "Transliteration failed:",
                    error.message
                );

                // Never save/send Hindi
                return res.sendStatus(200);
            }


            // =================================================
            // SAFETY CHECK
            // =================================================

            if (
                /[\u0900-\u097F]/.test(text)
            ) {

                console.error(
                    "Hindi still present after transliteration."
                );

                console.error(
                    "Rejected text:",
                    text
                );

                return res.sendStatus(200);
            }
        }


        // =====================================================
        // EMPTY TEXT CHECK
        // =====================================================

        if (!text) {

            console.log(
                "Transcript empty after processing"
            );

            return res.sendStatus(200);
        }


        // =====================================================
        // FINAL HINDI SAFETY CHECK
        // =====================================================

        if (
            /[\u0900-\u097F]/.test(text)
        ) {

            console.error(
                "BLOCKED: Hindi reached save stage:",
                text
            );

            return res.sendStatus(200);
        }


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
        // DEBUG MEMBERS
        // =====================================================

        console.log(
            "Meeting members:",
            meeting.members
        );


        console.log(
            "Current transcript UID:",
            uid
        );


        // =====================================================
        // SPEAKER MAPPING
        // =====================================================

        let speaker = null;


        // =====================================================
        // HOST CHECK
        // =====================================================

        if (
            meeting.hostId &&
            String(meeting.hostId) ===
                String(uid)
        ) {

            speaker =
                meeting.hostName ||
                "Host";
        }


        // =====================================================
        // MEMBER CHECK
        // =====================================================

        if (
            !speaker &&
            Array.isArray(meeting.members)
        ) {

            const member =
                meeting.members.find(
                    (member) =>
                        Number(member.uid) ===
                        Number(uid)
                );


            if (member) {

                speaker =
                    member.name ||
                    member.email ||
                    "Participant";

                console.log(
                    "Member found:",
                    {
                        uid,
                        name:
                            member.name,
                        email:
                            member.email
                    }
                );
            }
        }


        // =====================================================
        // HOST UID FALLBACK
        // =====================================================

        if (
            !speaker &&
            Number(uid) === 1
        ) {

            speaker =
                meeting.hostName ||
                "Host";
        }


        // =====================================================
        // LAST FALLBACK
        // =====================================================

        if (!speaker) {

            speaker =
                `Participant ${uid}`;

            console.log(
                "Speaker not found in meeting.members:",
                {
                    uid,
                    speaker
                }
            );
        }


        // =====================================================
        // SPEAKER DEBUG
        // =====================================================

        console.log(
            "FINAL SPEAKER MAPPING:",
            {
                uid,
                speaker,
                text
            }
        );


        // =====================================================
        // DUPLICATE PROTECTION
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
        // SAVE DUPLICATE KEY
        // =====================================================

        transcriptCache.set(
            duplicateKey,
            Date.now()
        );


        // =====================================================
        // DELETE CACHE AFTER 10 SECONDS
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
        // SAVE TRANSCRIPT
        // =====================================================

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