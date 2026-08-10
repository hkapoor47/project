require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const auth = require("./middleware/authMiddleware");

const app = express();

const PORT = process.env.PORT || 5000;

const speech = require("./routes/speech");
const agora = require("./routes/agora");
const testRoute = require("./routes/test");
const llmRoute = require("./routes/llm");
const meetingRoute = require("./routes/meeting");
const pdfRoute = require("./routes/pdf");

const http = require("http");
const { Server } = require("socket.io");

app.use(express.json());
app.use(cors());

app.use("/api/llm", llmRoute);
app.use("/api/test", testRoute);
app.use("/api/agora", agora);
app.use("/api/meeting", meetingRoute);
app.use("/api/pdf", pdfRoute);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {

  console.log(
    "Client Connected:",
    socket.id
  );

  socket.on("join-meeting", (data) => {

    const {
      meetingId,
      name,
      role,
      email,
    } = data;

    if (!meetingId) {
      return;
    }

    socket.join(meetingId);

    console.log(
      "Socket joined meeting:",
      meetingId
    );

    console.log(
      "Name:",
      name
    );

    console.log(
      "Role:",
      role
    );

  });

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
      io.to(meetingId).emit(
        "recording-started"
      );

    }
  );

  socket.on(
    "recording-stopped",
    (meetingId) => {
      if (!meetingId) {
        return;
      }
      console.log( "Recording stopped:", meetingId);

      io.to(meetingId).emit(
        "recording-stopped"
      );
    }
  );

  socket.on(
    "transcript",
    (data) => {

      console.log(
        "Transcript received:",
        data
      );

      if (
        !data ||
        !data.meetingId ||
        !data.text
      ) {
        return;
      }

      io.to(data.meetingId).emit(
        "transcript",
        data
      );

    }
  );

  socket.on("disconnect", () => {
    console.log(
      "Client Disconnected:",
      socket.id
    );
  });
});

app.get("/", (req, res) => {
  res.send(
    "Backend is running successfully"
  );
});

app.get("/profile",auth,
  (req, res) => {
    res.json({
      message:
        "This is a protected route",
      user: req.user,
    });
  }
);

app.use(
  "/api/auth",
  require("./routes/auth")
);

app.use("/api/speech", speech);

mongoose
  .connect(process.env.MONGO_URI)
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