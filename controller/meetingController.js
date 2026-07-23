const Meeting = require("../models/meeting");
const { v4: uuidv4 } = require("uuid");

async function createMeeting(req, res) {
  try {
    const { members } = req.body;

    console.log("Meeting request:", req.body);

    // Check members
    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "At least one member is required",
      });
    }

    // Clean member data
    const normalizedMembers = members.map((member) => ({
      name: member.name.trim(),
      email: member.email.trim().toLowerCase(),
    }));

    // Check empty values
    for (const member of normalizedMembers) {
      if (!member.name || !member.email) {
        return res.status(400).json({
          message: "Each member must have a name and email",
        });
      }
    }

    // Check duplicate emails inside same meeting
    const emails = normalizedMembers.map(
      (member) => member.email
    );

    const uniqueEmails = new Set(emails);

    if (emails.length !== uniqueEmails.size) {
      return res.status(400).json({
        message: "Duplicate email IDs are not allowed",
      });
    }

    // Generate unique meeting ID
    const meetingId = uuidv4();

    // Create ONE meeting
    const meeting = await Meeting.create({
      meetingId,
      members: normalizedMembers,
    });

    return res.status(201).json({
      message: "Meeting created successfully",
      meetingId: meeting.meetingId,
      meeting,
    });

  } catch (error) {
    console.error("Create Meeting Error:", error);

    // Handle duplicate meetingId
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Meeting ID already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to create meeting",
      error: error.message,
    });
  }
}

module.exports = {
  createMeeting,
};