const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const multer = require("multer");
const cors = require('cors');
const helmet = require('helmet');
const db = require('../db');  // db.js 파일을 불러옴

const postController = express.Router();

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
        const query = `
            SELECT c.id, c.post_id, c.comment_content, c.user_id, c.create_at, u.nickname, u.profile_picture
            FROM post_comment c
            LEFT JOIN community_user u ON c.user_id = u.user_id
            WHERE c.post_id = ?
        `;

        db.query(query, [postId], (err, results) => {
            if (err) {
                console.error('Error fetching comments:', err);
                return res.status(500).send('Error fetching comments.');
            }
            res.status(200).json(results);
        });
    } catch (error) {
        console.error('Error in /api/posts/:postId/comments:', error);
        res.status(500).send('Internal server error');
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

        db.query('SELECT user_id, title, article, post_picture FROM community_post WHERE id = ?', [postId], (err, results) => {
            if (err) {
                res.status(500).send('Error querying the database');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('포스트를 찾을 수 없음');
                return;
            }
            const post = results[0];
            const authorId = post.user_id;

            if (userIdCookie !== authorId.toString()) {
                res.status(403).send('게시글 수정 권한이 없습니다.');
                return;
            }

            // Update post fields
            const updateQuery = 'UPDATE community_post SET title = ?, article = ?, post_picture = ? WHERE id = ?';
            const updateValues = [postTitle || post.title, postContents || post.article, postImage || post.post_picture, postId];

            db.query(updateQuery, updateValues, (err) => {
                if (err) {
                    res.status(500).send('Error updating the post');
                    return;
                }
                res.status(200).send({ message: '게시글이 업데이트되었습니다.', post_picture: postImage || post.post_picture });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
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
            create_at: formatDate(new Date()), // Use the formatDate function here
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

// 댓글 수정
postController.put('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const commentId = req.params.commentId;
    const { comment_content } = req.body;

    if (!comment_content) {
        console.error('Missing required fields:', { comment_content });
        return res.status(400).send('Missing required fields');
    }

    try {
        const updateData = { comment_content, update_at: new Date() };

        console.log('Attempting to update comment:', { commentId, updateData });

        db.query('UPDATE post_comment SET ? WHERE id = ?', [updateData, commentId], (err, result) => {
            if (err) {
                console.error('Error updating comment:', err);
                return res.status(500).send('Error updating the comment.');
            }

            if (result.affectedRows === 0) {
                console.log('Comment not found:', { commentId });
                return res.status(404).send('Comment not found');
            }

            console.log('Comment updated successfully:', { id: commentId, ...updateData });
            res.status(200).json({ id: commentId, ...updateData });
        });
    } catch (error) {
        console.error('Error in /api/posts/:postId/comments/:commentId:', error);
        res.status(500).send('Internal server error');
    }
});


// 댓글 삭제
postController.delete('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = parseInt(req.params.commentId, 10);
    try {
        db.query('DELETE FROM post_comment WHERE post_id = ? AND id = ?', [postId, commentId], (err, result) => {
            if (err) {
                console.error('Error deleting comment:', err);
                return res.status(500).send('댓글 삭제 중 오류가 발생했습니다.');
            }
            if (result.affectedRows === 0) {
                return res.status(404).send('Comment not found');
            }
            res.status(200).send('댓글이 삭제되었습니다.');
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).send('Internal server error');
    }
});

// 댓글 작성
postController.post('/api/posts/:postId/comments', async (req, res) => {
    const postId = req.params.postId;
    const { comment_content, user_id } = req.body;

    if (!comment_content || !user_id) {
        console.error('Missing required fields:', { comment_content, user_id });
        return res.status(400).send('Missing required fields');
    }

    try {
        const newComment = {
            post_id: postId,
            comment_content,
            user_id,
            create_at: new Date()
        };

        db.query('INSERT INTO post_comment SET ?', newComment, (err, result) => {
            if (err) {
                console.error('Error inserting comment:', err);
                return res.status(500).send('Error creating the comment.');
            }
            newComment.id = result.insertId;
            res.status(201).json(newComment);
        });
    } catch (error) {
        console.error('Error in /api/posts/:postId/comments:', error);
        res.status(500).send('Internal server error');
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

// 조회수
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

    const query = 'SELECT * FROM post_comment WHERE post_id = ? AND id = ?';

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

module.exports = postController;
