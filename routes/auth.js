const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.post('/register', async (req, res) => {
 try{
    const { name, email, password } = req.body;
    if (!name) {
       return res.status(400).json({
           message: "Name is required"
       });
   }
   if (!email) {
       return res.status(400).json({
           message: "Email is required"
       });
   }
   if (!password) {
       return res.status(400).json({
           message: "Password is required"
       });
   }
    console.log(name,email,password);
    console.log("Email from request:", email);
     const exists = await User.findOne({ email });
     console.log(exists);
         if (exists) {
            return res.status(400).json({ message: 'User already exists' });
        }   
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.json({ message: 'User registered successfully', user });
}catch (err) {
        console.error(err); 
        res.status(500).json({
            message: "Internal Server Error",
        });
    }
});

router.post('/login', async (req, res) => {
    try{
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
       if (!email) {
       return res.status(400).json({
           message: "Email is required"
       });
   }
   if (!password) {
       return res.status(400).json({
           message: "Password is required"
       });
   }
    const match= await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id }, "secretkey", { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
}catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
});

router.get("/me", auth, async (req, res) => {
    try {
        const user = await User
            .findById(req.user.id)
            .select("-password");
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        res.status(200).json(user);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});

module.exports = router;