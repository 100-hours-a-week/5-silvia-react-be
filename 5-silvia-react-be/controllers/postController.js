const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const postController = express.Router();
const cookieParser = require('cookie-parser');
const multer = require("multer");
const cors = require('cors');
const helmet = require('helmet');
const db = require('../db');  // db.js 파일을 불러옴

postController.use('/uploads', express.static('uploads'));
postController.use(cookieParser());
postController.use(helmet());
postController.use(bodyParser.json());
postController.use(express.urlencoded({ extended: true }));

// Function to format the date as 'YYYY-MM-DD HH:MM:SS'
const formatDate = (date) => {
    const pad = (n) => (n < 10 ? '0' + n : n);

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

postController.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
postController.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// 게시물 api
postController.get('/api/posts', async (req, res) => {
    try {
        db.query('SELECT * FROM community_post', (err, results) => {
            if (err) {
                console.error('Database query error:', err);
                res.status(500).send('Error querying the database');
                return;
            }
            res.json(results);
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send(error);
    }
});

// 게시물 id별 api
postController.get('/api/posts/:postId', (req, res) => {
    const postId = req.params.postId;
    const query = 'SELECT * FROM community_post WHERE id = ?';

    db.query(query, [postId], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }
        if (results.length === 0) {
            return res.status(404).send('Post not found');
        }
        res.json(results[0]);
    });
});

// 댓글 api
postController.get('/api/posts/:postId/comments', async (req, res) => {
    const postId = req.params.postId;
    try {
        db.query('SELECT * FROM comments WHERE postId = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            res.json(results);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시글 삭제
postController.delete('/api/posts/:postId', async (req, res) => {
    const postId = req.params.postId;
    try {
        const userIdCookie = req.cookies.userId;

        db.query('SELECT user_id FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('포스트를 찾을 수 없음');
                return;
            }
            const authorId = results[0].user_id;
            if (userIdCookie !== authorId.toString()) {
                res.status(403).send('게시글 삭제 권한이 없습니다.');
                return;
            }
            db.query('DELETE FROM community_post WHERE id = ?', [postId], (err) => {
                if (err) {
                    res.status(500).send('Error deleting the post');
                    return;
                }
                res.status(200).send('게시글이 삭제되었습니다.');
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시글 수정 권한 확인
postController.get('/api/posts/:postId/checkEditPermission', async (req, res) => {
    const postId = req.params.postId;
    try {
        const userIdCookie = req.cookies.userId;

        db.query('SELECT user_id FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('포스트를 찾을 수 없음');
                return;
            }
            const authorId = results[0].user_id;
            if (userIdCookie !== authorId.toString()) {
                res.status(403).send('수정 권한이 없습니다.');
                return;
            }
            res.status(200).send('수정 권한이 있습니다.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시글 수정
postController.put('/api/posts/:postId', upload.single('postImage'), async (req, res) => {
    const postId = req.params.postId;
    const { postTitle, postContents } = req.body;
    let postImage;

    if (req.file) {
        postImage = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    try {
        const userIdCookie = req.cookies.userId;

        db.query('SELECT user_id FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('포스트를 찾을 수 없음');
                return;
            }
            const authorId = results[0].user_id;
            if (userIdCookie !== authorId.toString()) {
                res.status(403).send('게시글 수정 권한이 없습니다.');
                return;
            }

            // Update post fields
            const updateQuery = 'UPDATE community_post SET title = ?, article = ?, post_picture = ? WHERE id = ?';
            const updateValues = [postTitle || results[0].title, postContents || results[0].article, postImage || results[0].post_picture, postId];

            db.query(updateQuery, updateValues, (err) => {
                if (err) {
                    res.status(500).send('Error updating the post');
                    return;
                }
                res.status(200).send('게시글이 업데이트되었습니다.');
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시글 작성
postController.post('/api/posts', async (req, res) => {
    const { postTitle, postContents, postImage } = req.body;
    const authorId = req.cookies.userId;

    if (!authorId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    try {
        const newPost = {
            title: postTitle,
            article: postContents,
            post_picture: postImage,
            user_id: authorId,
            create_dt: formatDate(new Date()), // Use the formatDate function here
            views: 0,
            likes: 0,
        };

        db.query('INSERT INTO community_post SET ?', newPost, (err) => {
            if (err) {
                res.status(500).send('Error creating the post');
                return;
            }
            res.status(201).send('게시글이 생성되었습니다.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('게시글 생성 중 오류가 발생했습니다.');
    }
});

postController.post('/api/posts/image', upload.single('postImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    try {
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ postImage: imageUrl });
    } catch (error) {
        console.error('Error handling the file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 게시글 수정
postController.patch('/api/posts/:postId', async (req, res) => {
    const { postId } = req.params;
    const { postTitle, postContents, postImage } = req.body;
    const authorId = req.cookies.userId;

    if (!authorId) {
        return res.status(401).send('로그인이 필요합니다.');
    }

    try {
        db.query('SELECT user_id FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('게시글을 찾을 수 없습니다.');
                return;
            }

            if (results[0].user_id !== authorId) {
                res.status(403).send('수정 권한이 없습니다.');
                return;
            }

            // 게시글 업데이트: 제공된 필드만 업데이트
            const updateQuery = 'UPDATE community_post SET title = ?, article = ?, post_picture = ? WHERE id = ?';
            const updateValues = [postTitle || results[0].title, postContents || results[0].article, postImage || results[0].post_picture, postId];

            db.query(updateQuery, updateValues, (err) => {
                if (err) {
                    res.status(500).send('게시글 수정 중 오류가 발생했습니다.');
                    return;
                }
                res.status(200).send('게시글이 수정되었습니다.');
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('게시글 수정 중 오류가 발생했습니다.');
    }
});

// session api
postController.get('/session', (req, res, next) => {
    const now = Date.now();

    if (!req.session.lastVisit || now - req.session.lastVisit > 1000) {
        if (req.session.views) {
            req.session.views++;
        } else {
            req.session.views = 1;
        }
        req.session.lastVisit = now;
    }

    // Logging to help debug multiple requests
    console.log('Session ID:', req.sessionID);
    console.log('Views:', req.session.views);
    console.log('Request URL:', req.url);

    res.write('<p>No. of views: ' + req.session.views + '</p>');
    res.end();
});

//조회수
postController.put('/api/posts/:postId/views', async (req, res) => {
    const postId = req.params.postId;

    try {
        db.query('SELECT views FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('포스트를 찾을 수 없음');
                return;
            }

            const newViews = results[0].views + 1;

            db.query('UPDATE community_post SET views = ? WHERE id = ?', [newViews, postId], (err) => {
                if (err) {
                    res.status(500).send('Error updating views');
                    return;
                }
                res.status(200).json({ views: newViews });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 댓글 api
postController.get('/api/posts/:postId/comments/:commentId', (req, res) => {
    const postId = req.params.postId;
    const commentId = req.params.commentId;

    const query = 'SELECT * FROM comments WHERE postId = ? AND commentId = ?';

    db.query(query, [postId, commentId], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }
        if (results.length === 0) {
            return res.status(404).send('댓글을 찾을 수 없음');
        }
        res.json(results[0]);
    });
});

// 댓글 수정
postController.put('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = parseInt(req.params.commentId, 10);
    const { commentText } = req.body;
    try {
        db.query('UPDATE comments SET commentText = ? WHERE postId = ? AND commentId = ?', [commentText, postId, commentId], (err, results) => {
            if (err) {
                res.status(500).send('댓글 수정 중 오류가 발생했습니다.');
                return;
            }
            res.json({ commentText });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 댓글 삭제
postController.delete('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = parseInt(req.params.commentId, 10);
    try {
        db.query('DELETE FROM comments WHERE postId = ? AND commentId = ?', [postId, commentId], (err) => {
            if (err) {
                res.status(500).send('댓글 삭제 중 오류가 발생했습니다.');
                return;
            }
            res.status(200).send('댓글이 삭제되었습니다.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 댓글 작성
postController.post('/api/posts/:postId/comments', async (req, res) => {
    const postId = req.params.postId;
    const { commentText, commenterId } = req.body;
    try {
        const newComment = {
            postId,
            commentText,
            commenterId,
            commentDate: formatDate(new Date())
        };

        db.query('INSERT INTO comments SET ?', newComment, (err) => {
            if (err) {
                res.status(500).send('댓글 작성 중 오류가 발생했습니다.');
                return;
            }
            res.status(201).json(newComment);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

module.exports = postController;
