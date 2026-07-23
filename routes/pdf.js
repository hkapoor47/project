const express = require("express");

const router = express.Router();

const {
    generatePDF
} = require("../controller/pdfController");


// POST /api/pdf/generate
router.post(
    "/generate",
    generatePDF
);


module.exports = router;