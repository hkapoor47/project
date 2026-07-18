const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require("jsonwebtoken");


async function handleRegister(req, res) {
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
    res.json({ message: 'User registered successfully', user:{
        id: user._id,
        name:user.name,
        email:user.email,
        role:user.role
    } });
}catch (err) {
        console.error(err); 
        res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

async function handleLogin(req, res) {
    try{
    const { email, password } = req.body;
  
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
   const user = await User.findOne({ email });
    const match= await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id , role: user.role}, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token , user:{
        id:user._id,
        name:user.name,
        email:user.email,
        role:user.role
    }});
}catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
};


 async function handleUpdateProfile(req, res) {
    try {
        const { name, email, password } = req.body;
        const user = await User.findById(req.user.id);
        const existingUser = await User.findOne({ email });

if (existingUser && existingUser._id.toString() !== user._id.toString()) {
    return res.status(400).json({
        message: "Email already exists"
    });
}
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        if (name) {
            user.name = name;
        }
        if (email) {
            user.email = email;
        }
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        await user.save();
        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {

        res.status(500).json({
            message: "Server Error"
        });

    }
};

async function handleGetProfile(req, res) {
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
};




module.exports = { handleRegister, handleLogin, handleUpdateProfile, handleGetProfile };