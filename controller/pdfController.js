const {
    generatePdf
} =require("../services/pdfService");


async function handleGeneratePdf(req, res) {
    try {
        console.log("Generate PDF API hit");
        const { geminiResponse } = req.body;
        
        if (!geminiResponse) {
            return res.status(400).json({
                message: "Gemini response is required"
            });
        }
        console.log("Gemini response received:");
        console.log(geminiResponse)
     
        const pdf = await generatePdf(geminiResponse);
        console.log("PDF generated:", pdf.filePath);
       
        return res.download(
            pdf.filePath,
            pdf.fileName,
            (error) => {
                if (error) {
                    console.error("Error downloading PDF:", error);
                }
            }
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