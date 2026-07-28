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


        // ------------------------------------------
        // 1. Validate meeting title
        // ------------------------------------------

        if (!title) {
            return res.status(400).json({
                message: "Meeting title is required",
            });
        }


        // ------------------------------------------
        // 2. Validate members
        // ------------------------------------------

        if (
            !members ||
            !Array.isArray(members) ||
            members.length === 0
        ) {
            return res.status(400).json({
                message: "At least one member is required",
            });
        }


        // ------------------------------------------
        // 3. Validate each member
        // ------------------------------------------

        for (const member of members) {

            if (!member.name || !member.email) {

                return res.status(400).json({
                    message:
                        "Each member must have a name and email",
                });

            }

        }


        // ------------------------------------------
        // 4. Get authenticated host
        // ------------------------------------------

        if (!req.user || !req.user.id) {

            return res.status(401).json({
                message:
                    "Authenticated host not found",
            });

        }


        // ------------------------------------------
        // 5. Fetch host from database
        // ------------------------------------------

        const host = await User.findById(req.user.id);

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


        // ------------------------------------------
        // 6. Generate Meeting ID
        // ------------------------------------------

        const meetingId = uuidv4();


        // ------------------------------------------
        // 7. Generate Meeting Link
        // ------------------------------------------

        const meetingLink =
            `${process.env.FRONTEND_URL}/meeting/${meetingId}`;


        // ------------------------------------------
        // 8. Create Meeting
        // ------------------------------------------

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


        // ------------------------------------------
        // 9. Send Meeting Invitation
        // ------------------------------------------

        for (const member of members) {

            try {

                await sendMeetingInvitation(

                    member.email,

                    member.name,

                    meetingLink,

                    host.email,

                    host.name

                );


                console.log(
                    `Invitation sent to ${member.email}`
                );


            } catch (error) {

                console.log(
                    `Email Error for ${member.email}:`,
                    error.message
                );

            }

        }


        // ------------------------------------------
        // 10. Response
        // ------------------------------------------

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



// ==========================================
// JOIN MEETING
// ==========================================

async function joinMeeting(req, res) {

    try {

        const {
            meetingId
        } = req.params;


        const {
            email
        } = req.body;


        // ------------------------------------------
        // 1. Validate Meeting ID
        // ------------------------------------------

        if (!meetingId) {

            return res.status(400).json({

                message:
                    "Meeting ID is required"

            });

        }


        // ------------------------------------------
        // 2. Validate Email
        // ------------------------------------------

        if (!email) {

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


        // ------------------------------------------
        // 3. Find Meeting
        // ------------------------------------------

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


        // ------------------------------------------
        // 4. Find Invited Member
        // ------------------------------------------

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


        // ------------------------------------------
        // 5. Check Meeting Status
        // ------------------------------------------

        if (meeting.status === "ended") {

            return res.status(400).json({

                message:
                    "Meeting already ended"

            });

        }


        // ------------------------------------------
        // 6. Activate Meeting
        // ------------------------------------------

        if (meeting.status === "scheduled") {

            meeting.status = "active";

            meeting.startedAt =
                new Date();

            await meeting.save();

        }


        // ------------------------------------------
        // 7. Generate / Reuse UID
        // ------------------------------------------

        let uid = member.uid;


        if (!uid) {

            uid =
                Math.floor(
                    Math.random() * 1000000
                );


            member.uid =
                uid;


            await meeting.save();

        }


        // ------------------------------------------
        // 8. Agora Credentials
        // ------------------------------------------

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


        // ------------------------------------------
        // 9. Generate Agora Token
        // ------------------------------------------

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


        // ------------------------------------------
        // 10. Return Response
        // ------------------------------------------

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

    }


    catch (error) {

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