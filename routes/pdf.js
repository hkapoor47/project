const express = require("express");

const {
    handleGeneratePdf
} = require("../controller/pdfController");

const router = express.Router();


// Generate PDF from Gemini response
router.post(
    "/generate",
    handleGeneratePdf
);


module.exports = router;