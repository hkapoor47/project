const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const auth=require('./middleware/authMiddleware');
const app=express();
const PORT = process.env.PORT ||5000;
const speech = require("./routes/speech");
const agora = require("./routes/agora");
require("dotenv").config();

app.use(express.json());
app.use(cors());
app.use("/api/agora", agora);

app.get("/", (req, res) => {
    res.send("Backend is running successfully ");
});

app.get("/profile",auth,(req,res)=>{
    res.json({message:"This is a protected route",user:req.user});
});

mongoose.connect(process.env.MONGO_URI).then(()=>{
    console.log("MongoDb connected successfully");
}).catch((err)=>{
    console.log(err);
});


app.use("/api/auth",require("./routes/auth"));
app.use("/api/speech", speech);

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});