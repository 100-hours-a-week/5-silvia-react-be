const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;
const helmet = require('helmet');

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  credentials: true, // to support cookies
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

const authentication = require('./routes/auth');
const post = require('./routes/post');


app.use(authentication);
app.use(post);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.use(express.urlencoded({ extended: true }))