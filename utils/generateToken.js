const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (student_id, center, state) => {
    return jwt.sign({ student_id, center, state }, process.env.SECRET_KEY, { expiresIn: '7d' });
};

module.exports = generateToken;
