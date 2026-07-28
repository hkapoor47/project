async function handleGetToken(req, res) {
    return res.status(410).json({
        message:
            "This endpoint is no longer used. Use the meeting join API instead."
    });
}

module.exports = {
    handleGetToken
};