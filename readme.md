# AI Meeting Assistant

An AI-powered meeting application built with Node.js, Express.js, MongoDB, Agora, Socket.IO, Google Gemini, and PDF generation.

The application allows users to create and join online meetings, communicate through real-time audio, generate live transcripts, process meeting content using Google Gemini LLM, and generate a downloadable PDF summary.

---

## Features

### Authentication
- User Registration
- User Login
- Password Hashing using bcrypt
- JWT-based Authentication
- Protected API Routes

### Meeting Management
- Create Meetings
- Add Multiple Members to a Meeting
- Generate Unique Meeting IDs using UUID
- Generate Shareable Meeting Links
- Start Meetings
- Host Verification
- Meeting Status Management
  - Scheduled
  - Active
  - Ended
- Allow Host and Invited Members to Join Meetings

### Real-Time Audio Meetings
- Agora RTC integration
- Secure Agora Token Generation
- Unique Agora Channel for each meeting
- Real-time audio communication
- Unique UID generation for meeting participants

### Speech-to-Text
- Real-time meeting transcription
- Agora Speech-to-Text integration
- Capture spoken content during meetings
- Store meeting transcripts

### Real-Time Communication
- Socket.IO integration
- Real-time transcript updates
- Broadcast transcript data to connected meeting participants

### AI Meeting Summary
- Google Gemini LLM integration
- Process meeting transcript using AI
- Generate intelligent meeting summaries
- Extract important discussion points and information

### PDF Generation
- Generate PDF from Gemini AI-generated meeting summary
- Download meeting summary as a PDF
- Store generated PDF information
- Useful for maintaining meeting records

---

## Tech Stack

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Authentication
- JWT (JSON Web Token)
- bcrypt

### Meeting & Real-Time Audio
- Agora RTC
- Agora Token Builder

### Speech-to-Text
- Agora Speech-to-Text

### Real-Time Communication
- Socket.IO

### AI / LLM
- Google Gemini API
- Google GenAI

### PDF
- PDF Generation using Node.js

### Other Technologies
- UUID
- Nodemailer
- Axios
- dotenv
- CORS

---

## Project Flow

```text
User Registration / Login
          ↓
JWT Authentication
          ↓
Host Creates Meeting
          ↓
Generate Unique Meeting ID
          ↓
Generate Meeting Link
          ↓
Host Starts Meeting
          ↓
Share Meeting Link with Members
          ↓
Host & Invited Members Join
          ↓
Agora Audio Meeting
          ↓
Speech-to-Text
          ↓
Live Transcript
          ↓
Gemini LLM Processing
          ↓
AI-Generated Meeting Summary
          ↓
Generate PDF
          ↓
Download / Save Meeting Summary
