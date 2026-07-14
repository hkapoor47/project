const express = require("express");
const router = express.Router();

router.post("/start", async (req, res) => {

    res.json({
        message: "Speech API working"
    });

});
module.exports = router;