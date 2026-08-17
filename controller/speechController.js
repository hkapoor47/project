const {
  startSpeechToText,
  stopSpeechToText,
} = require("../services/speechService");

const Meeting = require("../models/meeting");
const User = require("../models/user");

const transcriptHistory = new Map();
const DUPLICATE_WINDOW = 30000;

function parseJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCallbackPayload(body) {
  const parsedData = parseJson(body.data);
  const payload =
    parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)
      ? parsedData
      : {};

  return {
    ...body,
    ...payload,
  };
}

function getFirstValue(source, paths) {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce((current, key) => current?.[key], source);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function getFinalWords(payload) {
  const words = getFirstValue(payload, [
    "words",
    "result.words",
    "data.words",
  ]);

  if (!Array.isArray(words)) {
    return [];
  }

  return words.filter(
    (word) =>
      word &&
      (word.is_final === true || word.isFinal === true || word.final === true)
  );
}

function getEnglishTranslation(payload) {
  const translations = getFirstValue(payload, [
    "trans",
    "translations",
    "result.trans",
    "result.translations",
  ]);

  if (!Array.isArray(translations)) {
    return "";
  }

  const english = translations.find((translation) => {
    const language = String(
      translation?.lang || translation?.language || translation?.target || ""
    ).toLowerCase();

    return language === "en" || language === "en-us";
  });

  if (!english) {
    return "";
  }

  const values = Array.isArray(english.texts)
    ? english.texts
    : Array.isArray(english.words)
      ? english.words.map((word) => word?.text)
      : [english.text || english.translation];

  return normalizeText(values.filter(Boolean).join(" "));
}

function getFinalText(payload, finalWords) {
  const translatedText = getEnglishTranslation(payload);

  if (translatedText) {
    return translatedText;
  }

  return normalizeText(
    finalWords
      .map((word) => word.translatedText || word.translation || word.text)
      .filter(Boolean)
      .join(" ")
  );
}

function isDuplicate(key) {
  const now = Date.now();

  for (const [historyKey, timestamp] of transcriptHistory) {
    if (now - timestamp > DUPLICATE_WINDOW) {
      transcriptHistory.delete(historyKey);
    }
  }

  if (transcriptHistory.has(key)) {
    return true;
  }

  transcriptHistory.set(key, now);
  return false;
}

async function handleSpeechToTextStart(req, res) {
  try {
    console.log("Request Body:", req.body);
    console.log("Authenticated User:", req.user);

    const { channel } = req.body;

    if (!channel) {
      return res.status(400).json({ message: "channel is required" });
    }

    const meeting = await Meeting.findOne({ meetingId: channel });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const userId = req.user.id || req.user._id || req.user.userId;

    if (!userId || !meeting.hostId || String(meeting.hostId) !== String(userId)) {
      return res.status(403).json({ message: "Only host can start STT" });
    }

    if (meeting.isRecording) {
      return res.status(400).json({ message: "STT already running" });
    }

    const result = await startSpeechToText(channel);

    meeting.agentId = result.agent_id;
    meeting.isRecording = true;
    meeting.status = "active";
    meeting.startedAt = new Date();
    await meeting.save();

    req.app.get("io").to(channel).emit("recording-started");

    return res.status(200).json({
      message: "Speech To Text started successfully",
      agent_id: result.agent_id,
    });
  } catch (error) {
    console.error("STT START ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Failed to start STT",
      error: error.response?.data || error.message,
    });
  }
}

async function handleSpeechCallback(req, res) {
  try {
    console.log("Agora STT callback:", JSON.stringify(req.body, null, 2));

    const payload = getCallbackPayload(req.body || {});
    const channel = getFirstValue(payload, [
      "channelName",
      "channel",
      "rtcChannelName",
      "rtc_channel_name",
    ]);

    const rawUid = getFirstValue(payload, [
      "uid",
      "rtcUid",
      "rtcuid",
      "rtc_uid",
      "user.uid",
    ]);
    const uid = Number(rawUid);

    if (!channel || !Number.isFinite(uid)) {
      console.log("Ignoring callback without a channel or speaker UID.", {
        channel,
        rawUid,
      });
      return res.sendStatus(200);
    }

    const finalWords = getFinalWords(payload);
    const text = getFinalText(payload, finalWords);

    if (!text) {
      console.log("Ignoring callback without final transcript text.");
      return res.sendStatus(200);
    }

    const sentenceId = getFirstValue(payload, ["sentence_id", "sentenceId"]);
    const dedupKey = sentenceId
      ? `${channel}:${sentenceId}`
      : `${channel}:${uid}:${text.toLowerCase()}`;

    if (isDuplicate(dedupKey)) {
      console.log("Duplicate transcript ignored:", dedupKey);
      return res.sendStatus(200);
    }

    const meeting = await Meeting.findOne({ meetingId: channel });

    if (!meeting) {
      console.log("Meeting not found:", channel);
      return res.sendStatus(200);
    }

    let speaker = null;

    if (uid === 1 && meeting.hostId) {
      const host = await User.findById(meeting.hostId).select("name email");
      speaker = host?.name || host?.email || null;
    }

    if (!speaker && Array.isArray(meeting.members)) {
      const member = meeting.members.find(
        (candidate) => Number(candidate.uid) === uid
      );
      speaker = member?.name || member?.email || null;
    }

    speaker ||= `Participant ${uid}`;

    if (!Array.isArray(meeting.transcript)) {
      meeting.transcript = [];
    }

    const transcriptData = {
      meetingId: channel,
      uid,
      speaker,
      text,
      timestamp: new Date(),
    };

    meeting.transcript.push(transcriptData);
    await meeting.save();

    console.log("Transcript saved:", transcriptData);
    req.app.get("io").to(channel).emit("transcript", transcriptData);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Speech callback error:", error);
    return res.sendStatus(500);
  }
}

async function handleSpeechToTextStop(req, res) {
  try {
    const { channel } = req.body;

    if (!channel) {
      return res.status(400).json({ message: "channel is required" });
    }

    const meeting = await Meeting.findOne({ meetingId: channel });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const userId = req.user.id || req.user._id || req.user.userId;

    if (!userId || !meeting.hostId || String(meeting.hostId) !== String(userId)) {
      return res.status(403).json({ message: "Only host can stop STT" });
    }

    if (!meeting.agentId) {
      return res.status(400).json({ message: "STT is not running" });
    }

    const result = await stopSpeechToText(meeting.agentId);

    meeting.isRecording = false;
    meeting.agentId = null;
    meeting.status = "ended";
    meeting.endedAt = new Date();
    await meeting.save();

    req.app.get("io").to(channel).emit("recording-stopped");

    return res.json({
      message: "Speech To Text stopped successfully",
      result,
    });
  } catch (error) {
    console.error("STT STOP ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Failed to stop STT",
      error: error.response?.data || error.message,
    });
  }
}

module.exports = {
  handleSpeechToTextStart,
  handleSpeechToTextStop,
  handleSpeechCallback,
};
