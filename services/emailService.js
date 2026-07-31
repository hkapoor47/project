const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendMeetingInvitation(
    email,
    memberName,
    meetingLink,
    hostEmail,
    hostName
) {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error(
                "EMAIL_USER or EMAIL_PASS is missing in .env"
            );
        }
        if (!email || !meetingLink) {
            throw new Error(
                "Email address and meeting link are required"
            );
        }
        const mailOptions = {
            from: `"Meeting App" <${process.env.EMAIL_USER}>`,
            to: email,
            replyTo: hostEmail,
            subject: "You are invited to a meeting",
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>You have been invited to a meeting</h2>
                    <p>Hello ${memberName},</p>
                    <p>
                        <strong>${hostName}</strong> has invited you
                        to a meeting.
                    </p>
                    <p>
                        Click the button below to join the meeting:
                    </p>
                    <a
                        href="${meetingLink}"
                        style="
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #007bff;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            font-weight: bold;
                        "
                    >
                        Join Meeting
                    </a>
                    <p>
                        Or copy and paste this link into your browser:
                    </p>
                    <p>
                        ${meetingLink}
                    </p>
                    <p>
                        Meeting hosted by:
                        <strong>${hostName}</strong>
                    </p>
                    <p>
                        Host email:
                        ${hostEmail}
                    </p>
                    <p>
                        See you in the meeting!
                    </p>
                </div>
            `,
        };

        const info =
            await transporter.sendMail(mailOptions);
        console.log(
            `Meeting invitation sent successfully to ${email}`
        );
        console.log("Message ID:", info.messageId);
        return info;
    } catch (error) {
        console.error(
            `Failed to send meeting invitation to ${email}:`,error.message
        );
        throw error;
    }
}
module.exports = {
    sendMeetingInvitation,
};