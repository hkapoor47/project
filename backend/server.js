require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./middleware/authMiddleware");
const Meeting = require("./models/meeting");
const User = require("./models/user");

const app = express();
const PORT = process.env.PORT || 5000;

const speech = require("./routes/speech");
const agora = require("./routes/agora");
const testRoute = require("./routes/test");
const llmRoute = require("./routes/llm");
const meetingRoute = require("./routes/meeting");
const pdfRoute = require("./routes/pdf");
const translate = require("./routes/translation");

app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use("/api/llm", llmRoute);
app.use("/api/test", testRoute);
app.use("/api/agora", agora);
app.use("/api/meeting", meetingRoute);
app.use("/api/pdf", pdfRoute);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/speech", speech);
app.use("/api/translate", translate);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

const meetingParticipants = new Map();
const transcriptHistory = new Map();
const TRANSLATION_SERVICE_URL = process.env.LIBRETRANSLATE_URL;

function containsDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}

async function translateHindiToEnglish(text) {
  // English / Roman text → DON'T TRANSLATE
  if (!containsDevanagari(text)) {
    return text;
  }

  // No translation service configured
  if (!TRANSLATION_SERVICE_URL) {
    console.warn(
      "LIBRETRANSLATE_URL is not configured"
    );

    return text;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(
      `${TRANSLATION_SERVICE_URL.replace(/\/$/, "")}/translate`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          q: text,
          source: "hi",
          target: "en",
          format: "text",
        }),

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Translation service returned ${response.status}`
      );
    }

    const result = await response.json();

    const translatedText = String(
      result.translatedText || ""
    ).trim();

    if (!translatedText) {
      throw new Error(
        "Translation service returned empty translation"
      );
    }

    return translatedText;

  } catch (error) {

    console.error(
      "Hindi translation failed:",
      error.message
    );

    // VERY IMPORTANT:
    // Translation failure must NOT kill transcript.
    return text;

  } finally {
    clearTimeout(timeout);
  }
}

io.on("connection", (socket) => {
  console.log("Client Connected:", socket.id);

  socket.on("join-meeting", (data) => {
    try {
      const { meetingId, name, email, role, uid } = data || {};

      if (!meetingId) {
        console.log("Meeting ID missing");
        return;
      }

      socket.join(meetingId);
      socket.meetingId = meetingId;

      if (!meetingParticipants.has(meetingId)) {
        meetingParticipants.set(meetingId, new Map());
      }

      const roomParticipants = meetingParticipants.get(meetingId);
      const participant = {
        socketId: socket.id,
        name: name || "Unknown",
        email: email || "",
        role: role || "participant",
        uid: uid === undefined || uid === null ? null : Number(uid),
      };

      roomParticipants.set(socket.id, participant);

      console.log("Participant joined:", participant);
      io.to(meetingId).emit(
        "participants-updated",
        Array.from(roomParticipants.values())
      );
    } catch (error) {
      console.error("join-meeting error:", error);
    }
  });

  socket.on("participant-uid", (data) => {
    try {
      const { meetingId, uid, name, email, role } = data || {};

      if (!meetingId || uid === undefined || uid === null) {
        console.log("Invalid participant UID:", data);
        return;
      }

      const roomParticipants = meetingParticipants.get(meetingId);

      if (!roomParticipants) {
        console.log("Meeting room not found:", meetingId);
        return;
      }

      const participant = roomParticipants.get(socket.id) || {
        socketId: socket.id,
        name: name || email || "Unknown",
        email: email || "",
        role: role || "participant",
        uid: null,
      };

      participant.uid = Number(uid);
      participant.name = name || participant.name;
      participant.email = email || participant.email;
      participant.role = role || participant.role;

      roomParticipants.set(socket.id, participant);

      console.log("Agora UID mapped successfully:", participant);
      io.to(meetingId).emit(
        "participants-updated",
        Array.from(roomParticipants.values())
      );
    } catch (error) {
      console.error("participant-uid error:", error);
    }
  });

  socket.on("recording-started", (meetingId) => {
    if (!meetingId) {
      return;
    }

    console.log("Recording started:", meetingId);
    socket.to(meetingId).emit("recording-started");
  });

  socket.on("recording-stopped", (meetingId) => {
    if (!meetingId) {
      return;
    }

    console.log("Recording stopped:", meetingId);
    socket.to(meetingId).emit("recording-stopped");
  });

  socket.on("end-meeting", (meetingId) => {
    if (!meetingId) {
      return;
    }

    console.log("Meeting ended by host:", meetingId);
    socket.to(meetingId).emit("meeting-ended");
  });

 socket.on("transcript", async (data) => {
  try {
    const meetingId = data?.meetingId;
    const uid = Number(data?.uid);

    const originalText = String(data?.text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!meetingId || !Number.isFinite(uid) || !originalText) {
      return;
    }

    // -----------------------------
    // 1. DEDUPLICATION
    // -----------------------------

    const dedupKey = data.sentenceId
      ? `${meetingId}:${uid}:${data.sentenceId}`
      : `${meetingId}:${uid}:${originalText.toLowerCase()}`;

    if (transcriptHistory.has(dedupKey)) {
      return;
    }

    transcriptHistory.set(dedupKey, Date.now());

    // Clean old deduplication entries
    const now = Date.now();

    for (const [key, timestamp] of transcriptHistory) {
      if (now - timestamp > 60000) {
        transcriptHistory.delete(key);
      }
    }

    // -----------------------------
    // 2. FIND MEETING
    // -----------------------------

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      console.log(
        "Transcript meeting not found:",
        meetingId
      );
      return;
    }

    // -----------------------------
    // 3. FIND SPEAKER
    // -----------------------------

    let speaker = null;

    if (uid === 1 && meeting.hostId) {
      const host = await User.findById(meeting.hostId)
        .select("name email");

      speaker = host?.name || host?.email || null;
    }

    if (!speaker && Array.isArray(meeting.members)) {
      const member = meeting.members.find(
        (candidate) => Number(candidate.uid) === uid
      );

      speaker = member?.name || member?.email || null;
    }

    speaker ||= `Participant ${uid}`;

    // -----------------------------
    // 4. SAVE ORIGINAL TRANSCRIPT
    //    IMMEDIATELY
    // -----------------------------

    const transcriptData = {
      meetingId,
      uid,
      speaker,
      text: originalText,
      timestamp: new Date(),
    };

    meeting.transcript ||= [];

    meeting.transcript.push(transcriptData);

    await meeting.save();

    console.log(
      "Transcript saved:",
      transcriptData
    );

    // -----------------------------
    // 5. SEND ORIGINAL TRANSCRIPT
    //    TO FRONTEND IMMEDIATELY
    // -----------------------------

    io.to(meetingId).emit(
      "transcript",
      transcriptData
    );

    // -----------------------------
    // 6. TRANSLATE SEPARATELY
    // -----------------------------

    if (containsDevanagari(originalText)) {

      translateHindiToEnglish(originalText)
        .then(async (translatedText) => {

          // Translation failed or returned
          // same Hindi text
          if (
            !translatedText ||
            translatedText === originalText
          ) {
            return;
          }

          // Find the same meeting again
          const updatedMeeting =
            await Meeting.findOne({ meetingId });

          if (!updatedMeeting) {
            return;
          }

          // Find the transcript we just saved
          const transcriptIndex =
            updatedMeeting.transcript.findIndex(
              (item) =>
                Number(item.uid) === uid &&
                item.text === originalText
            );

          if (transcriptIndex === -1) {
            console.log(
              "Transcript entry not found for translation"
            );
            return;
          }

          // Replace Hindi with English
          updatedMeeting.transcript[
            transcriptIndex
          ].text = translatedText;

          await updatedMeeting.save();

          console.log(
            "Hindi transcript translated:",
            {
              original: originalText,
              translated: translatedText,
            }
          );

          // Send translated version
          // to frontend
          io.to(meetingId).emit(
            "transcript-translated",
            {
              meetingId,
              uid,
              speaker,
              originalText,
              text: translatedText,
              timestamp:
                updatedMeeting.transcript[
                  transcriptIndex
                ].timestamp,
            }
          );

        })
        .catch((error) => {
          console.error(
            "Background translation error:",
            error.message
          );
        });
    }

  } catch (error) {
    console.error(
      "Transcript socket error:",
      error
    );
  }
});


  socket.on("disconnect", () => {
    console.log("Client Disconnected:", socket.id);

    const meetingId = socket.meetingId;

    if (!meetingId) {
      return;
    }

    const roomParticipants = meetingParticipants.get(meetingId);

    if (!roomParticipants) {
      return;
    }

    roomParticipants.delete(socket.id);
    io.to(meetingId).emit(
      "participants-updated",
      Array.from(roomParticipants.values())
    );

    if (roomParticipants.size === 0) {
      meetingParticipants.delete(meetingId);
      console.log("Meeting room cleaned:", meetingId);
    }
  });
});

app.post("/test-callback", (req, res) => {
  console.log("TEST CALLBACK HIT:", req.body);
  
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Backend is running successfully");
});

app.get("/profile", auth, (req, res) => {
  res.json({
    message: "This is a protected route",
    user: req.user,
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });