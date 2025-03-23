const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');

const app = express();
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    allowedTypes.includes(file.mimetype) 
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only JPG/JPEG/PNG allowed'));
  }
});

// Security configurations
const trusted_domains = ['http://localhost:3000', 'https://your-production-domain.com'];
const rateLimiter = rateLimit({ windowMs: 15*60*1000, max: 100 });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://i.pinimg.com"]
    }
  }
}));
app.use(rateLimiter);
app.use(cors({ origin: trusted_domains, methods: ['GET', 'POST'] }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const tasks = new Map();

app.get('/', (req, res) => res.render('index'));

app.post('/send', upload.single('message_file'), (req, res) => {
  try {
    const { username, password, choice, target, delay } = req.body;
    const taskId = Math.random().toString(36).slice(2, 11);
    const stopFlag = { stopped: false };

    tasks.set(taskId, { stopFlag });

    const worker = new Worker('./instagram-worker.js', {
      workerData: {
        username,
        password,
        choice,
        target,
        delay: parseInt(delay),
        taskId,
        filePath: req.file?.path,
        stopFlag
      }
    });

    worker.on('exit', code => {
  try {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  } catch (fileError) {
    console.error('File cleanup error:', fileError);
  }
  if (code !== 0) console.error(`Worker exited with code ${code}`);
});

    res.send(`Image sending started. Task ID: ${taskId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing request');
  }
});

app.post('/stop', (req, res) => {
  const taskId = req.body.taskId;
  tasks.has(taskId) 
    ? (tasks.get(taskId).stopFlag.stopped = true, tasks.delete(taskId), res.send(`Task ${taskId} stopped`))
    : res.status(404).send('Task not found');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
