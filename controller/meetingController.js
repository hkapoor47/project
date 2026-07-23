const Meeting = require("../models/Meeting");

async function createMeeting(req, res) {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    const meeting = await Meeting.create({
      name,
      email,
    });

    return res.status(201).json({
      message: "Meeting details saved successfully",
      meeting,
    });
  } catch (error) {
    console.error("Create Meeting Error:", error);

    return res.status(500).json({
      message: "Failed to save meeting details",
      error: error.message,
    });
  }
}

module.exports = {
  createMeeting,
};