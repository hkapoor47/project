const PDFDocument = require("pdfkit");
const fs = require("fs");

function generateTranscriptPDF(transcript, filePath) {
    return new Promise((resolve, reject) => {

        // Create a new PDF document
        const doc = new PDFDocument();

        // Create a write stream for the PDF file
        const stream = fs.createWriteStream(filePath);

        // Connect PDF document to file
        doc.pipe(stream);

        // PDF Title
        doc
            .fontSize(22)
            .text("Meeting Transcript", {
                align: "center"
            });

        // Space after title
        doc.moveDown();

        // Date and Time
        doc
            .fontSize(10)
            .text(
                `Generated on: ${new Date().toLocaleString()}`
            );

        doc.moveDown();

        // Transcript heading
        doc
            .fontSize(16)
            .text("Transcript");

        doc.moveDown();

        // Actual transcript
        doc
            .fontSize(12)
            .text(transcript, {
                align: "left"
            });

        // Finish PDF
        doc.end();

        // PDF successfully created
        stream.on("finish", () => {
            resolve(filePath);
        });

        // Error while creating PDF
        stream.on("error", (error) => {
            reject(error);
        });
    });
}

module.exports = {
    generateTranscriptPDF
};