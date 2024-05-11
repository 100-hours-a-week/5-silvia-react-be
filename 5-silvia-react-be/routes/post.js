const express = require('express');
const { Router } = require('express');
const postController = require('../controllers/postController');

const app = Router();

app.use('/', postController);

module.exports = app;