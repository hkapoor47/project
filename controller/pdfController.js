const {
    generatePdf
} = require("../services/pdfService");

const Meeting = require("../models/meeting");


async function handleGeneratePdf(req, res) {
    try {
        console.log("Generate PDF API hit");

        const { geminiResponse, meetingId } = req.body;

        if (!geminiResponse) {
            return res.status(400).json({
                message: "Gemini response is required"
            });
        }

        if (!meetingId) {
            return res.status(400).json({
                message: "Meeting ID is required"
            });
        }

        const pdf = await generatePdf(geminiResponse);

        console.log("PDF generated:", pdf.filePath);

        const meeting = await Meeting.findOne({
            meetingId
        });


        if (!meeting) {
            return res.status(404).json({
                message: "Meeting not found"
            });
        }

        meeting.pdfUrl = pdf.filePath;

        await meeting.save();

        return res.download(
            pdf.filePath,
            pdf.fileName
        );


    } catch (error) {
        console.error("PDF generation error:", error);
        return res.status(500).json({
            message: "Failed to generate PDF",
            error: error.message
        });
    }
}


module.exports = {
    handleGeneratePdf
};