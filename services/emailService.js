// const fs = require("fs");
// const { Resend } = require("resend");
// const resend = new Resend(process.env.RESEND_API_KEY);

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_PASS,
    },
     connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
});

transporter.verify((err, success) => {
    if (err) {
        console.log("SMTP Error:", err);
    } else {
        console.log("SMTP Ready");
    }
});

async function sendMeetingInvitation(
    email,
    memberName,
    meetingLink,
    hostEmail,
    hostName
) {
    try {
      if (
    !process.env.EMAIL_SMTP_USER ||
    !process.env.EMAIL_PASS ||
    !process.env.EMAIL_FROM
) {
    throw new Error("Email configuration is missing");
}

        if (!email || !meetingLink) {
            throw new Error("Email address and meeting link are required");
        }

        const mailOptions = {
            from: `"Meeting App" <${process.env.EMAIL_FROM}>`,
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
                        Click the button below to join the meeting:
                    </p>

                    <a
                        href="${meetingLink}"
                        style="
                            display:inline-block;
                            padding:12px 24px;
                            background:#007bff;
                            color:#ffffff;
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

        const info = await transporter.sendMail(mailOptions);

        console.log(`Meeting invitation sent successfully to ${email}`);
        console.log("Message ID:", info.messageId);

        return info;

    } catch (error) {
    console.error("Full email error:");
    console.error(error);

    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("Response:", error.response);

    throw error;
}
}

async function sendPdf(
    email,
    memberName,
    pdfPath
) {
    try {
        if (
        !process.env.EMAIL_SMTP_USER ||
        !process.env.EMAIL_PASS ||
        !process.env.EMAIL_FROM
       ) {
        throw new Error("Email configuration is missing");
        }

        if (!email || !pdfPath) {
            throw new Error("Email and PDF path are required");
        }

        const mailOptions = {
            from: `"Meeting App" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: "AI Generated Meeting Minutes PDF",
            html: `
                <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">

                    <h2>Meeting Summary</h2>

                    <p>Hello <strong>${memberName}</strong>,</p>

                    <p>
                        The AI-generated Minutes of Meeting PDF is attached below.
                    </p>

                    <p>
                        Thank you.
                    </p>

                </div>
            `,
            attachments: [
                {
                    filename: "AI-MINUTES-OF-MEETING.pdf",
                    path: pdfPath,
                },
            ],
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`PDF sent successfully to ${email}`);
        console.log("Message ID:", info.messageId);

        return info;

    } catch (error) {
        console.error(
            `Failed to send PDF to ${email}:`,
            error.message
        );

        throw error;
    }
}


module.exports = {
    sendMeetingInvitation,sendPdf
};