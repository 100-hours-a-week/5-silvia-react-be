const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');


const router = express.Router();
const accountsFilePath = path.join(__dirname, '../models/accounts.json');
const postsFilePath = path.join(__dirname, '../models/posts.json');

// Helper function to read JSON file and parse it
const readJsonFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject(`Error reading file: ${filePath}, Error: ${err.message}`);
            }
            try {
                const parsedData = JSON.parse(data);
                resolve(parsedData);
            } catch (parseError) {
                reject(`Error parsing JSON file: ${filePath}, Error: ${parseError.message}, Data: ${data}`);
            }
        });
    });
};


// Helper function to write JSON data to file
const writeJsonFile = (filePath, data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                return reject(`Error writing file: ${filePath}, Error: ${err.message}`);
            }
            resolve();
        });
    });
};


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



// Fetch account information
router.get('/api/accounts', (req, res) => {
    fs.readFile(accountsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading accounts file:', err);
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            res.json(accounts);
        } catch (error) {
            console.error('Error parsing accounts file:', error.message, '\nFile content:', data);
            res.status(500).send('File parsing error');
        }
    });
});
// Fetch account information by userId
router.get('/api/accounts/:userId', (req, res) => {
    const userId = req.params.userId;
    fs.readFile(accountsFilePath, (err, data) => {
        if (err) {
            console.error('Error reading accounts file:', err);
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            const user = accounts.users.find(user => user.userId === userId);
            if (!user) {
                return res.status(404).send('User not found');
            }
            res.json({ user });
        } catch (error) {
            console.error('Error parsing accounts file:', error, data.toString());
            res.status(500).send('File parsing error');
        }
    });
});

// Delete an account by userId and associated posts
router.delete('/api/accounts/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        // Read and parse accounts data
        console.log(`Reading accounts from ${accountsFilePath}`);
        const accounts = await readJsonFile(accountsFilePath);

        if (!accounts || !Array.isArray(accounts.users)) {
            console.error('Invalid accounts data format');
            return res.status(500).send('Invalid accounts data format');
        }

        const userIndex = accounts.users.findIndex(user => user.userId === userId);

        if (userIndex === -1) {
            console.log(`User with userId ${userId} not found`);
            return res.status(404).send('User not found');
        }

        // Remove user from accounts
        console.log(`Removing user with userId ${userId}`);
        accounts.users.splice(userIndex, 1);
        await writeJsonFile(accountsFilePath, accounts);

        // Read and parse posts data
        console.log(`Reading posts from ${postsFilePath}`);
        const posts = await readJsonFile(postsFilePath);

        if (typeof posts !== 'object' || posts === null) {
            console.error('Posts data is not a valid object');
            return res.status(500).send('Posts data is not a valid object');
        }

        // Remove posts associated with the user
        console.log(`Removing posts associated with userId ${userId}`);
        for (const postId in posts) {
            if (posts[postId].authorId === userId) {
                delete posts[postId];
            }
        }

        await writeJsonFile(postsFilePath, posts);

        // Clear cookies after deleting user
        res.clearCookie('isLogined', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None'
        });

        res.clearCookie('userId', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None'
        });

        console.log(`User and associated posts deleted successfully for userId ${userId}`);
        res.status(200).send('User and associated posts deleted successfully');
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send(error.message);
    }
});



// Update nickname
router.put('/api/accounts/:userId/nickname', (req, res) => {
    const userId = req.params.userId;
    const { nickname } = req.body;

    if (!nickname) {
        return res.status(400).send('Nickname is required');
    }

    fs.readFile(accountsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            const userIndex = accounts.users.findIndex(user => user.userId === userId);

            if (userIndex === -1) {
                return res.status(404).send('User not found');
            }

            const isNicknameTaken = accounts.users.some(user => user.nickname === nickname && user.userId !== userId);
            if (isNicknameTaken) {
                return res.status(409).send('중복된 닉네임입니다.');
            }

            accounts.users[userIndex].nickname = nickname;
            fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Server error');
                }
                res.status(200).send('닉네임이 변경되었습니다.');
            });
        } catch (error) {
            res.status(500).send('File parsing error');
        }
    });
});

// Update password
router.put('/api/accounts/:userId/password', (req, res) => {
    const userId = req.params.userId;
    const { password } = req.body;

    if (!password) {
        return res.status(400).send('Password is required');
    }

    fs.readFile(accountsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        try {
            const accounts = JSON.parse(data);
            const userIndex = accounts.users.findIndex(user => user.userId === userId);

            if (userIndex === -1) {
                return res.status(404).send('User not found');
            }

            accounts.users[userIndex].password = password; // Update the password
            fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Server error');
                }
                res.status(200).send('Password updated successfully');
            });
        } catch (error) {
            res.status(500).send('File parsing error');
        }
    });
});

// Register a new user
// router.post('/api/register', (req, res) => {
//     const { nickname, email, password, profileimg: profileImageUrl  } = req.body;
//
//     if (!nickname || !email || !password || !profileimg) {
//         return res.status(400).send('All fields are required');
//     }
//
//     fs.readFile(accountsFilePath, (err, data) => {
//         if (err) {
//             return res.status(500).send('Server error');
//         }
//         try {
//             const accounts = JSON.parse(data);
//             const isDuplicate = accounts.users.some(user => user.email === email);
//
//             if (isDuplicate) {
//                 return res.status(409).send('Duplicate email');
//             }
//
//             // Determine the highest current userId
//             let maxUserId = 0;
//             accounts.users.forEach(user => {
//                 if (user.userId) {
//                     const userId = parseInt(user.userId, 10);
//                     if (userId > maxUserId) {
//                         maxUserId = userId;
//                     }
//                 }
//             });
//
//             // Assign new userId
//             const newUserId = maxUserId + 1;
//
//             accounts.users.push({
//                 userId: newUserId.toString(),
//                 nickname,
//                 email,
//                 password,
//                 profileimg // Use the profile image URL provided by the user
//             });
//
//             fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2), (err) => {
//                 if (err) {
//                     return res.status(500).send('Error saving user');
//                 }
//                 res.status(201).send('User registered successfully');
//             });
//         } catch (error) {
//             res.status(500).send('File parsing error');
//         }
//     });
// });

router.post('/api/register', upload.single('profileimg'), (req, res) => {
    const { nickname, email, password } = req.body;
    const profileImageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : '';

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

            let maxUserId = 0;
            accounts.users.forEach(user => {
                if (user.userId) {
                    const userId = parseInt(user.userId, 10);
                    if (userId > maxUserId) {
                        maxUserId = userId;
                    }
                }
            });

            const newUserId = maxUserId + 1;

            accounts.users.push({
                userId: newUserId.toString(),
                nickname,
                email,
                password,
                profileimg: profileImageUrl
            });

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


// 회원가입할때 이미지...
// router.post('/api/register/profileimg', upload.single('profileimg'), (req, res) => {
//     if (req.file) {
//         const profileimg = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
//
//         fs.readFile(accountsFilePath, 'utf8', (err, data) => {
//             if (err) {
//                 console.error('Error reading accounts file:', err);
//                 return res.status(500).send('Server error');
//             }
//             try {
//                 const accounts = JSON.parse(data);
//                 const user = accounts.users.find(user => user.userId === req.params.userId);
//                 if (!user) {
//                     return res.status(404).send('User not found');
//                 }
//
//                 // Update the user's image URL in the dummy data
//                 user.profileimg = profileimg;
//
//                 // Write the updated accounts back to the file
//                 fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2), 'utf8', (err) => {
//                     if (err) {
//                         console.error('Error writing to accounts file:', err);
//                         return res.status(500).send('Server error during file write');
//                     }
//                     res.json({ profileimg: profileimg });
//                 });
//
//             } catch (error) {
//                 console.error('Error parsing accounts file:', error, data.toString());
//                 res.status(500).send('File parsing error');
//             }
//         });
//
//     } else {
//         res.status(400).send('No file uploaded');
//     }
// });

// Login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        axios.get('http://localhost:3001/api/accounts')
            .then(response => {
                const users = response.data.users;

                if (!users || !Array.isArray(users)) {
                    console.error('No users found or data is not an array');
                    return res.status(500).send('Internal Server Error: User data is not available or incorrect format');
                }

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
                        secure: false,
                        sameSite: 'Strict',
                        maxAge: 1000 * 60 * 60 // 1 hour
                    });

                    res.cookie('userId', foundUser.userId, {
                        httpOnly: false,
                        secure: false,
                        sameSite: 'Strict',
                        maxAge: 1000 * 60 * 60 // 1 hour
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


// Route to upload a profile image
router.post('/api/accounts/:userId/profileimg', upload.single('profileimg'), (req, res) => {
    if (req.file) {
        const profileimg = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        fs.readFile(accountsFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading accounts file:', err);
                return res.status(500).send('Server error');
            }
            try {
                const accounts = JSON.parse(data);
                const user = accounts.users.find(user => user.userId === req.params.userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Update the user's image URL in the dummy data
                user.profileimg = profileimg;

                // Write the updated accounts back to the file

            } catch (error) {
                console.error('Error parsing accounts file:', error, data.toString());
                res.status(500).send('File parsing error');
            }
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
