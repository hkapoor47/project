require("dotenv").config();
const express=require('express');
const mongoose=require('mongoose');
const app=express();
const cors=require('cors');
const auth=require('./middleware/authMiddleware');
const PORT = process.env.PORT ||5000;
const speech = require("./routes/speech");
const agora = require("./routes/agora");
const http = require("http");
const { Server } = require("socket.io");
const testRoute = require("./routes/test");
const llmRoute = require("./routes/llm");
const meetingRoute = require("./routes/meeting");
const pdfRoute = require("./routes/pdf");

app.use(express.json());
app.use(cors());

app.use("/api/llm", llmRoute);
app.use("/api/test", testRoute);
app.use("/api/agora", agora);
app.use("/api/meeting", meetingRoute);
app.use("/api/pdf",pdfRoute);
const server = http.createServer(app);
const io = new Server(server, {cors: 
    {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
},});
app.set("io", io);

io.on("connection", (socket) => {
    console.log("Client Connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client Disconnected:", socket.id);
    });
});

app.get("/", (req, res) => {
    res.send("Backend is running successfully ");
});

app.get("/profile",auth,(req,res)=>{
    res.json({message:"This is a protected route",user:req.user});
});
app.use("/api/auth",require("./routes/auth"));

app.use("/api/speech", speech);

mongoose.connect(process.env.MONGO_URI).then(()=>{
    console.log("MongoDb connected successfully");

    server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});
}).catch((err)=>{
    console.log(err);
});




