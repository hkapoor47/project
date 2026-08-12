require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

const speech = require("./routes/speech");
const agora = require("./routes/agora");
const testRoute = require("./routes/test");
const llmRoute = require("./routes/llm");
const meetingRoute = require("./routes/meeting");
const pdfRoute = require("./routes/pdf");

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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

/*
=====================================================
MEETING PARTICIPANTS

meetingId -> Map(socketId -> participant)
=====================================================
*/

const meetingParticipants = new Map();

io.on("connection", (socket) => {
  console.log("Client Connected:", socket.id);

  /*
  =====================================================
  JOIN MEETING SOCKET ROOM
  =====================================================
  */

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
        console.log("Meeting ID missing");
        return;
      }

      socket.join(meetingId);

      socket.meetingId = meetingId;

      if (!meetingParticipants.has(meetingId)) {
        meetingParticipants.set(
          meetingId,
          new Map()
        );
      }

      const roomParticipants =
        meetingParticipants.get(meetingId);

      const participant = {
        socketId: socket.id,

        name: name || "Unknown",

        email: email || "",

        role: role || "participant",

        uid:
          uid !== undefined &&
          uid !== null
            ? Number(uid)
            : null,
      };

      roomParticipants.set(
        socket.id,
        participant
      );

      console.log(
        "Participant joined:",
        participant
      );

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

  /*
  =====================================================
  UPDATE AGORA UID
  =====================================================
  */

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
            "Invalid participant UID:",
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

        participant.uid =
          Number(uid);

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
          "Agora UID mapped:",
          participant
        );

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

  /*
  =====================================================
  RECORDING STARTED
  =====================================================
  */

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

  /*
  =====================================================
  RECORDING STOPPED
  =====================================================
  */

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

  /*
  =====================================================
  END MEETING
  =====================================================
  */

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

  /*
  =====================================================
  TRANSCRIPT

  Host sends:

  {
    meetingId,
    uid,
    text
  }

  Server finds:

  uid -> participant.name

  Then broadcasts:

  {
    meetingId,
    uid,
    speaker,
    text
  }
  =====================================================
  */

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

        let uid = null;

        if (
          data.uid !== undefined &&
          data.uid !== null
        ) {
          uid = Number(data.uid);
        }

        let speaker =
          data.speaker ||
          "Unknown";

        /*
        Find participant by Agora UID
        */

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

        const transcriptData = {
          meetingId,
          uid,
          speaker,
          text: data.text,
        };

        console.log(
          "FINAL TRANSCRIPT:",
          transcriptData
        );

        /*
        Send transcript to everyone
        */

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

  /*
  =====================================================
  DISCONNECT
  =====================================================
  */

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

      roomParticipants.delete(
        socket.id
      );

      const participants =
        Array.from(
          roomParticipants.values()
        );

      io.to(meetingId).emit(
        "participants-updated",
        participants
      );

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

/*
=====================================================
HEALTH CHECK
=====================================================
*/

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
      user: req.user,
    });
  }
);

/*
=====================================================
DATABASE
=====================================================
*/

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
  .catch((err) => {
    console.error(
      "MongoDB connection error:",
      err
    );
  });