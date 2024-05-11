const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const router = express.Router();
const accountsFilePath = path.join(__dirname, '../models/accounts.json');

// Middleware settings
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(bodyParser.json());
router.use(cookieParser());

// CORS settings
router.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

// Session settings
router.use(session({
    secret: 'password486',
    resave: false,
    saveUninitialized: true,
    cookie: {
        sameSite: 'None',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60
    }
}));

// Fetch account information
router.get('/api/accounts', (req, res) => {
    fs.readFile(accountsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            res.json(accounts);
        } catch (error) {
            res.status(500).send('File parsing error');
        }
    });
});

// Register a new user
router.post('/api/register', (req, res) => {
    const { nickname, email, password } = req.body;

    if (!nickname || !email || !password) {
        return res.status(400).send('All fields are required');
    }

    fs.readFile(accountsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            const isDuplicate = accounts.users.some(user => user.email === email);

            if (isDuplicate) {
                return res.status(409).send('Duplicate email');
            }

            accounts.users.push({ nickname, email, password });

            fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error saving user');
                }
                res.status(201).send('User registered successfully');
            });
        } catch (error) {
            res.status(500).send('File parsing error');
        }
    });
});

// Login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Received email:', email);
        console.log('Received password:', password);

        axios.get('http://localhost:3001/api/accounts')
            .then(response => {
                const users = response.data.users;

                let foundUser = null;
                users.forEach(user => {
                    if (user.email === email && user.password === password) {
                        foundUser = user;
                    }
                });

                if (foundUser) {
                    const token = 'some-generated-token';

                    res.cookie('isLogined', true, {
                        httpOnly: false,
                        secure: false, // process.env.NODE_ENV === 'production',
                        sameSite: 'None'
                    });

                    res.cookie('userNickname', foundUser.nickname, {
                        httpOnly: false,
                        secure: false, // process.env.NODE_ENV === 'production',
                        sameSite: 'None'
                    });

                    return res.status(200).send('Login successful');
                } else {
                    console.log('Invalid credentials provided');
                    return res.status(401).send('Invalid credentials');
                }
            })
            .catch(error => {
                console.error('Server error:', error);
                return res.status(500).send('Internal Server Error');
            });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).send('Internal Server Error');
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('isLogined', {
        httpOnly: false,
        secure: false, // process.env.NODE_ENV === 'production',
        sameSite: 'None'
    });
    res.clearCookie('userNickname', {
        httpOnly: false, // Should be accessible via JavaScript
        secure: false, // process.env.NODE_ENV === 'production',
        sameSite: 'None'
    });
    res.status(200).send('Logout successful');
});

module.exports = router;
