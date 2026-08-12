const express = require("express");

const {
    handleGeneratePdf
} = require("../controller/pdfController");

const {
    sharePdfEmail
} = require("../controller/meetingController");

const router = express.Router();

router.post("/generate", handleGeneratePdf);

router.post("/:meetingId/share", sharePdfEmail);

module.exports = router;