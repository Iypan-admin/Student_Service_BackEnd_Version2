const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: 'Access denied, invalid token format' });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        if (!decoded.student_id || !decoded.center || !decoded.state) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        req.student = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
