const Meeting = require("../models/meeting");
const { v4: uuidv4 } = require("uuid");

async function createMeeting(req, res) {
  try {
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "At least one member is required",
      });
    }

    for (const member of members) {
      if (!member.name || !member.email) {
        return res.status(400).json({
          message: "Each member must have a name and email",
        });
      }
    }

    // Generate unique meeting ID
    const meetingId = uuidv4();

    // Create ONE meeting document
    const meeting = await Meeting.create({
      meetingId,
      members,
    });

    return res.status(201).json({
      message: "Meeting created successfully",
      meetingId: meeting.meetingId,
      meeting,
    });

  } catch (error) {
    console.error("Create Meeting Error:", error);

    return res.status(500).json({
      message: "Failed to create meeting",
      error: error.message,
    });
  }
}

module.exports = {
  createMeeting,
};