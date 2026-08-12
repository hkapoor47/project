require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./middleware/authMiddleware");

const {
  transliterateHindi,
} = require("./services/transliterationService");

const app = express();

const PORT =
  process.env.PORT || 5000;


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

app.use(
  express.json()
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/llm",
  llmRoute
);

app.use(
  "/api/test",
  testRoute
);

app.use(
  "/api/agora",
  agora
);

app.use(
  "/api/meeting",
  meetingRoute
);

app.use(
  "/api/pdf",
  pdfRoute
);

app.use(
  "/api/auth",
  require("./routes/auth")
);

app.use(
  "/api/speech",
  speech
);


// =====================================================
// HTTP SERVER
// =====================================================

const server =
  http.createServer(app);


// =====================================================
// SOCKET.IO
// =====================================================

const io =
  new Server(server, {
    cors: {
      origin: true,
      methods: [
        "GET",
        "POST",
      ],
      credentials: true,
    },
  });


// Make io available inside controllers
app.set(
  "io",
  io
);


// =====================================================
// MEETING PARTICIPANTS
//
// meetingId
//      ↓
// Map(socketId -> participant)
//
// Example:
//
// meeting123
//    |
//    ├── socket1 -> Rahul
//    └── socket2 -> Harshita
// =====================================================

const meetingParticipants =
  new Map();


// =====================================================
// TRANSCRIPT DUPLICATE TRACKER
//
// meetingId
//      ↓
// Map(duplicateKey -> timestamp)
// =====================================================

const transcriptHistory =
  new Map();


// Duplicate window
const DUPLICATE_WINDOW =
  2000;


// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
  "connection",
  (socket) => {

    console.log(
      "Client Connected:",
      socket.id
    );


    // ===================================================
    // JOIN MEETING
    // ===================================================

    socket.on(
      "join-meeting",
      (data) => {

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


          // ===============================================
          // JOIN SOCKET ROOM
          // ===============================================

          socket.join(
            meetingId
          );

          socket.meetingId =
            meetingId;


          // ===============================================
          // CREATE PARTICIPANT MAP
          // ===============================================

          if (
            !meetingParticipants.has(
              meetingId
            )
          ) {

            meetingParticipants.set(
              meetingId,
              new Map()
            );
          }


          const roomParticipants =
            meetingParticipants.get(
              meetingId
            );


          // ===============================================
          // CREATE PARTICIPANT
          // ===============================================

          const participant = {

            socketId:
              socket.id,

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


          // ===============================================
          // SAVE PARTICIPANT
          // ===============================================

          roomParticipants.set(
            socket.id,
            participant
          );


          console.log(
            "Participant joined:",
            participant
          );


          // ===============================================
          // SEND PARTICIPANTS
          // ===============================================

          const participants =
            Array.from(
              roomParticipants.values()
            );


          io.to(
            meetingId
          ).emit(
            "participants-updated",
            participants
          );

        } catch (error) {

          console.error(
            "join-meeting error:",
            error
          );
        }
      }
    );


    // ===================================================
    // UPDATE AGORA UID
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
              "Invalid participant UID:",
              data
            );

            return;
          }


          // ===============================================
          // GET MEETING ROOM
          // ===============================================

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


          // ===============================================
          // GET SOCKET PARTICIPANT
          // ===============================================

          const participant =
            roomParticipants.get(
              socket.id
            );


          if (!participant) {

            console.log(
              "Participant not found for socket:",
              socket.id
            );

            return;
          }


          // ===============================================
          // SAVE ACTUAL AGORA UID
          // ===============================================

          participant.uid =
            Number(uid);


          // ===============================================
          // UPDATE NAME
          // ===============================================

          if (name) {

            participant.name =
              name;
          }


          // ===============================================
          // UPDATE EMAIL
          // ===============================================

          if (email) {

            participant.email =
              email;
          }


          // ===============================================
          // UPDATE ROLE
          // ===============================================

          if (role) {

            participant.role =
              role;
          }


          // ===============================================
          // SAVE PARTICIPANT
          // ===============================================

          roomParticipants.set(
            socket.id,
            participant
          );


          console.log(
            "Agora UID mapped successfully:",
            participant
          );


          // ===============================================
          // SEND UPDATED PARTICIPANTS
          // ===============================================

          const participants =
            Array.from(
              roomParticipants.values()
            );


          io.to(
            meetingId
          ).emit(
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


        // ===============================================
        // TELL PARTICIPANTS
        // ===============================================

        socket
          .to(meetingId)
          .emit(
            "meeting-ended"
          );


        // ===============================================
        // CLEAR TRANSCRIPT CACHE
        // ===============================================

        transcriptHistory.delete(
          meetingId
        );
      }
    );


    // ===================================================
    // TRANSCRIPT
    // ===================================================
    //
    // IMPORTANT:
    //
    // Control.jsx sends:
    //
    // uid: Number(decoded?.uid)
    //
    // decoded.uid = ACTUAL SPEAKER UID
    //
    // NOT:
    //
    // 5001
    //
    // 5001 = STT BOT UID
    //
    // ===================================================

    socket.on(
      "transcript",
      async (data) => {

        try {

          // =============================================
          // VALIDATE DATA
          // =============================================

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


          // =============================================
          // CLEAN TEXT
          // =============================================

          let text =
            String(
              data.text
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim();


          if (!text) {
            return;
          }


          // =============================================
          // GET PARTICIPANTS
          // =============================================

          const roomParticipants =
            meetingParticipants.get(
              meetingId
            );


          // =============================================
          // GET SENDER
          // =============================================

          const sender =
            roomParticipants
              ? roomParticipants.get(
                  socket.id
                )
              : null;


          // =============================================
          // ONLY HOST CAN SEND STT
          // =============================================

          if (
            sender &&
            sender.role &&
            sender.role !== "host"
          ) {

            console.log(
              "Transcript rejected - sender is not host:",
              sender
            );

            return;
          }


          // =============================================
          // ACTUAL SPEAKER UID
          // =============================================

          const uid =
            Number(
              data.uid
            );


          if (
            !Number.isFinite(uid)
          ) {

            console.log(
              "Invalid speaker UID:",
              data.uid
            );

            return;
          }


          console.log(
            "ACTUAL SPEAKER UID:",
            uid
          );


          // =============================================
          // FIND SPEAKER NAME
          // =============================================

          let speaker =
            "Unknown";


          if (roomParticipants) {

            for (
              const participant of
                roomParticipants.values()
            ) {

              console.log(
                "Checking participant:",
                {
                  participantUid:
                    participant.uid,

                  actualSpeakerUid:
                    uid,

                  name:
                    participant.name,
                }
              );


              if (
                Number(
                  participant.uid
                ) ===
                Number(uid)
              ) {

                speaker =
                  participant.name ||
                  participant.email ||
                  "Participant";


                break;
              }
            }
          }


          // =============================================
          // SPEAKER FOUND
          // =============================================

          console.log(
            "SPEAKER MAPPING RESULT:",
            {
              uid,
              speaker,
              text,
            }
          );


          // =============================================
          // HINDI DETECTION
          // =============================================

          const containsHindi =
            /[\u0900-\u097F]/.test(
              text
            );


          // =============================================
          // HINDI -> ROMAN HINDI
          // =============================================

          if (containsHindi) {

            console.log(
              "Hindi detected:",
              text
            );


            try {

              const transliteratedText =
                await transliterateHindi(
                  text
                );


              text =
                String(
                  transliteratedText ||
                    ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim();


              console.log(
                "Hindi transliterated:",
                text
              );

            } catch (error) {

              console.error(
                "Hindi transliteration failed:",
                error.message
              );

              return;
            }
          }


          // =============================================
          // FINAL DEVANAGARI SAFETY CHECK
          // =============================================

          if (
            /[\u0900-\u097F]/.test(
              text
            )
          ) {

            console.log(
              "Hindi still present. Transcript rejected:",
              text
            );

            return;
          }


          // =============================================
          // NORMALIZE TEXT
          // =============================================

          const normalizedText =
            text
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


          // =============================================
          // DUPLICATE KEY
          // =============================================

          const duplicateKey =
            `${uid}|${normalizedText}`;


          // =============================================
          // CREATE MEETING HISTORY
          // =============================================

          if (
            !transcriptHistory.has(
              meetingId
            )
          ) {

            transcriptHistory.set(
              meetingId,
              new Map()
            );
          }


          const meetingHistory =
            transcriptHistory.get(
              meetingId
            );


          const now =
            Date.now();


          // =============================================
          // CHECK DUPLICATE
          // =============================================

          const previousTime =
            meetingHistory.get(
              duplicateKey
            );


          if (
            previousTime &&
            now - previousTime <
              DUPLICATE_WINDOW
          ) {

            console.log(
              "DUPLICATE TRANSCRIPT IGNORED:",
              {
                meetingId,
                uid,
                speaker,
                text,
              }
            );

            return;
          }


          // =============================================
          // SAVE DUPLICATE KEY
          // =============================================

          meetingHistory.set(
            duplicateKey,
            now
          );


          // =============================================
          // DELETE OLD CACHE
          // =============================================

          for (
            const [
              key,
              timestamp,
            ] of meetingHistory
          ) {

            if (
              now - timestamp >
              DUPLICATE_WINDOW
            ) {

              meetingHistory.delete(
                key
              );
            }
          }


          // =============================================
          // FINAL TRANSCRIPT DATA
          // =============================================

          const transcriptData = {

            meetingId,

            uid,

            speaker,

            text,
          };


          console.log(
            "======================================"
          );

          console.log(
            "FINAL TRANSCRIPT:",
            transcriptData
          );

          console.log(
            "======================================"
          );


          // =============================================
          // SEND TO FRONTEND
          // =============================================

          io.to(
            meetingId
          ).emit(
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


        // ===============================================
        // REMOVE PARTICIPANT
        // ===============================================

        roomParticipants.delete(
          socket.id
        );


        // ===============================================
        // SEND UPDATED PARTICIPANTS
        // ===============================================

        const participants =
          Array.from(
            roomParticipants.values()
          );


        io.to(
          meetingId
        ).emit(
          "participants-updated",
          participants
        );


        // ===============================================
        // CLEAN EMPTY ROOM
        // ===============================================

        if (
          roomParticipants.size ===
          0
        ) {

          meetingParticipants.delete(
            meetingId
          );


          transcriptHistory.delete(
            meetingId
          );


          console.log(
            "Meeting room cleaned:",
            meetingId
          );
        }
      }
    );
  }
);


// =====================================================
// ROOT ROUTE
// =====================================================

app.get(
  "/",
  (req, res) => {

    res.send(
      "Backend is running successfully"
    );
  }
);


// =====================================================
// PROFILE ROUTE
// =====================================================

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
// MONGODB
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