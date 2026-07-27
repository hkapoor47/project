const express = require("express");

const router = express.Router();

const {
  createMeeting,
  joinMeeting,
} = require("../controller/meetingController");

router.post("/", createMeeting);

router.post("/:meetingId/join", joinMeeting);

module.exports = router;
