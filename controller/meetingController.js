const Meeting = require("../models/meeting");
const User = require("../models/user");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const {
    RtcTokenBuilder,
    RtcRole
} = require("agora-token");

const {
    sendMeetingInvitation,
} = require("../services/emailService");


// ==========================================
// CREATE MEETING
// ==========================================

async function createMeeting(req, res) {
    try {

        const {
            title,
            members,
        } = req.body;


        // 1. Validate meeting title
        if (!title) {
            return res.status(400).json({
                message: "Meeting title is required",
            });
        }


        // 2. Validate members
        if (
            !members ||
            !Array.isArray(members) ||
            members.length === 0
        ) {
            return res.status(400).json({
                message: "At least one member is required",
            });
        }


        // 3. Validate each member
        for (const member of members) {

            if (!member.name || !member.email) {
                return res.status(400).json({
                    message:
                        "Each member must have a name and email",
                });
            }

        }


        // 4. Get authenticated host
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message:
                    "Authenticated host not found",
            });
        }


        // 5. Fetch host from database
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


        // 6. Generate Meeting ID
        const meetingId = uuidv4();


        // 7. Generate Meeting Link
        const meetingLink =
            `${process.env.FRONTEND_URL}/meeting/${meetingId}`;


        // 8. Create Meeting
      const meeting = await Meeting.create({
           meetingId,
           hostId: host._id,
           title,
           meetingLink,
           members,
});


        console.log(
            "Meeting Created:",
            meetingId
        );


       
        return res.status(201).json({

            message:
                "Meeting created successfully",

            host: {

                name:
                    host.name,

                email:
                    host.email,

            },

            meetingId,

            agoraChannel:
                meetingId,

            meetingLink,

            meeting,

        });


    } catch (error) {

        console.log(
            "Create Meeting Error:",
            error
        );


        return res.status(500).json({

            message:
                "Failed to create meeting",

            error:
                error.message,

        });

    }

}

async function startMeeting(req, res) {
    try {

        const { meetingId } = req.params;

        // Logged-in host
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: "Authenticated host not found"
            });
        }

        // Find host
        const host = await User.findById(req.user.id);

        if (!host) {
            return res.status(404).json({
                message: "Host user not found"
            });
        }

        // Find meeting
        const meeting = await Meeting.findOne({
            meetingId
        });

        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        // Check if host owns this meeting
        // NOTE: This requires hostId in Meeting model.
        // We can add this next if needed.

        // Check meeting status
        if (meeting.status === "ended") {
            return res.status(400).json({
                message: "Meeting has already ended"
            });
        }

        if (meeting.status === "active") {
            return res.status(400).json({
                message: "Meeting is already active"
            });
        }

        // Change status
        meeting.status = "active";
        meeting.startedAt = new Date();

        await meeting.save();

        // Send invitation email to every member
        for (const member of meeting.members) {

            try {

                await sendMeetingInvitation(
                    member.email,
                    member.name,
                    meeting.meetingLink,
                    host.email,
                    host.name
                );

                console.log(
                    `Invitation sent to ${member.email}`
                );

            } catch (error) {

                console.error(
                    `Email Error for ${member.email}:`,
                    error.message
                );

            }
        }

        return res.status(200).json({

            message:
                "Meeting started and invitations sent",

            meetingId:
                meeting.meetingId,

            meetingLink:
                meeting.meetingLink,

            status:
                meeting.status,

            host: {
                name: host.name,
                email: host.email
            }

        });

    } catch (error) {

        console.error(
            "Start Meeting Error:",
            error
        );

        return res.status(500).json({

            message:
                "Failed to start meeting",

            error:
                error.message

        });
    }
}

// ==========================================
// JOIN MEETING
// ==========================================

async function joinMeeting(req, res) {

    try {

        const {
            meetingId
        } = req.params;


        // ==========================================
        // GET LOGGED-IN USER FROM JWT
        // ==========================================

        if (!req.user || !req.user.email) {

            return res.status(401).json({

                message:
                    "Authenticated user not found"

            });

        }


        const email =
            req.user.email;


        console.log(
            "Joining User Email:",
            email
        );


        // ==========================================
        // 1. Validate Meeting ID
        // ==========================================

        if (!meetingId) {

            return res.status(400).json({

                message:
                    "Meeting ID is required"

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


        // ==========================================
        // 2. Find Meeting
        // ==========================================

        const meeting =
            await Meeting.findOne({

                meetingId

            });


        if (!meeting) {

            return res.status(404).json({

                message:
                    "Meeting not found"

            });

        }


        // ==========================================
        // 3. Find Invited Member
        // ==========================================

        const member =
            meeting.members.find(

                (member) =>

                    member.email.toLowerCase() ===
                    email.toLowerCase()

            );


        if (!member) {

            return res.status(403).json({

                message:
                    "You are not invited to this meeting"

            });

        }


        console.log(
            "Invited Member:",
            member.name
        );


        // ==========================================
        // 4. Check Meeting Status
        // ==========================================

        if (meeting.status === "ended") {

            return res.status(400).json({

                message:
                    "Meeting already ended"

            });

        }


        // ==========================================
        // 5. Activate Meeting
        // ==========================================

        if (meeting.status === "scheduled") {

            meeting.status =
                "active";

            meeting.startedAt =
                new Date();

            await meeting.save();

        }


        // ==========================================
        // 6. Generate / Reuse UID
        // ==========================================

        let uid =
            member.uid;


        if (!uid) {

            uid =
                Math.floor(
                    Math.random() * 1000000
                );


            member.uid =
                uid;


            await meeting.save();

        }


        // ==========================================
        // 7. Agora Credentials
        // ==========================================

        const appId =
            process.env.AGORA_APP_ID;


        const appCertificate =
            process.env.AGORA_APP_CERTIFICATE;


        if (
            !appId ||
            !appCertificate
        ) {

            return res.status(500).json({

                message:
                    "Agora credentials missing"

            });

        }


        // ==========================================
        // 8. Generate Agora Token
        // ==========================================

        const role =
            RtcRole.PUBLISHER;


        const privilegeExpireTime =

            Math.floor(
                Date.now() / 1000
            ) + 3600;


        const token =

            RtcTokenBuilder.buildTokenWithUid(

                appId,

                appCertificate,

                meeting.meetingId,

                uid,

                role,

                privilegeExpireTime

            );


        // ==========================================
        // 9. Return Response
        // ==========================================

        return res.status(200).json({

            message:
                "You can join the meeting",

            meetingId:
                meeting.meetingId,

            agoraChannel:
                meeting.meetingId,

            token,

            uid,

            expireAt:
                privilegeExpireTime,

            member: {

                name:
                    member.name,

                email:
                    member.email

            }

        });


    } catch (error) {

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
    startMeeting,
    joinMeeting

};