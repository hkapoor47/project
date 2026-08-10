const {
  startSpeechToText,
  stopSpeechToText
} = require("../services/speechService");

const Meeting = require("../models/meeting");

async function handleSpeechToTextStart(req, res) {
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

    if (
      !userId ||
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

    const result =
      await startSpeechToText(channel);

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
      agent_id:
        result.agent_id
    });

  } catch (error) {
    console.error(
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

async function handleSpeechCallback(req, res) {
  try {
    const io = req.app.get("io");
    const body = req.body || {};

    const words = body.words || [];

    const text = words
      .filter(word => word.is_final)
      .map(word => word.text)
      .join(" ");

    const uid = Number(
      body.uid ||
      body.rtcUid ||
      body.rtcuid
    );

    const channel = body.channelName;

    if (!channel || !uid || !text) {
      return res.sendStatus(200);
    }

    const meeting = await Meeting.findOne({
      meetingId: channel
    });

    if (!meeting) {
      return res.sendStatus(200);
    }

    const member = meeting.members.find(
      member =>
        Number(member.uid) === uid
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

    io.to(channel).emit(
      "transcript",
      {
        uid,
        speaker,
        text
      }
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error(error);
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

    if (
      !userId ||
      meeting.hostId.toString() !==
        userId.toString()
    ) {
      return res.status(403).json({
        message: "Only host can stop STT"
      });
    }

    if (!meeting.agentId) {
      return res.status(400).json({
        message: "STT is not running"
      });
    }

    const result =
      await stopSpeechToText(
        meeting.agentId
      );

    meeting.isRecording = false;
    meeting.status = "ended";
    meeting.endedAt = new Date();

    await meeting.save();

    const io = req.app.get("io");

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
      error.response?.data ||
      error.message
    );

    return res.status(500).json({
      message: "Failed to stop STT",
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