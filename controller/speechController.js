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
    console.log("Speech API Hit");

    try {
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
        message:"Only host can start recording"
    });
}
       

        // Prevent duplicate recording
        if (meeting.isRecording) {
            return res.status(400).json({
                message: "Recording already started"
            });
        }


        console.log("Starting Agora STT...");


        // Start Agora Cloud Recording
const recording =
    await startCloudRecording(channel);


// Start Agora STT
const result =
    await startSpeechToText(
        channel,
        uid
    );

      meeting.agentId = result.agent_id;
      meeting.resourceId =recording.resourceId;
      meeting.sid =recording.sid;
      meeting.isRecording = true;
      meeting.status = "active";
      meeting.startedAt = new Date();

        await meeting.save();


        const io = req.app.get("io");


        io.to(channel).emit(
            "recording-started"
        );

return res.status(200).json({
    message: "Recording and STT started successfully",
    agent_id: result.agent_id,
    resourceId: recording.resourceId,
    sid: recording.sid
});


    } catch(error){

        console.error(
            "Speech Start Error:",
            error.message
        );


        return res.status(500).json({
            message:"Failed to start STT",
            error:error.message
        });
    }
}

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
            `${speaker}: ${text}`
        );
        
       io.to(channel).emit(
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

async function handleSpeechToTextStop(req,res){

    try{

        const { channel } = req.body;


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


if (!userId || meeting.hostId.toString() !== userId) {
    return res.status(403).json({
        message:"Only host can stop recording"
    });
}

        if(!meeting.agentId){
            return res.status(400).json({
                message:"STT is not running"
            });
        }


        const result =
        await stopSpeechToText(
            meeting.agentId
        );
     let recordingResult = null;

if(meeting.resourceId && meeting.sid){

    recordingResult =
    await stopCloudRecording(
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


        io.to(channel).emit(
            "recording-stopped"
        );


        res.json({
    message:"Recording and STT stopped successfully",
    sttResult: result,
    recordingResult
});


    }catch(error){

        console.log(
            error.response?.data || error.message
        );


        res.status(500).json({
            message:"Failed to stop STT",
            error:error.message
        });
    }
}
module.exports = { handleSpeechToTextStart, handleSpeechToTextStop, handleSpeechCallback };
