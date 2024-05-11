const express = require('express');
const authController = require('../controllers/authController');
const cors = require('cors');

const app = express(); // Express 애플리케이션 인스턴스 생성 먼저
app.use(cors()); // 그 다음 CORS 미들웨어 사용
// const router = express.Router()


app.use('/', authController);



module.exports = app;