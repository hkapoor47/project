const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({
            message: "No token provided"
        });
    }
    let token = authHeader;
    if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }
    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        console.log("Decoded User:", decoded);
        req.user = decoded;
        next();

    } catch (error) {
        console.error(
            "JWT Error:",
            error.message
        );
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

module.exports = auth;