const express = require("express");

const router = express.Router();

const {
  createMeeting,
} = require("../controller/meetingController");

router.post("/", createMeeting);

module.exports = router;