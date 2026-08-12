// const fs = require("fs");
// const { Resend } = require("resend");
// const resend = new Resend(process.env.RESEND_API_KEY);

// const dns = require("dns");
// dns.setDefaultResultOrder("ipv4first");

// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: Number(process.env.EMAIL_PORT),
//     secure: false,
//     auth: {
//         user: process.env.EMAIL_SMTP_USER,
//         pass: process.env.EMAIL_PASS,
//     },
//      connectionTimeout: 30000,
//     greetingTimeout: 30000,
//     socketTimeout: 30000,
// });

// transporter.verify((err, success) => {
//     if (err) {
//         console.log("SMTP Error:", err);
//     } else {
//         console.log("SMTP Ready");
//     }
// });
const fs = require("fs");
const axios = require("axios");


async function sendPasswordResetOtp(email, otp) {
    try {
        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Meeting App",
                    email: process.env.EMAIL_FROM
                },

                to: [
                    {
                        email: email
                    }
                ],

                subject: "Password Reset OTP",
                htmlContent: `
                    <h2>Password Reset</h2>
                    <p>You requested to reset your password.</p>
                    <p>Your OTP is:</p>
                    <h1>${otp}</h1>
                    <p>This OTP will expire in <b>10 minutes</b>.</p>
                    <p>If you did not request a password reset, please ignore this email.</p>
                `
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Password reset OTP sent:", response.data);
        return response.data;

    } catch (err) {
        console.error(
            err.response?.data || err.message
        );
        throw err;
    }
}


async function sendMeetingInvitation(
    email,
    memberName,
    meetingLink,
    hostEmail,
    hostName
) {
    try {

        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Meeting App",
                    email: process.env.EMAIL_FROM
                },

                to: [
                    {
                        email,
                        name: memberName
                    }
                ],

                replyTo: {
                    email: hostEmail,
                    name: hostName
                },

                subject: `${hostName} has started the meeting`,

                htmlContent: `
                    <h2>Your meeting has started</h2>

                    <p>Hello <b>${memberName}</b></p>

                    <p>${hostName} has started the meeting.</p>

                    <a href="${meetingLink}">
                        Join Meeting
                    </a>
                `
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Invitation sent:", response.data);
        return response.data;

    } catch (err) {
        console.error(err.response?.data || err.message);
        throw err;
    }
}


async function sendPdf(email, memberName, pdfPath) {

    try {

        const pdf = fs.readFileSync(pdfPath).toString("base64");

        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Meeting App",
                    email: process.env.EMAIL_FROM
                },

                to: [
                    {
                        email,
                        name: memberName
                    }
                ],

                subject: "AI Generated Meeting Minutes",

                htmlContent:
                    "<h2>Please find the attached PDF.</h2>",

                attachment: [
                    {
                        name: "AI-MINUTES-OF-MEETING.pdf",
                        content: pdf
                    }
                ]
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log(response.data);
        return response.data;

    } catch (err) {
        console.error(err.response?.data || err.message);
        throw err;
    }
}

module.exports = {
    sendPasswordResetOtp,
    sendMeetingInvitation,
    sendPdf
};