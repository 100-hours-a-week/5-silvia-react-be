const express = require('express');
const router = express.Router();
const db = require('../db'); // MySQL 연결 설정 파일
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Setup storage engine
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Middleware settings
router.use('/uploads', express.static('uploads'));
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(require('body-parser').json());
router.use(require('cookie-parser')());
router.use(require('cors')({
    origin: 'http://localhost:3000',
    credentials: true
}));
router.use(require('express-session')({
    secret: 'password486',
    resave: false,
    saveUninitialized: true,
    cookie: {
        sameSite: 'Strict',
        secure: false,
        maxAge: 1000 * 60 * 60
    }
}));

// 계정 api
router.get('/api/accounts', async (req, res) => {
    try {
        db.query('SELECT * FROM community_user', (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).send('Error fetching users.');
            }
            res.status(200).json({ users: results });
        });
    } catch (error) {
        console.error('Error in /api/accounts:', error);
        res.status(500).send('Internal server error');
    }
});

// 댓글 api
router.get('/api/comments', (req, res) => {
    db.query('SELECT * FROM post_comment', (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Server error');
        }
        res.json({ users: results });
    });
});


// Fetch account information by userId
router.get('/api/accounts/:userId', (req, res) => {
    const userId = req.params.userId;
    db.query('SELECT * FROM community_user WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Server error');
        }
        if (results.length === 0) {
            return res.status(404).send('User not found');
        }
        res.json({ user: results[0] });
    });
});

// Delete an account by userId and associated posts
router.delete('/api/accounts/:userId', (req, res) => {
    const userId = req.params.userId;

    db.query('DELETE FROM community_user WHERE user_id = ?', [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).send('Server error');
        }
        db.query('DELETE FROM community_post WHERE user_id = ?', [userId], (err, result) => {
            if (err) {
                console.error('Error deleting posts:', err);
                return res.status(500).send('Server error');
            }
            res.clearCookie('isLogined');
            res.clearCookie('userId');
            res.status(200).send('User and associated posts deleted successfully');
        });
    });
});

// Update nickname
router.put('/api/accounts/:userId/nickname', (req, res) => {
    const userId = req.params.userId;
    const { nickname } = req.body;

    if (!nickname) {
        return res.status(400).send('Nickname is required');
    }

    db.query('UPDATE community_user SET nickname = ? WHERE user_id = ?', [nickname, userId], (err, result) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        res.status(200).send('Nickname updated successfully');
    });
});

// Update password
router.put('/api/accounts/:userId/password', (req, res) => {
    const userId = req.params.userId;
    const { password } = req.body;

    if (!password) {
        return res.status(400).send('Password is required');
    }

    db.query('UPDATE community_user SET password = ? WHERE user_id = ?', [password, userId], (err, result) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        res.status(200).send('Password updated successfully');
    });
});

// Register a new user
router.post('/api/register', (req, res) => {
    const { nickname, email, password, profileimg } = req.body;

    if (!nickname || !email || !password) {
        return res.status(400).send('All fields are required');
    }

    db.query('SELECT * FROM community_user WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        if (results.length > 0) {
            return res.status(409).send('Duplicate email');
        }

        db.query('INSERT INTO community_user (nickname, email, password, profile_picture) VALUES (?, ?, ?, ?)', [nickname, email, password, profileimg], (err, result) => {
            if (err) {
                return res.status(500).send('Error saving user');
            }
            res.status(201).send({ message: 'User registered successfully' });
        });
    });
});

// Upload profile image
router.post('/api/register/profileimg', upload.single('profileimg'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    try {
        const profileimg = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ profileimg: profileimg });
    } catch (error) {
        console.error('Error handling the file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM community_user WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Server error');
        }
        if (results.length === 0) {
            return res.status(401).send('Invalid credentials');
        }

        const user = results[0];
        const token = 'some-generated-token';
        const secureCookie = process.env.NODE_ENV === 'production';

        res.cookie('isLogined', true, {
            httpOnly: false,
            secure: secureCookie,
            sameSite: secureCookie ? 'None' : 'Strict',
            maxAge: 1000 * 60 * 60 // 1 hour
        });

        res.cookie('userId', user.user_id, {
            httpOnly: false,
            secure: secureCookie,
            sameSite: secureCookie ? 'None' : 'Strict',
            maxAge: 1000 * 60 * 60 // 1 hour
        });

        res.cookie('nickname', user.nickname, {
            httpOnly: false,
            secure: secureCookie,
            sameSite: secureCookie ? 'None' : 'Strict',
            maxAge: 1000 * 60 * 60 // 1 hour
        });

        res.status(200).json({ success: true, nickname: user.nickname });
    });
});

// Upload profile image for an existing user
router.post('/api/accounts/:userId/profileimg', upload.single('profileimg'), (req, res) => {
    const userId = req.params.userId;

    if (req.file) {
        const profileimg = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        db.query('UPDATE community_user SET profile_picture = ? WHERE user_id = ?', [profileimg, userId], (err, result) => {
            if (err) {
                console.error('Error updating profile image:', err);
                return res.status(500).send('Server error');
            }
            res.status(200).send('Profile image updated successfully');
        });
    } else {
        res.status(400).send('No file uploaded');
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('isLogined', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
        path: '/'
    });
    res.clearCookie('userId', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None',
        path: '/'
    });
    res.status(200).send('Logout successful');
});

module.exports = router;
