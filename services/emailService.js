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
  meetingLink
) {
  await transporter.sendMail({

    from: `"Meeting App" <${process.env.EMAIL_USER}>`,

    to: email,

    subject: "You are invited to a meeting",

    html: `
      <h2>You have been invited to a meeting</h2>

      <p>Hello ${memberName},</p>

      <p>
        You have been invited to join a meeting.
      </p>

      <p>
        Click the button below to join:
      </p>

      <a
        href="${meetingLink}"
        style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        "
      >
        Join Meeting
      </a>

      <p>
        Or copy this link:
      </p>

      <p>
        ${meetingLink}
      </p>
    `,
  });
}


module.exports = {
  sendMeetingInvitation,
};