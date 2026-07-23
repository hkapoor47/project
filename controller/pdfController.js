const path = require("path");
const fs = require("fs");

const {
    generateTranscriptPDF
} = require("../services/pdfService");


async function generatePDF(req, res) {
    try {

        // Get transcript from request body
        const { transcript } = req.body;

        // Check if transcript exists
        if (!transcript) {
            return res.status(400).json({
                message: "Transcript is required"
            });
        }

        // Make sure generated folder exists
        const generatedFolder = path.join(
            __dirname,
            "../generated"
        );

        if (!fs.existsSync(generatedFolder)) {
            fs.mkdirSync(generatedFolder, {
                recursive: true
            });
        }

        // Create unique PDF file name
        const fileName = `transcript-${Date.now()}.pdf`;

        // Complete path of PDF
        const filePath = path.join(
            generatedFolder,
            fileName
        );

        console.log("Generating PDF...");
        console.log("File path:", filePath);

        // Generate PDF
        await generateTranscriptPDF(
            transcript,
            filePath
        );

        console.log("PDF generated successfully");

        // Send PDF to frontend
        res.download(
            filePath,
            fileName,
            (error) => {

                if (error) {
                    console.error(
                        "Error sending PDF:",
                        error
                    );

                    // Avoid sending another response
                    if (!res.headersSent) {
                        res.status(500).json({
                            message:
                                "Error downloading PDF"
                        });
                    }

                    return;
                }

                // Delete PDF after sending
                fs.unlink(
                    filePath,
                    (deleteError) => {

                        if (deleteError) {
                            console.error(
                                "Error deleting PDF:",
                                deleteError
                            );
                        } else {
                            console.log(
                                "Temporary PDF deleted"
                            );
                        }
                    }
                );
            }
        );

    } catch (error) {

        console.error(
            "PDF generation error:",
            error
        );

        return res.status(500).json({
            message: "Failed to generate PDF",
            error: error.message
        });
    }
}


module.exports = {
    generatePDF
};