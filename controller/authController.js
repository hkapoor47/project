const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require("jsonwebtoken");
const { sendPasswordResetOtp } = require("../services/emailService");

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

   if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }

    const match= await bcrypt.compare(password, user.password);

    if (!match) {
        return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user._id.toString(),email:user.email, role: user.role}, process.env.JWT_SECRET, { expiresIn: '1h' });
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


async function handleForgotPassword(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // OTP expires after 10 minutes
        const otpExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

        user.resetOtp = otp;
        user.resetOtpExpires = otpExpires;

        await user.save();

        await sendPasswordResetOtp(email, otp);

        res.status(200).json({
            message: "OTP sent to your email"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to send OTP"
        });
    }
}


async function handleVerifyOtp(req, res) {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (!user.resetOtp || !user.resetOtpExpires) {
            return res.status(400).json({
                message: "No OTP request found"
            });
        }

        if (user.resetOtpExpires < new Date()) {
            return res.status(400).json({
                message: "OTP has expired"
            });
        }

        if (user.resetOtp !== otp) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        const resetToken = jwt.sign(
            {
                id: user._id.toString(),
                purpose: "password-reset"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "10m"
            }
        );

        res.status(200).json({
            message: "OTP verified successfully",
            resetToken
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server Error"
        });
    }
}


async function handleResetPassword(req, res) {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                message: "New password is required"
            });
        }

       
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Reset token is required"
            });
        }

        const resetToken = authHeader.split(" ")[1];

        let decoded;

        try {
            decoded = jwt.verify(
                resetToken,
                process.env.JWT_SECRET
            );
        } catch (err) {
            return res.status(401).json({
                message: "Invalid or expired reset token"
            });
        }

       
        if (decoded.purpose !== "password-reset") {
            return res.status(401).json({
                message: "Invalid reset token"
            });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        user.password = hashedPassword;

        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;

        await user.save();

        res.status(200).json({
            message: "Password reset successfully"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server Error"
        });
    }
}
module.exports = {
    handleRegister,
    handleLogin,
    handleUpdateProfile,
    handleGetProfile,
    handleForgotPassword,
    handleVerifyOtp,
    handleResetPassword
};