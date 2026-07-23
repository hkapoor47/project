const Meeting = require("../models/meeting");
const { v4: uuidv4 } = require("uuid");

async function createMeeting(req, res) {
  try {
    const { meetingId, members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "At least one member is required",
      });
    }

    // Normalize members
    const normalizedMembers = members.map((member) => ({
      name: member.name.trim(),
      email: member.email.trim().toLowerCase(),
    }));

    // Validate members
    for (const member of normalizedMembers) {
      if (!member.name || !member.email) {
        return res.status(400).json({
          message: "Each member must have a name and email",
        });
      }
    }

    // Check duplicate emails inside submitted members
    const submittedEmails = normalizedMembers.map(
      (member) => member.email
    );

    const uniqueEmails = new Set(submittedEmails);

    if (submittedEmails.length !== uniqueEmails.size) {
      return res.status(400).json({
        message: "Duplicate email IDs are not allowed",
      });
    }

    // =========================================
    // CASE 1: Existing meeting
    // =========================================

    if (meetingId) {
      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting) {
        return res.status(404).json({
          message: "Meeting not found",
        });
      }

      // Existing emails in database
      const existingEmails = new Set(
        meeting.members.map((member) =>
          member.email.toLowerCase()
        )
      );

      // Only take NEW members
      const newMembers = normalizedMembers.filter(
        (member) => !existingEmails.has(member.email)
      );

      if (newMembers.length === 0) {
        return res.status(400).json({
          message: "These members are already added",
        });
      }

      // Add only new members
      meeting.members.push(...newMembers);

      await meeting.save();

      return res.status(200).json({
        message: "New members added successfully",
        meetingId: meeting.meetingId,
        members: meeting.members,
      });
    }

    // =========================================
    // CASE 2: First submission
    // =========================================

    const newMeetingId = uuidv4();

    const meeting = await Meeting.create({
      meetingId: newMeetingId,
      members: normalizedMembers,
    });

    return res.status(201).json({
      message: "Meeting created successfully",
      meetingId: meeting.meetingId,
      members: meeting.members,
    });

  } catch (error) {
    console.error("Meeting Error:", error);

    return res.status(500).json({
      message: "Failed to process meeting",
      error: error.message,
    });
  }
}

module.exports = {
  createMeeting,
};