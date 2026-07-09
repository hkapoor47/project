const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
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
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    const match= await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id }, "secretkey", { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
});
module.exports = router;