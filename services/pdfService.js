const { generatePdf } = require("../services/pdfService");
const Meeting = require("../models/meeting");


async function handleGeneratePdf(req,res){

    try{

        const { meetingId, geminiResponse } = req.body;


        const pdf = await generatePdf(geminiResponse);


        const meeting = await Meeting.findOne({
            meetingId
        });


        if(!meeting){
            return res.status(404).json({
                message:"Meeting not found"
            });
        }


        meeting.pdfUrl = pdf.filePath;

        await meeting.save();


        res.json({
            message:"PDF generated successfully",
            pdfPath: pdf.filePath
        });


    }catch(error){

        console.log(error);

        res.status(500).json({
            message:"PDF generation failed",
            error:error.message
        });
    }
}


module.exports={
    handleGeneratePdf
}