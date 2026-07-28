const express = require("express");

const router = express.Router();

const {
  createMeeting,
  joinMeeting,
} = require("../controller/meetingController");

const auth = require("../middleware/authMiddleware");

router.post("/",auth, createMeeting);

router.post("/:meetingId/join",auth, joinMeeting);

module.exports = router;
