# Troubleshooting
### 1. 로컬 이미지 업로드 구현 실패
처음에는 로컬 이미지 업로드 기능을 구현하지 못하고 URL 주소를 통해 이미지를 업데이트 하는 방법을 사용했습니다. 하지만 Multer을 이용해 이미지 파일을 서버로 업로드 하는 기능을 구현할 수 있었습니다.
#### 해결 방법:
1. **Multer 설치**
   ```
   npm install multer
   ```
2. **Multer 설정**
   `multer.diskStorage`를 사용하여 파일의 저장 위치와 파일명을 설정했습니다.
   
   ```javascript
   const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
       }
   });
   const upload = multer({ storage: storage });
   ```

3. **라우트 설정**
   Express 라우터에서 Multer 미들웨어를 사용하여 파일 업로드를 처리했습니다.
   - 게시글 이미지 파일 업로드 예시:
   ```javascript
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
   ```
