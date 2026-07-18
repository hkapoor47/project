const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const auth = require("../middleware/authMiddleware");
const { handleRegister , handleLogin , handleUpdateProfile , handleGetProfile } = require('../controller/controller');


const router = express.Router();

router.post('/register',handleRegister);

router.post('/login', handleLogin);

router.put("/update", auth, handleUpdateProfile);

router.get("/me", auth, handleGetProfile);

module.exports = router;