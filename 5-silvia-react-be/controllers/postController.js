const express = require('express');
const path = require('path');
const fs = require('fs');
const postController = express.Router();
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const postsFilePath = path.join(__dirname, '../models/posts.json');
postController.use(cookieParser());
postController.use(helmet());

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

// 댓글 id별 api
postController.get('/api/posts/:postId/comments/:commentId', async (req, res) => {
    const postId = req.params.postId;
    const commentId = req.params.commentId;
    try {
        const posts = await readPostsFile();
        const post = posts[postId];
        if (!post) {
            return res.status(404).send('포스트를 찾을 수 없음');
        }
        const comment = post.comments.find(comment => comment.commentId === parseInt(commentId));
        if (!comment) {
            return res.status(404).send('댓글을 찾을 수 없음');
        }
        res.json(comment);
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
postController.put('/api/posts/:postId', async (req, res) => {
    const postId = req.params.postId;
    const { postTitle, postContents, postImage } = req.body;

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

        // Update post
        post.postTitle = postTitle;
        post.postContents = postContents;
        post.postImage = postImage;

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
            date: new Date().toISOString(),
            views: 0,
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



// session api
postController.get('/session', function (req, res, next) {
    if (req.session.views) {
        req.session.views++;
        res.write('<p> No. of views: ' + req.session.views + '</p>');
        res.end();
    } else {
        req.session.views = 1;
        res.end(' New session is started');
    }
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

//댓글 api
postController.get('/api/posts/:postId/comments/:commentId', (req, res) => {
    const { postId, commentId } = req.params;

    fs.readFile(postsFilePath, (err, data) => {
        if (err) {
            console.error('Error reading posts file:', err);
            return res.status(500).send('Server error');
        }
        try {
            const posts = JSON.parse(data);
            const post = posts.find(post => post.postId === postId);

            if (!post) {
                return res.status(404).send('Post not found');
            }

            const comment = post.comments.find(comment => comment.commentId === commentId);

            if (!comment) {
                return res.status(404).send('Comment not found');
            }

            res.json({ comment });
        } catch (error) {
            console.error('Error parsing posts file:', error);
            res.status(500).send('File parsing error');
        }
    });
});



// 댓글 삭제
postController.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
    const { postId, commentId } = req.params;

    fs.readFile(postsFilePath, (err, data) => {
        if (err) {
            console.error('Error reading posts file:', err);
            return res.status(500).send('Server error');
        }
        try {
            const posts = JSON.parse(data);
            const postIndex = posts.findIndex(post => post.postId === postId);

            if (postIndex === -1) {
                return res.status(404).send('Post not found');
            }

            const comments = posts[postIndex].comments;
            const commentIndex = comments.findIndex(comment => comment.commentId === commentId);

            if (commentIndex === -1) {
                return res.status(404).send('Comment not found');
            }

            comments.splice(commentIndex, 1);

            fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2), (err) => {
                if (err) {
                    console.error('Error writing posts file:', err);
                    return res.status(500).send('Server error');
                }
                res.status(200).send('Comment deleted successfully');
            });
        } catch (error) {
            console.error('Error parsing posts file:', error);
            res.status(500).send('File parsing error');
        }
    });
});


module.exports = postController;
