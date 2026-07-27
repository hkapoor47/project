const Meeting = require("../models/meeting");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const {
    RtcTokenBuilder,
    RtcRole
} = require("agora-token");
const {
    sendMeetingInvitation,
} = require("../services/emailService");


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
        const meetingId = uuidv4();

        const meetingLink =
            `${process.env.FRONTEND_URL}/meeting/${meetingId}`;

        const meeting = await Meeting.create({
            meetingId,
            title,
            meetingLink,
            members,
        });
        console.log(
            "Meeting Created:",
            meetingId
        );

        for (const member of members) {
            try {
                await sendMeetingInvitation(
                    member.email,
                    member.name,
                    meetingLink
                );
                console.log(
                    `Invitation sent to ${member.email}`
                );
            } catch(error) {
                console.log(
                    "Email Error:",
                    error.message
                );
            }
        }

        return res.status(201).json({
            message:
            "Meeting created successfully",
            meetingId,
            agoraChannel:
            meetingId,
            meetingLink,
            meeting,
        });

    } catch(error) {
        console.log(
            "Create Meeting Error:",
            error
        );
        return res.status(500).json({
            message:
            "Failed to create meeting",
            error:error.message
        });

    }

}

async function joinMeeting(req,res){
    try {
        const {
            meetingId
        } = req.params;
        const {
            email
        } = req.body;

        if(!meetingId){
            return res.status(400).json({
                message:
                "Meeting ID is required"
            });
        }

        if(!email){
            return res.status(400).json({
                message:
                "Email is required"
            });
        }
        console.log(
            "Database:",
            mongoose.connection.name
        );

        console.log(
            "Meeting ID:",
            meetingId
        );

        const meeting =
            await Meeting.findOne({
                meetingId
            });

        if(!meeting){
            return res.status(404).json({
                message:
                "Meeting not found"
            });
        }

        const member =
            meeting.members.find(
                (member)=>
                member.email.toLowerCase()
                ===
                email.toLowerCase()
            );

        if(!member){
            return res.status(403).json({
                message:
                "You are not invited to this meeting"
            });
        }

        if(meeting.status==="ended"){
            return res.status(400).json({
                message:
                "Meeting already ended"
            });
        }

        if(meeting.status==="scheduled"){
            meeting.status="active";
            meeting.startedAt =
                new Date();
            await meeting.save();
        }
       let uid = member.uid;

        if(!uid){
            uid =
              Math.floor(
                 Math.random()*1000000
             );
         member.uid = uid;
         await meeting.save();
        }
       

        const appId =
            process.env.AGORA_APP_ID;

        const appCertificate =
            process.env.AGORA_APP_CERTIFICATE;
        if(!appId || !appCertificate){
            return res.status(500).json({
                message:
                "Agora credentials missing"

            });
        }
        const role =
            RtcRole.PUBLISHER;
        const privilegeExpireTime =
            Math.floor(
                Date.now()/1000
            )
            +
            3600;
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
            message:"You can join the meeting",
            meetingId:meeting.meetingId,
            agoraChannel:meeting.meetingId,
            token,
            uid,
            expireAt:privilegeExpireTime,
            member:{
                name:member.name,
                email:
            member.email
            }
        });
    }
    catch(error){
        console.error(
            "Join Meeting Error:",
            error
        );
        return res.status(500).json({
            message:
            "Failed to join meeting",
            error:
            error.message
        });
    }
}

module.exports = {
    createMeeting,
    joinMeeting
};