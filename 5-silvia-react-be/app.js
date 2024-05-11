const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors({
  origin: 'http://localhost:3000', // 요청을 허용할 출처 명시
  credentials: true // 인증 정보를 포함한 요청 허용
}));

const authentication = require('./routes/auth');
const post = require('./routes/post');


app.use(authentication);
app.use(post);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
