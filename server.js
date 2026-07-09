const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const auth=require('./middleware/authMiddleware');
const app=express();

app.use(express.json());
app.use(cors());
app.get("/profile",auth,(req,res)=>{
    res.json({message:"This is a protected route",user:req.user});
});


mongoose.connect("mongodb://127.0.0.1:27017/authDB").then(()=>{
    console.log("MongoDb connected successfully");
});


app.use("/api/auth",require("./routes/auth"));
app.listen(5000,()=>{
    console.log("Server is running on port 5000");
});