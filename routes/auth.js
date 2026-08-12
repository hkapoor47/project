const express = require('express');

const auth = require("../middleware/authMiddleware");

const {
    handleRegister,
    handleLogin,
    handleUpdateProfile,
    handleGetProfile,
    handleForgotPassword,
    handleVerifyOtp,
    handleResetPassword
} = require('../controller/authController');

const router = express.Router();

router.post('/register', handleRegister);

router.post('/login', handleLogin);

router.put("/update", auth, handleUpdateProfile);

router.get("/me", auth, handleGetProfile);

router.post("/forgot-password", handleForgotPassword);

router.post("/verify-otp", handleVerifyOtp);

router.post("/reset-password", handleResetPassword);

module.exports = router;