const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const auth=require('./middleware/authMiddleware');
const app=express();
const PORT = process.env.PORT ||5000;
require("dotenv").config();

app.use(express.json());
app.use(cors());

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
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});