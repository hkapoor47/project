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
           subject: `${hostName} has started the meeting`,
           html: `
          <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
             <h2>Your meeting has started</h2>

             <p>Hello <strong>${memberName}</strong>,</p>

             <p>
                <strong>${hostName}</strong> has started the meeting.
             </p>

             <p>
                Click the button below to join now:
             </p>

             <a
                href="${meetingLink}"
                style="
                    display:inline-block;
                    padding:12px 24px;
                    background:#007bff;
                    color:white;
                    text-decoration:none;
                    border-radius:5px;
                    font-weight:bold;
                "
             >
                Join Meeting
             </a>

             <p style="margin-top:20px;">
                If the button doesn't work, copy and paste this link into your browser:
             </p>

             <p>
                <a href="${meetingLink}">
                    ${meetingLink}
                 </a>
             </p>

             <hr>

             <p><strong>Host:</strong> ${hostName}</p>
             <p><strong>Email:</strong> ${hostEmail}</p>

             <p>See you in the meeting!</p>
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