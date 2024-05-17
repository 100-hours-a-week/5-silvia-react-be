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


const postsFilePath = path.join(__dirname, '../models/posts.json');

postController.use('/uploads', express.static('uploads'));
postController.use(cookieParser());
postController.use(helmet());
postController.use(bodyParser.json());
postController.use(express.urlencoded({ extended: true }))

const readPostsFile = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(postsFilePath, 'utf-8', (err, data) => {
            if (err) {
                return reject('서버 오류');
            }
            try {
                if (data.trim().length === 0) {
                    resolve({});
                } else {
                    resolve(JSON.parse(data));
                }
            } catch (error) {
                reject('파일 파싱 오류');
            }
        });
    });
};

const writePostsFile = (posts) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2), (err) => {
            if (err) {
                return reject('서버 오류');
            }
            resolve();
        });
    });
};

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

postController.use(require('cors')({
    origin: 'http://localhost:3000',
    credentials: true
}));
postController.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

//
// postController.use(fileUpload({
//     createParentPath: true,
//     safeFileNames: true,
//     preserveExtension: true
// }));

postController.use('/uploads', express.static('uploads', {
    setHeaders: function (res, path, stat) {
        res.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    }
}));


// 게시물 api
postController.get('/api/posts', async (req, res) => {
    try {
        const posts = await readPostsFile();
        res.json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시물 id별 api
postController.get('/api/posts/:postId', async (req, res) => {
    const postId = req.params.postId;
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        res.json(post);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 댓글 api
postController.get('/api/posts/:postId/comments', async (req, res) => {
    const postId = req.params.postId;
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const comments = post.comments.filter(comment => comment !== null);
        res.json(comments);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});


// 게시글 삭제
postController.delete('/api/posts/:postId', async (req, res) => {
    const postId = req.params.postId;
    try {
        let posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }

        const userIdCookie = req.cookies.userId;
        const authorId = post.authorId;

        if (userIdCookie !== authorId) {
            return res.status(403).send('게시글 삭제 권한이 없습니다.');
        }

        delete posts[postId];
        await writePostsFile(posts);
        res.status(200).send('게시글이 삭제되었습니다.');
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 게시글 수정 권한 확인
postController.get('/api/posts/:postId/checkEditPermission', async (req, res) => {
    const postId = req.params.postId;
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }

        const userIdCookie = req.cookies.userId;
        const authorId = post.authorId;

        if (userIdCookie !== authorId) {
            return res.status(403).send('수정 권한이 없습니다.');
        }

        res.status(200).send('수정 권한이 있습니다.');
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
        let posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }

        const userIdCookie = req.cookies.userId;
        const authorId = post.authorId;

        if (userIdCookie !== authorId) {
            return res.status(403).send('게시글 수정 권한이 없습니다.');
        }

        // Update post fields
        post.postTitle = postTitle || post.postTitle; // Only update if provided
        post.postContents = postContents || post.postContents; // Only update if provided
        if (postImage) {
            post.postImage = postImage; // Update the image if a new one was uploaded
        }

        await writePostsFile(posts);
        res.status(200).send('게시글이 업데이트되었습니다.');
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
        let posts = await readPostsFile();
        const newPostId = Object.keys(posts).length ? Math.max(...Object.keys(posts).map(Number)) + 1 : 1;

        const newPost = {
            postId: newPostId.toString(),
            postTitle,
            postContents,
            postImage,
            authorId,
            date: formatDate(new Date()), // Use the formatDate function here
            views: 0,
            likes: 0,
            comments: []
        };

        posts[newPostId] = newPost;
        await writePostsFile(posts);

        res.status(201).send('게시글이 생성되었습니다.');
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
        let posts = await readPostsFile();
        const post = posts[postId];

        if (!post) {
            return res.status(404).send('게시글을 찾을 수 없습니다.');
        }

        if (post.authorId !== authorId) {
            return res.status(403).send('수정 권한이 없습니다.');
        }

        // 게시글 업데이트: 제공된 필드만 업데이트
        if (postTitle !== undefined) post.postTitle = postTitle;
        if (postContents !== undefined) post.postContents = postContents;
        if (postImage !== undefined) post.postImage = postImage;

        await writePostsFile(posts);

        res.status(200).send('게시글이 수정되었습니다.');
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
        const posts = await readPostsFile();
        const post = posts[postId];

        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }

        post.views += 1;

        await writePostsFile(posts);
        res.status(200).json({ views: post.views });
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// 댓글 api
postController.get('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = parseInt(req.params.commentId, 10);
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const comment = post.comments.find(comment => comment.commentId === commentId);
        if (!comment) {
            return res.status(404).send('댓글을 찾을 수 없음');
        }
        res.json(comment);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});



// 댓글 수정
postController.put('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = parseInt(req.params.commentId, 10);
    const { commentText } = req.body;
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const commentIndex = post.comments.findIndex(comment => comment.commentId === commentId);
        if (commentIndex === -1) {
            return res.status(404).send('댓글을 찾을 수 없음');
        }
        post.comments[commentIndex].commentText = commentText;
        await writePostsFile(posts);
        res.json(post.comments[commentIndex]);
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
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const commentIndex = post.comments.findIndex(comment => comment.commentId === commentId);
        if (commentIndex === -1) {
            return res.status(404).send('댓글을 찾을 수 없음');
        }
        post.comments.splice(commentIndex, 1);
        await writePostsFile(posts);
        res.status(200).send('댓글이 삭제되었습니다.');
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
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const newCommentId = post.comments.length ? Math.max(...post.comments.map(c => c.commentId)) + 1 : 1;
        const newComment = {
            commentId: newCommentId,
            commentText,
            commenterId,
            commentDate: formatDate(new Date()),
        };
        post.comments.push(newComment);
        await writePostsFile(posts);
        res.status(201).json(newComment);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});



module.exports = postController;
