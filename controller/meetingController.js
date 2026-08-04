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

        const meetingLink =
            `${process.env.FRONTEND_URL}/meeting/${meetingId}`;

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
            meeting.members.map((member) =>
               sendMeetingInvitation(
               member.email,
               member.name,
               meeting.meetingLink,
               host.email,
               host.name
           )
          )
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
        const {
            meetingId
        } = req.params;

        if (
            !req.user||
            !req.user.email||
            !req.user.id
        ) {
            return res.status(401).json({
                message:"Authenticated user not found"
            });
        }

        const userId =req.user.id;
        const email = req.user.email;
        console.log( "Joining User ID:",userId );
        console.log("Joining User Email:", email);

        if (!meetingId) {
            return res.status(400).json({
                message: "Meeting ID is required"
            });
        }
        console.log(  "Database:", mongoose.connection.name );
        console.log( "Meeting ID:", meetingId);

        const meeting =
            await Meeting.findOne({
                meetingId
            });
        if (!meeting) {
            return res.status(404).json({
                message:"Meeting not found"
            });
        }
        if ( meeting.status === "scheduled" ) {
            return res.status(400).json({
                message: "Meeting has not been started by the host yet"
            });
        }
        if ( meeting.status === "ended"
        ) {
            return res.status(400).json({
                message: "Meeting already ended"
            });
        }
        const isHost =
            meeting.hostId &&
            meeting.hostId.toString() ===
            userId.toString();


        const member =meeting.members.find(
                (member) =>
                    member.email.toLowerCase() ===
                    email.toLowerCase()
            );

        if ( !isHost &&!member) {
            return res.status(403).json({
                message: "You are not invited to this meeting"
            });
        }

        let host = null;
        if (isHost) {
            host =  await User.findById( userId);
            if (!host) {
                return res.status(404).json({
                    message: "Host user not found"
                });
            }
        }

        let uid;
        if (isHost) {
            uid = 1;
        } else {
            uid = member.uid;
            if (!uid) {
                uid = Math.floor(100000 + Math.random() * 900000);
                member.uid = uid;
                await meeting.save();
            }
        }
        const appId =process.env.AGORA_APP_ID;
        const appCertificate =process.env.AGORA_APP_CERTIFICATE;
        if ( !appId || !appCertificate
        ) {
            return res.status(500).json({
                message: "Agora credentials missing"
            });
        }
        const role = RtcRole.PUBLISHER;
        const privilegeExpireTime =  Math.floor(Date.now() / 1000) + 3600;
        const token =
            RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                meeting.meetingId,
                uid,
                role,
                privilegeExpireTime
            );
        return res.status(200).json({
            message: "You can join the meeting",
            meetingId:  meeting.meetingId,
            meetingLink: meeting.meetingLink,
            agoraChannel: meeting.meetingId,
            token,
            uid,
            expireAt: privilegeExpireTime,
            member: isHost ? {
                    name: host.name,
                    email: host.email
                } : {
                    name:  member.name,
                    email: member.email
                }
        });
    } catch (error) {
        console.error(
            "Join Meeting Error:", error
        );
        return res.status(500).json({
            message:"Failed to join meeting",
            error: error.message
        });
    }
};

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

        for (const member of meeting.members) {
            await sendPdf(
                member.email,
                member.name,
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
    sharePdfEmail
};