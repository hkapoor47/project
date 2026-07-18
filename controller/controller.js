const bcrypt = require('bcrypt');
const User = require('../models/user');


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
    res.json({ message: 'User registered successfully', user });
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
    const token = jwt.sign({ id: user._id , role: user.role}, "secretkey", { expiresIn: '1h' });
    res.json({ message: 'Login successful', token , user:{
        id:user,
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

 async function handleSpeechToTextStart(req, res) {
      console.log("Speech API Hit");
    try {
        const { channel, uid } = req.body;
        if (!channel || uid === undefined) {
            return res.status(400).json({
                message: "channel and uid are required"
            });
        }
         console.log("Calling speechService...");

        const result = await startSpeechToText(channel, uid);
        res.status(200).json(result);

    } catch (error) {
        console.error("Speech-to-Text Error:", error.message);
        res.status(500).json({
            message: "Failed to start Speech-to-Text",
            error: error.message
        });
    }
};


async function handleSpeechToTextStop(req, res) {
    try {
        const { agent_id } = req.body;
        if (!agent_id) {
            return res.status(400).json({
                message: "agent_id is required"
            });
        }
        const result = await stopSpeechToText(agent_id);
        res.json(result);
    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({
            message: "Failed to stop Speech-to-Text",
            error: error.message
        });
    }

};

module.exports = { handleRegister, handleLogin, handleUpdateProfile, handleGetProfile , handleSpeechToTextStart, handleSpeechToTextStop};