const express = require("express");

const {
    handleGeneratePdf
} = require("../controller/pdfController");

const router = express.Router();

router.post(
    "/generate",
    handleGeneratePdf
);


module.exports = router;