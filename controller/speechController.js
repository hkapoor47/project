const {
    startSpeechToText,
    stopSpeechToText
} = require("../services/speechService");

const Meeting = require("../models/meeting");


async function handleSpeechToTextStart(req, res) {

    try {
        console.log("Request Body:",req.body);
        console.log("Authenticated User:", req.user);

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
            !meeting.hostId ||
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

        console.log("Starting Agora Speech To Text...");

        const result =
            await startSpeechToText(
                channel
            );

        console.log("Agora STT Result:",result);

        meeting.agentId =result.agent_id;
        meeting.isRecording =true;
        meeting.status ="active";
        meeting.startedAt =new Date();
        await meeting.save();

        const io =req.app.get("io");

        io.to(channel).emit(
            "recording-started"
        );

        return res.status(200).json({
            message:"Speech To Text started successfully",
            agent_id:result.agent_id
        });

    } catch (error) {
        console.error("STT START ERROR:",
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
     console.log("✅ CALLBACK HIT");
    console.log("Callback received:", JSON.stringify(req.body, null, 2));

    const io = req.app.get("io");
    const body = req.body || {};

    const channel =
      body.channelName ||
      body.channel ||
      body.rtcChannelName;

    if (!channel) {
      console.log("Channel missing in callback");
      return res.sendStatus(200);
    }

   
    const dataType = body.data_type || body.dataType || "";
    console.log("Data type:", dataType);

    const words = Array.isArray(body.words) ? body.words : [];
    console.log("Words received:", JSON.stringify(words));

    
    const finalWords = words.filter(
      (word) => word && (word.is_final === true || word.isFinal === true)
    );

    if (!finalWords.length) {
      console.log("No final words, skipping");
      return res.sendStatus(200);
    }

   
    const trans = Array.isArray(body.trans) ? body.trans : [];
    const englishTrans = trans.find(
      (t) => t.lang === "en-US" && Array.isArray(t.texts) && t.texts.length > 0
    );

    let text = "";

    if (englishTrans) {
      
      text = englishTrans.texts.join(" ").replace(/\s+/g, " ").trim();
      console.log("Using Agora translation:", text);
    } else {
    
      text = finalWords
        .map((word) => String(word.text || "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      console.log("Using original text:", text);
    }

    if (!text) {
      console.log("Empty text, skipping");
      return res.sendStatus(200);
    }


    const sentenceId = body.sentence_id || body.sentenceId;
    if (!transcriptHistory.has(channel)) {
      transcriptHistory.set(channel, new Map());
    }
    const meetingHistory = transcriptHistory.get(channel);
    const dedupKey = sentenceId ? `${sentenceId}-final` : text.toLowerCase();
    const now = Date.now();

    if (meetingHistory.has(dedupKey)) {
      console.log("Duplicate, skipping:", dedupKey);
      return res.sendStatus(200);
    }

    meetingHistory.set(dedupKey, now);

    for (const [key, timestamp] of meetingHistory) {
      if (now - timestamp > 30000) meetingHistory.delete(key);
    }

    
    const meeting = await Meeting.findOne({ meetingId: channel });

    if (!meeting) {
      console.log("Meeting not found:", channel);
      return res.sendStatus(200);
    }

  
    const rawUid = body.uid ?? body.rtcUid ?? body.rtcuid;
    const uid = Number(rawUid);
    console.log("Speaker UID from callback:", uid);

    let speaker = null;

    
    if (Array.isArray(meeting.members)) {
      const member = meeting.members.find(
        (m) => Number(m.uid) === uid
      );
      if (member) {
        speaker = member.name || member.email || "Participant";
        console.log("Found speaker in members:", speaker);
      }
    }

   
    if (!speaker && uid === 1) {
      speaker = meeting.hostName || "Host";
    }

    if (!speaker) {
      speaker = meeting.hostName || "Host";
      console.log("Fallback to host name:", speaker);
    }

  
    if (!Array.isArray(meeting.transcript)) {
      meeting.transcript = [];
    }
    meeting.transcript.push({ uid, speaker, text });
    await meeting.save();

    const transcriptData = { meetingId: channel, uid, speaker, text };
    console.log("EMITTING TRANSCRIPT:", transcriptData);

    io.to(channel).emit("transcript", transcriptData);

    return res.sendStatus(200);

  } catch (error) {
    console.error("Speech callback error:", error);
    return res.sendStatus(500);
  }
}


async function handleSpeechToTextStop(
    req,
    res
) {

    try {
        const { channel } = req.body;
        if (!channel) {
            return res.status(400).json({
                message:"channel is required"
            });
        }

        const meeting =await Meeting.findOne({
                meetingId: channel
            });        

        if (!meeting) {
            return res.status(404).json({
                message:"Meeting not found"
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
                message:"Only host can stop STT"
            });
        }

        if (!meeting.agentId) {
            return res.status(400).json({
                message: "STT is not running"
            });
        }

        console.log("Stopping Agora STT:",meeting.agentId
        );

        const result =await stopSpeechToText(meeting.agentId);

        meeting.isRecording =false;
        meeting.status ="ended";
        meeting.endedAt =new Date();
        await meeting.save();

        const io =req.app.get("io");
        io.to(channel).emit("recording-stopped");

        return res.json({
            message:"Speech To Text stopped successfully",
            result
        });
    } catch (error) {
        console.error(
            "STT STOP ERROR:",
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

module.exports = {
    handleSpeechToTextStart,
    handleSpeechToTextStop,
    handleSpeechCallback
};