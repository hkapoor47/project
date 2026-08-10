const Meeting = require("../models/meeting");
const User = require("../models/user");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { sendMeetingInvitation } = require("../services/emailService");
const {RtcTokenBuilder,RtcRole} = require("agora-token");
const {sendPdf}= require("../services/emailService");


async function createMeeting(req, res) {
    try {
        const {
            title,
            members,
        } = req.body;
        if (!title) {
            return res.status(400).json({
                message: "Meeting title is required",
            });
        }
        if (
            !members ||
            !Array.isArray(members) ||
            members.length === 0
        ) {
            return res.status(400).json({
                message: "At least one member is required",
            });
        }
        for (const member of members) {
            if (!member.name || !member.email) {
                return res.status(400).json({
                    message:
                        "Each member must have a name and email",
                });
            }
        }

        const emails = members.map(member =>
           member.email.trim().toLowerCase()
        );

        const uniqueEmails = new Set(emails);

        if (emails.length !== uniqueEmails.size) {
          return res.status(400).json({
             message: "Duplicate email addresses are not allowed"
           });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message:
                    "Authenticated host not found",
            });
        }

        const host =
            await User.findById(req.user.id);
        if (!host) {
            return res.status(404).json({
                message:
                    "Host user not found",
            });
        }
        console.log(
            "Authenticated Host:",
            host.name
        );
        console.log(
            "Host Email:",
            host.email
        );

       const meetingId = uuidv4();

       const meetingUrl = new URL(
    `${process.env.FRONTEND_URL}/meeting/${meetingId}`
     );

meetingUrl.searchParams.set(
    "hostName",
    host.name
);

const meetingLink = meetingUrl.toString();

        const meeting = await Meeting.create({
                meetingId,
                hostId: host._id,
                title,
                meetingLink,
                members,
                status:"scheduled",
            });

        console.log( "Meeting Created:",meetingId);

        return res.status(201).json({
            message:"Meeting created successfully",
            host: {
                name: host.name,
                email:host.email,
            },
            meetingId,
            meetingLink,
            agoraChannel:meetingId,
            status:meeting.status,
            meeting,
        });
    } catch (error) {
        console.error(
            "Create Meeting Error:", error
        );
        return res.status(500).json({
            message:"Failed to create meeting",
            error:error.message,
        });
    }
}

async function startMeeting(req, res) {
    try {
        const {
            meetingId
        } = req.params;
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message:"Authenticated host not found"
            });
        }
        const host =
            await User.findById(
                req.user.id
            );
        if (!host) {
            return res.status(404).json({
                message:"Host user not found"
            })
        }

        const meeting =
            await Meeting.findOne({
                meetingId
            });
        if (!meeting) {
            return res.status(404).json({
                message:"Meeting not found"
            });
        }
        if (
            !meeting.hostId ||
            meeting.hostId.toString() !==
            host._id.toString()
        ) {
            return res.status(403).json({
                message:"You are not the host of this meeting"
            });
        }
        if (
            meeting.status ==="ended"
        ) {
            return res.status(400).json({
                message: "Meeting has already ended"
            });
        }
        if (
            meeting.status ==="active"
        ) {
            return res.status(400).json({
                message:"Meeting is already active"
            });
        }

        meeting.status = "active";
        meeting.startedAt = new Date();
        await meeting.save();

       await Promise.all(
             meeting.members.map(async (member) => {
               try {
                    await sendMeetingInvitation(
                    member.email,
                    member.name,
                    meeting.meetingLink,
                    host.email,
                    host.name
                  );
                  } catch (err) {
                   console.error(
                    `Failed to send email to ${member.email}:`,
                       err.message
                  );
                }
            })
        );

        return res.status(200).json({
            message: "Meeting started successfully",
            meetingId: meeting.meetingId,
            meetingLink: meeting.meetingLink,
            agoraChannel: meeting.meetingId,
            status: meeting.status,
            host: {
                name: host.name,
                email: host.email,
            },
        });
    } catch (error) {
        console.error( "Start Meeting Error:", error);
        return res.status(500).json({
            message:   "Failed to start meeting",
            error: error.message,
        });
    }
}
async function joinMeeting(req, res) {
    try {
        const { meetingId } = req.params;

        if (!req.user || !req.user.email || !req.user.id) {
            return res.status(401).json({
                message: "Authenticated user not found"
            });
        }

        const userId = req.user.id;
        const email = req.user.email;

        const meeting = await Meeting.findOne({ meetingId });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        if (meeting.status === "scheduled") {
            return res.status(400).json({
                message: "Meeting has not been started by the host yet"
            });
        }

        if (meeting.status === "ended") {
            return res.status(400).json({
                message: "Meeting already ended"
            });
        }

        const isHost =
            meeting.hostId &&
            meeting.hostId.toString() === userId.toString();

        const member = meeting.members.find(
            (member) =>
                member.email.toLowerCase() === email.toLowerCase()
        );

        if (!isHost && !member) {
            return res.status(403).json({
                message: "You are not invited to this meeting"
            });
        }

        const host = await User.findById(meeting.hostId);

        if (!host) {
            return res.status(404).json({
                message: "Host user not found"
            });
        }

        let uid;

        if (isHost) {
            uid = 1;
        } else {
            uid = member.uid;

            if (!uid) {
                uid = Math.floor(100000 + Math.random() * 900000);
                member.uid = uid;
            }

            member.status = "joined";
            member.joinedAt = new Date();

            await meeting.save();
        }

        const io = req.app.get("io");

        const participants = [
            {
                name: host.name,
                email: host.email,
                uid: 1
            },
            ...meeting.members
                .filter(member => member.status === "joined")
                .map(member => ({
                    name: member.name,
                    email: member.email,
                    uid: member.uid
                }))
        ];

        io.to(meetingId).emit(
            "participants-updated",
            participants
        );

        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            return res.status(500).json({
                message: "Agora credentials missing"
            });
        }

        const role = RtcRole.PUBLISHER;

        const privilegeExpireTime =
            Math.floor(Date.now() / 1000) + 3600;

        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            meeting.meetingId,
            uid,
            role,
            privilegeExpireTime
        );

        return res.status(200).json({
            message: "You can join the meeting",
            meetingId: meeting.meetingId,
            meetingLink: meeting.meetingLink,
            agoraChannel: meeting.meetingId,
            token,
            uid,
            expireAt: privilegeExpireTime,
            member: {
                name: isHost ? host.name : member.name,
                email: isHost ? host.email : member.email
            }
        });

    } catch (error) {
        console.error("Join Meeting Error:", error);

        return res.status(500).json({
            message: "Failed to join meeting",
            error: error.message
        });
    }
}

async function leaveMeeting(req, res) {
    try {

        const { meetingId } = req.params;
        const userEmail = req.user.email;

        const meeting = await Meeting.findOne({ meetingId });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        const member = meeting.members.find(
            member =>
                member.email.toLowerCase() ===
                userEmail.toLowerCase()
        );

        if (!member) {
            return res.status(404).json({
                message: "Participant not found"
            });
        }

        member.status = "left";
        member.leftAt = new Date();

        await meeting.save();

        const host = await User.findById(meeting.hostId);

        const participants = [
            {
                name: host.name,
                email: host.email,
                uid: 1
            },
            ...meeting.members
                .filter(member => member.status === "joined")
                .map(member => ({
                    name: member.name,
                    email: member.email,
                    uid: member.uid
                }))
        ];

        const io = req.app.get("io");

        io.to(meetingId).emit(
            "participants-updated",
            participants
        );

        return res.status(200).json({
            message: "Left meeting successfully"
        });

    } catch (error) {

        console.error("Leave Meeting Error:", error);

        return res.status(500).json({
            message: "Failed to leave meeting",
            error: error.message
        });

    }
}

async function sharePdfEmail(req, res) {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOne({
            meetingId
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        if (!meeting.pdfUrl) {
            return res.status(400).json({
                message: "PDF not generated yet"
            });
        }

        const host = await User.findById(meeting.hostId);

        const recipients = [
        {
            email: host.email,
            name: host.name
        },
          ...meeting.members
      ];


        for(const person of recipients){

        await sendPdf(
            person.email,
            person.name,
            meeting.pdfUrl
        );

        }

        return res.json({
            message: "PDF shared successfully"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Failed to share PDF",
            error: error.message
        });
    }
}

module.exports = {
    createMeeting,
    startMeeting,
    joinMeeting,
    leaveMeeting,
    sharePdfEmail
};