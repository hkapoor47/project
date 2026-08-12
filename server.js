require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// ROUTES
// =====================================================

const speech = require("./routes/speech");
const agora = require("./routes/agora");
const testRoute = require("./routes/test");
const llmRoute = require("./routes/llm");
const meetingRoute = require("./routes/meeting");
const pdfRoute = require("./routes/pdf");

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/llm", llmRoute);
app.use("/api/test", testRoute);
app.use("/api/agora", agora);
app.use("/api/meeting", meetingRoute);
app.use("/api/pdf", pdfRoute);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/speech", speech);

// =====================================================
// HTTP SERVER
// =====================================================

const server = http.createServer(app);

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// =====================================================
// MEETING PARTICIPANTS
//
// meetingParticipants:
// Map<meetingId, Map<socketId, participant>>
//
// participant:
// {
//   socketId,
//   name,
//   email,
//   role,
//   uid
// }
// =====================================================

const meetingParticipants = new Map();

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log(
    "Client Connected:",
    socket.id
  );

  // ===================================================
  // JOIN MEETING SOCKET ROOM
  // ===================================================

  socket.on("join-meeting", (data) => {
    try {
      const {
        meetingId,
        name,
        email,
        role,
        uid,
      } = data || {};

      if (!meetingId) {
        console.log(
          "Meeting ID missing"
        );
        return;
      }

      // Join Socket.IO room
      socket.join(meetingId);

      // Store meeting ID on socket
      socket.meetingId = meetingId;

      // Create meeting map if required
      if (!meetingParticipants.has(meetingId)) {
        meetingParticipants.set(
          meetingId,
          new Map()
        );
      }

      const roomParticipants =
        meetingParticipants.get(
          meetingId
        );

      // Create participant
      const participant = {
        socketId: socket.id,

        name:
          name ||
          "Unknown",

        email:
          email ||
          "",

        role:
          role ||
          "participant",

        uid:
          uid !== undefined &&
          uid !== null
            ? Number(uid)
            : null,
      };

      // Save participant
      roomParticipants.set(
        socket.id,
        participant
      );

      console.log(
        "Participant joined:",
        participant
      );

      // Send updated participant list
      const participants =
        Array.from(
          roomParticipants.values()
        );

      io.to(meetingId).emit(
        "participants-updated",
        participants
      );

    } catch (error) {
      console.error(
        "join-meeting error:",
        error
      );
    }
  });

  // ===================================================
  // UPDATE PARTICIPANT AGORA UID
  //
  // This is VERY IMPORTANT.
  //
  // Frontend gets Agora UID after /join API and sends:
  //
  // socket.emit("participant-uid", {
  //   meetingId,
  //   uid,
  //   name,
  //   email,
  //   role
  // });
  //
  // ===================================================

  socket.on(
    "participant-uid",
    (data) => {
      try {
        const {
          meetingId,
          uid,
          name,
          email,
          role,
        } = data || {};

        if (
          !meetingId ||
          uid === undefined ||
          uid === null
        ) {
          console.log(
            "Invalid participant UID data:",
            data
          );

          return;
        }

        const roomParticipants =
          meetingParticipants.get(
            meetingId
          );

        if (!roomParticipants) {
          console.log(
            "Meeting room not found:",
            meetingId
          );

          return;
        }

        const participant =
          roomParticipants.get(
            socket.id
          );

        if (!participant) {
          console.log(
            "Participant not found:",
            socket.id
          );

          return;
        }

        // ---------------------------------------------
        // SAVE AGORA UID
        // ---------------------------------------------

        participant.uid =
          Number(uid);

        // ---------------------------------------------
        // UPDATE IDENTITY
        // ---------------------------------------------

        if (name) {
          participant.name = name;
        }

        if (email) {
          participant.email = email;
        }

        if (role) {
          participant.role = role;
        }

        roomParticipants.set(
          socket.id,
          participant
        );

        console.log(
          "Participant UID mapped:",
          participant
        );

        // ---------------------------------------------
        // SEND UPDATED PARTICIPANTS
        // ---------------------------------------------

        const participants =
          Array.from(
            roomParticipants.values()
          );

        io.to(meetingId).emit(
          "participants-updated",
          participants
        );

      } catch (error) {
        console.error(
          "participant-uid error:",
          error
        );
      }
    }
  );

  // ===================================================
  // RECORDING STARTED
  // ===================================================

  socket.on(
    "recording-started",
    (meetingId) => {
      if (!meetingId) {
        return;
      }

      console.log(
        "Recording started:",
        meetingId
      );

      socket
        .to(meetingId)
        .emit(
          "recording-started"
        );
    }
  );

  // ===================================================
  // RECORDING STOPPED
  // ===================================================

  socket.on(
    "recording-stopped",
    (meetingId) => {
      if (!meetingId) {
        return;
      }

      console.log(
        "Recording stopped:",
        meetingId
      );

      socket
        .to(meetingId)
        .emit(
          "recording-stopped"
        );
    }
  );

  // ===================================================
  // END MEETING
  // ===================================================

  socket.on(
    "end-meeting",
    (meetingId) => {
      if (!meetingId) {
        return;
      }

      console.log(
        "Meeting ended by host:",
        meetingId
      );

      socket
        .to(meetingId)
        .emit(
          "meeting-ended"
        );
    }
  );

  // ===================================================
  // TRANSCRIPT
  //
  // This receives transcript data from backend/client.
  //
  // Expected:
  //
  // {
  //   meetingId,
  //   uid,
  //   text
  // }
  //
  // Then:
  //
  // Agora UID -> participant name
  //
  // ===================================================

  socket.on(
    "transcript",
    (data) => {
      try {
        if (
          !data ||
          !data.meetingId ||
          !data.text
        ) {
          console.log(
            "Invalid transcript data:",
            data
          );

          return;
        }

        const meetingId =
          data.meetingId;

        const roomParticipants =
          meetingParticipants.get(
            meetingId
          );

        // ---------------------------------------------
        // GET UID
        // ---------------------------------------------

        let uid = null;

        if (
          data.uid !== undefined &&
          data.uid !== null
        ) {
          uid = Number(data.uid);
        }

        // ---------------------------------------------
        // DEFAULT SPEAKER
        // ---------------------------------------------

        let speaker =
          data.speaker ||
          "Unknown";

        // ---------------------------------------------
        // MAP UID -> NAME
        // ---------------------------------------------

        if (
          roomParticipants &&
          Number.isFinite(uid)
        ) {
          for (
            const participant
            of roomParticipants.values()
          ) {
            if (
              participant.uid === uid
            ) {
              speaker =
                participant.name;

              break;
            }
          }
        }

        // ---------------------------------------------
        // FINAL TRANSCRIPT OBJECT
        // ---------------------------------------------

        const transcriptData = {
          meetingId,
          uid,
          speaker,
          text: data.text,
        };

        console.log(
          "Transcript socket:",
          transcriptData
        );

        // ---------------------------------------------
        // SEND TO EVERYONE IN MEETING
        // ---------------------------------------------

        io.to(meetingId).emit(
          "transcript",
          transcriptData
        );

      } catch (error) {
        console.error(
          "Transcript socket error:",
          error
        );
      }
    }
  );

  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on(
    "disconnect",
    () => {
      console.log(
        "Client Disconnected:",
        socket.id
      );

      const meetingId =
        socket.meetingId;

      if (!meetingId) {
        return;
      }

      const roomParticipants =
        meetingParticipants.get(
          meetingId
        );

      if (!roomParticipants) {
        return;
      }

      // Remove participant
      roomParticipants.delete(
        socket.id
      );

      // Updated participant list
      const participants =
        Array.from(
          roomParticipants.values()
        );

      io.to(meetingId).emit(
        "participants-updated",
        participants
      );

      // Delete empty room
      if (
        roomParticipants.size === 0
      ) {
        meetingParticipants.delete(
          meetingId
        );
      }
    }
  );
});

// =====================================================
// BASIC ROUTES
// =====================================================

app.get(
  "/",
  (req, res) => {
    res.send(
      "Backend is running successfully"
    );
  }
);

app.get(
  "/profile",
  auth,
  (req, res) => {
    res.json({
      message:
        "This is a protected route",

      user:
        req.user,
    });
  }
);

// =====================================================
// MONGODB + SERVER
// =====================================================

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(() => {
    console.log(
      "MongoDB connected successfully"
    );

    server.listen(
      PORT,
      () => {
        console.log(
          `Server is running on port ${PORT}`
        );
      }
    );
  })
  .catch(
    (err) => {
      console.error(
        "MongoDB connection error:",
        err
      );
    }
  );