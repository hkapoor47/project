const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

async function generatePdf(geminiResponse) {
    return new Promise((resolve, reject) => {
        try {
            const generatedFolder = path.join(__dirname, "../generated");
            if (!fs.existsSync(generatedFolder)) {
                fs.mkdirSync(generatedFolder, { recursive: true });
            }

            const fileName = `AI_MINUTES_OF_MEETING-${Date.now()}.pdf`;
            const filePath = path.join(generatedFolder, fileName);
            const doc = new PDFDocument({
                margin: 50
            });

           
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            doc
                .fontSize(24)
                .text("AI MINUTES OF MEETING", {
                    align: "center"
                });
            doc.moveDown();
            doc
                .moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke();

            doc.moveDown();

            if (typeof geminiResponse === "string") {
                doc
                    .fontSize(12)
                    .text(geminiResponse, {
                        align: "left"
                    });
            } else {
                Object.entries(geminiResponse).forEach(([key, value]) => {
                    doc
                        .fontSize(16)
                        .text(formatTitle(key), {
                            underline: true
                        });
                    doc.moveDown(0.5);

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

            doc.end();

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

function formatTitle(text) {
    return text
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (char) => char.toUpperCase());
}

module.exports = {
    generatePdf
};