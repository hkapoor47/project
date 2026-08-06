const express = require("express");

const router = express.Router();

const {
  createMeeting,
  startMeeting,
  leaveMeeting,
  joinMeeting,
} = require("../controller/meetingController");

const auth = require("../middleware/authMiddleware");

router.post("/", auth, createMeeting);

router.post("/:meetingId/start", auth, startMeeting);

router.post("/:meetingId/join", auth, joinMeeting);

router.post("/:meetingId/leave", auth, leaveMeeting);

module.exports = router;