const mongoose = require("mongoose");


// ==========================================
// MEMBER SCHEMA
// ==========================================

const memberSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        uid: {
            type: Number,
            default: null,
        },
    },
    {
        _id: false,
    }
);


// ==========================================
// TRANSCRIPT SCHEMA
// ==========================================

const transcriptSchema = new mongoose.Schema(
    {
        uid: {
            type: Number,
            required: true,
        },

        speaker: {
            type: String,
            required: true,
        },

        text: {
            type: String,
            required: true,
        },

        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);


// ==========================================
// MEETING SCHEMA
// ==========================================

const meetingSchema = new mongoose.Schema(
    {
        // ==========================================
        // MEETING ID
        // ==========================================

        meetingId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },


        // ==========================================
        // HOST ID
        // This stores the authenticated user's _id
        // who created the meeting
        // ==========================================

        hostId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },


        // ==========================================
        // MEETING TITLE
        // ==========================================

        title: {
            type: String,
            required: true,
            trim: true,
        },


        // ==========================================
        // MEETING LINK
        // ==========================================

        meetingLink: {
            type: String,
            required: true,
        },


        // ==========================================
        // MEMBERS
        // ==========================================

        members: {
            type: [memberSchema],

            required: true,

            validate: {
                validator: function (members) {
                    return members.length > 0;
                },

                message:
                    "At least one member is required",
            },
        },


        // ==========================================
        // MEETING STATUS
        // ==========================================

        status: {
            type: String,

            enum: [
                "scheduled",
                "active",
                "ended",
            ],

            default: "scheduled",
        },


        // ==========================================
        // TRANSCRIPT
        // ==========================================

        transcript: {
            type: [transcriptSchema],

            default: [],
        },


        // ==========================================
        // GEMINI SUMMARY
        // ==========================================

        summary: {
            type: String,

            default: "",
        },


        // ==========================================
        // GENERATED PDF URL
        // ==========================================

        pdfUrl: {
            type: String,

            default: "",
        },


        // ==========================================
        // MEETING START TIME
        // ==========================================

        startedAt: {
            type: Date,

            default: null,
        },


        // ==========================================
        // MEETING END TIME
        // ==========================================

        endedAt: {
            type: Date,

            default: null,
        },
    },

    {
        timestamps: true,
    }
);


module.exports =
    mongoose.model(
        "Meeting",
        meetingSchema
    );