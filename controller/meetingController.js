const Meeting = require("../models/meeting");
const User = require("../models/user");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const {
    RtcTokenBuilder,
    RtcRole
} = require("agora-token");


// ==========================================
// CREATE MEETING
// ==========================================

async function createMeeting(req, res) {

    try {

        const {
            title,
            members,
        } = req.body;


        // ==========================================
        // 1. Validate Meeting Title
        // ==========================================

        if (!title) {

            return res.status(400).json({
                message: "Meeting title is required",
            });

        }


        // ==========================================
        // 2. Validate Members
        // ==========================================

        if (
            !members ||
            !Array.isArray(members) ||
            members.length === 0
        ) {

            return res.status(400).json({
                message: "At least one member is required",
            });

        }


        // ==========================================
        // 3. Validate Each Member
        // ==========================================

        for (const member of members) {

            if (!member.name || !member.email) {

                return res.status(400).json({
                    message:
                        "Each member must have a name and email",
                });

            }

        }


        // ==========================================
        // 4. Get Authenticated Host
        // ==========================================

        if (!req.user || !req.user.id) {

            return res.status(401).json({
                message:
                    "Authenticated host not found",
            });

        }


        // ==========================================
        // 5. Find Host
        // ==========================================

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


        // ==========================================
        // 6. Generate Meeting ID
        // ==========================================

        const meetingId =
            uuidv4();


        // ==========================================
        // 7. Generate Meeting Link
        // ==========================================

        const meetingLink =
            `${process.env.FRONTEND_URL}/meeting/${meetingId}`;


        // ==========================================
        // 8. Create Meeting
        // ==========================================

        const meeting =
            await Meeting.create({

                meetingId,

                hostId:
                    host._id,

                title,

                meetingLink,

                members,

                status:
                    "scheduled",

            });


        console.log(
            "Meeting Created:",
            meetingId
        );


        // ==========================================
        // 9. Response
        // ==========================================

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

            status:
                meeting.status,

            meeting,

        });


    } catch (error) {

        console.error(
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
// START MEETING
// ==========================================

async function startMeeting(req, res) {

    try {

        const {
            meetingId
        } = req.params;


        // ==========================================
        // 1. Check Authenticated Host
        // ==========================================

        if (!req.user || !req.user.id) {

            return res.status(401).json({

                message:
                    "Authenticated host not found"

            });

        }


        // ==========================================
        // 2. Find Host
        // ==========================================

        const host =
            await User.findById(
                req.user.id
            );


        if (!host) {

            return res.status(404).json({

                message:
                    "Host user not found"

            });

        }


        // ==========================================
        // 3. Find Meeting
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
        // 4. Check Meeting Host
        // ==========================================

        if (
            !meeting.hostId ||
            meeting.hostId.toString() !==
            host._id.toString()
        ) {

            return res.status(403).json({

                message:
                    "You are not the host of this meeting"

            });

        }


        // ==========================================
        // 5. Check Meeting Status
        // ==========================================

        if (
            meeting.status ===
            "ended"
        ) {

            return res.status(400).json({

                message:
                    "Meeting has already ended"

            });

        }


        if (
            meeting.status ===
            "active"
        ) {

            return res.status(400).json({

                message:
                    "Meeting is already active"

            });

        }


        // ==========================================
        // 6. Start Meeting
        // ==========================================

        meeting.status =
            "active";

        meeting.startedAt =
            new Date();


        await meeting.save();


        // ==========================================
        // 7. Return Meeting Link
        // ==========================================

        return res.status(200).json({

            message:
                "Meeting started successfully",

            meetingId:
                meeting.meetingId,

            meetingLink:
                meeting.meetingLink,

            agoraChannel:
                meeting.meetingId,

            status:
                meeting.status,

            host: {

                name:
                    host.name,

                email:
                    host.email,

            },

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


        // ==========================================
        // 1. Check Logged-in User
        // ==========================================

        if (
            !req.user ||
            !req.user.email
        ) {

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
        // 2. Validate Meeting ID
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
        // 3. Find Meeting
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
        // 4. Check Meeting Status
        // ==========================================

        if (
            meeting.status ===
            "scheduled"
        ) {

            return res.status(400).json({

                message:
                    "Meeting has not been started by the host yet"

            });

        }


        if (
            meeting.status ===
            "ended"
        ) {

            return res.status(400).json({

                message:
                    "Meeting already ended"

            });

        }


        // ==========================================
        // 5. Check If User Is Host
        // ==========================================

        const isHost =
            meeting.hostId &&
            meeting.hostId.toString() ===
            req.user.id.toString();


        // ==========================================
        // 6. Find Invited Member
        // ==========================================

        const member =
            meeting.members.find(

                (member) =>

                    member.email.toLowerCase() ===
                    email.toLowerCase()

            );


        // ==========================================
        // 7. Allow Host OR Invited Member
        // ==========================================

        if (
            !isHost &&
            !member
        ) {

            return res.status(403).json({

                message:
                    "You are not invited to this meeting"

            });

        }


        // ==========================================
        // 8. Generate UID
        // ==========================================

        let uid;


        if (isHost) {

            // Host gets a unique UID
            uid =
                1;

        } else {

            uid =
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

        }


        // ==========================================
        // 9. Agora Credentials
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
        // 10. Generate Agora Token
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
        // 11. Return Response
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

            member: isHost

                ? {

                    name:
                        host.name,

                    email:
                        host.email

                }

                : {

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



// ==========================================
// EXPORT
// ==========================================

module.exports = {

    createMeeting,

    startMeeting,

    joinMeeting

};