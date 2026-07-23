const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

async function generatePdf(geminiResponse) {
    return new Promise((resolve, reject) => {
        try {
            // Make sure generated folder exists
            const generatedFolder = path.join(__dirname, "../generated");

            if (!fs.existsSync(generatedFolder)) {
                fs.mkdirSync(generatedFolder, { recursive: true });
            }

            // Create unique file name
            const fileName = `AI MINUTES OF MEETING-${Date.now()}.pdf`;

            const filePath = path.join(generatedFolder, fileName);

            // Create PDF document
            const doc = new PDFDocument({
                margin: 50
            });

            // Create write stream
            const stream = fs.createWriteStream(filePath);

            // Pipe PDF into file
            doc.pipe(stream);

            // PDF Title
            doc
                .fontSize(24)
                .text("AI MINUTES OF MEETING", {
                    align: "center"
                });

            doc.moveDown();

            // Horizontal line
            doc
                .moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke();

            doc.moveDown();

            // Gemini Response

            if (typeof geminiResponse === "string") {
                doc
                    .fontSize(12)
                    .text(geminiResponse, {
                        align: "left"
                    });
            } else {
                // If Gemini response is an object
                Object.entries(geminiResponse).forEach(([key, value]) => {

                    // Section heading
                    doc
                        .fontSize(16)
                        .text(formatTitle(key), {
                            underline: true
                        });

                    doc.moveDown(0.5);

                    // Section content
                    if (Array.isArray(value)) {

                        value.forEach((item) => {
                            doc
                                .fontSize(12)
                                .text(`• ${item}`);
                        });

                    } else if (typeof value === "object" && value !== null) {

                        doc
                            .fontSize(12)
                            .text(JSON.stringify(value, null, 2));

                    } else {

                        doc
                            .fontSize(12)
                            .text(String(value));

                    }

                    doc.moveDown();
                });
            }

            // Finalize PDF
            doc.end();

            // When PDF is completely written
            stream.on("finish", () => {
                resolve({
                    fileName,
                    filePath
                });
            });

            stream.on("error", (error) => {
                reject(error);
            });

        } catch (error) {
            reject(error);
        }
    });
}


// Convert camelCase or snake_case into readable title
function formatTitle(text) {
    return text
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (char) => char.toUpperCase());
}


module.exports = {
    generatePdf
};