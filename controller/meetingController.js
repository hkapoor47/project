const Meeting = require("../models/meeting");

async function createMeeting(req, res) {
  try {
    const { members } = req.body;

    // Check if members array exists
    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "At least one member is required",
      });
    }

    // Validate each member
    for (const member of members) {
      if (!member.name || !member.email) {
        return res.status(400).json({
          message: "Each member must have a name and email",
        });
      }
    }

    // Create ONE meeting containing ALL members
    const meeting = await Meeting.create({
      members: members,
    });

    return res.status(201).json({
      message: "Meeting created successfully",
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