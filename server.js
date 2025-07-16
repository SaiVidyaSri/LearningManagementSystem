const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { validationResult, body } = require('express-validator');
const bcrypt = require('bcrypt');
const pdf = require('pdf-parse');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(bodyParser.json());

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5000',
    'http://localhost:3000',
    'null'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// File upload configuration
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and PDF are allowed.'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

// MongoDB connection
const uri = process.env.MONGODB_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
});

const quizSchema = new mongoose.Schema({
  qanda: [
    {
      id: Number,
      question: String,
      options: {
        a: String,
        b: String,
        c: String,
        d: String,
      },
      correctAnswer: String,
    },
  ],
});

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: String, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  modules: [moduleSchema],
  quizzes: [quizSchema],
  finalExam: quizSchema,
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

const enrollmentSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  courseName: { type: String, required: true },
  enrolledAt: { type: Date, default: Date.now },
  overallProgress: { type: Number, default: 0 },
  completedModules: { type: Number, default: 0 },
  totalModules: { type: Number, default: 0 },
  finalExamCompleted: { type: Boolean, default: false },
});

const moduleProgressSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  courseName: { type: String, required: true },
  moduleIndex: { type: Number, required: true },
  status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
  completion: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now }
});

const quizAttemptSchema = new mongoose.Schema({
  username: { type: String, required: true },
  courseName: { type: String, required: true },
  quizType: { type: String, enum: ['module', 'final'], required: true },
  moduleIndex: { type: Number },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  questionResults: { type: Array, required: true },
  submittedAt: { type: Date, default: Date.now }
});

// Models
const Course = mongoose.model('Course', courseSchema);
const User = mongoose.model('User', userSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const ModuleProgress = mongoose.model('ModuleProgress', moduleProgressSchema);
const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility functions
const generateResetToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

const extractQuestionsFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdf(pdfBuffer);
    const text = data.text;
    const questions = [];
    const lines = text.split('\n');
    let currentQuestion = null;

    lines.forEach((line) => {
      if (line.match(/^\d+\.\s/)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          id: questions.length + 1,
          question: line.replace(/^\d+\.\s/, '').trim(),
          options: {},
          correctAnswer: '',
        };
      } else if (line.match(/^[a-d]\)\s/)) {
        const option = line.charAt(0);
        const optionText = line.replace(/^[a-d]\)\s/, '').trim();
        if (currentQuestion) {
          currentQuestion.options[option] = optionText;
        }
      } else if (line.match(/^Answer:\s/)) {
        if (currentQuestion) {
          currentQuestion.correctAnswer = line.replace(/^Answer:\s/, '').trim();
        }
      }
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return questions;
  } catch (error) {
    console.error('Error extracting questions from PDF:', error);
    throw new Error('Failed to extract questions from PDF');
  }
};

const updateCourseProgress = async (username, email, courseName) => {
  try {
    const course = await Course.findOne({ name: courseName });
    if (!course) return;

    const moduleProgress = await ModuleProgress.find({ username, courseName });
    const quizResults = await QuizAttempt.find({ username, courseName, quizType: 'module' });
    const finalExamResult = await QuizAttempt.findOne({ username, courseName, quizType: 'final' });

    const totalModules = course.modules.length;
    const completedModules = moduleProgress.filter(mp => mp.status === 'completed').length;

    let overallProgress = 0;
    if (totalModules > 0) {
      overallProgress += (completedModules / totalModules) * 60;
    }
    if (quizResults.length > 0) {
      const quizAvg = quizResults.reduce((sum, q) => sum + q.percentage, 0) / quizResults.length;
      overallProgress += (quizAvg / 100) * 20;
    }
    if (finalExamResult) {
      overallProgress += (finalExamResult.percentage / 100) * 20;
    }

    await Enrollment.findOneAndUpdate(
      { username, courseName },
      {
        overallProgress: Math.round(overallProgress),
        completedModules,
        totalModules,
        finalExamCompleted: !!finalExamResult
      }
    );
  } catch (error) {
    console.error('Error updating course progress:', error);
  }
};

// Routes

// Basic route
app.get('/', (req, res) => {
  res.send('LMS Backend Server is running!');
});

// User registration
app.post('/register', [
  body('email').isEmail().withMessage('Invalid email'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { email, username, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      username,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ 
      message: "User registered successfully", 
      user: { email: newUser.email, username: newUser.username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// User login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    res.status(200).json({ 
      message: 'Login successful', 
      user: {
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = generateResetToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetLink = `http://localhost:5000/reset-password.html?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Link',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to send reset link' });
  }
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  
  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
app.post('/update_profile', async (req, res) => {
  const { email, username, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (username) {
      user.username = username;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.json({ success: true, message: "Profile updated successfully!" });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get profile
app.get('/api/profile', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Course management
app.post('/api/courses', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'finalAssignment', maxCount: 1 },
  { name: 'quizzes', maxCount: 10 },
]), async (req, res) => {
  try {
    const { name, description, duration, category, modules } = req.body;
    
    if (!req.files['image'] || !req.files['finalAssignment']) {
      return res.status(400).json({ error: 'Image and final assignment files are required' });
    }

    const image = `/uploads/${req.files['image'][0].filename}`;
    let parsedModules;
    
    try {
      parsedModules = JSON.parse(modules);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid modules format' });
    }

    const quizzes = [];
    if (req.files['quizzes']) {
      for (const file of req.files['quizzes']) {
        const pdfBuffer = fs.readFileSync(file.path);
        const questions = await extractQuestionsFromPDF(pdfBuffer);
        quizzes.push({ qanda: questions });
      }
    }

    const finalAssignmentBuffer = fs.readFileSync(req.files['finalAssignment'][0].path);
    const finalExamQuestions = await extractQuestionsFromPDF(finalAssignmentBuffer);

    const newCourse = new Course({
      name,
      description,
      duration,
      category,
      image,
      modules: parsedModules,
      quizzes,
      finalExam: { qanda: finalExamQuestions },
    });

    await newCourse.save();
    res.status(201).json({ message: 'Course created successfully', course: newCourse });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find({}, 'name description duration image category createdAt');
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get specific course
app.get('/api/courses/:name', async (req, res) => {
  try {
    const courseName = req.params.name;
    const course = await Course.findOne({ name: courseName });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.status(200).json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Enrollment
app.post('/api/enroll', async (req, res) => {
  const { courseName, username } = req.body;

  if (!courseName || !username) {
    return res.status(400).json({ success: false, message: 'Course name and username are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const course = await Course.findOne({ name: courseName });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const existingEnrollment = await Enrollment.findOne({ courseName, username });
    if (existingEnrollment) {
      return res.status(400).json({ success: false, message: 'User already enrolled in this course' });
    }

    const newEnrollment = new Enrollment({
      username,
      email: user.email,
      courseName,
      totalModules: course.modules.length
    });

    await newEnrollment.save();

    // Initialize module progress
    for (let i = 0; i < course.modules.length; i++) {
      const moduleProgress = new ModuleProgress({
        username,
        email: user.email,
        courseName,
        moduleIndex: i,
        status: 'not-started',
        completion: 0
      });
      await moduleProgress.save();
    }

    res.status(200).json({ success: true, message: 'Enrollment successful' });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Check enrollment
app.get('/api/check-enrollment', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const enrollment = await Enrollment.findOne({ username });
    res.status(200).json({ isEnrolled: !!enrollment });
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({ error: 'Failed to check enrollment status' });
  }
});

// Quiz submission
app.post('/api/submit-quiz', async (req, res) => {
  const { username, courseName, quizType, moduleIndex, answers } = req.body;

  try {
    const existingAttempt = await QuizAttempt.findOne({
      username,
      courseName,
      quizType,
      ...(quizType === 'module' && { moduleIndex })
    });

    if (existingAttempt) {
      return res.status(400).json({
        error: 'You have already attempted this quiz/exam',
        existingScore: existingAttempt.score,
        existingPercentage: existingAttempt.percentage
      });
    }

    const course = await Course.findOne({ name: courseName });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const quiz = quizType === 'final' ? course.finalExam : course.quizzes[moduleIndex];
    let score = 0;
    const questionResults = [];

    quiz.qanda.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;

      if (isCorrect) {
        score++;
      }

      questionResults.push({
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        options: question.options,
        isCorrect,
        wasAnswered: userAnswer !== null && userAnswer !== undefined
      });
    });

    const totalQuestions = quiz.qanda.length;
    const percentage = (score / totalQuestions) * 100;

    const attempt = new QuizAttempt({
      username,
      courseName,
      quizType,
      ...(quizType === 'module' && { moduleIndex }),
      score,
      totalQuestions,
      percentage,
      questionResults
    });

    await attempt.save();

    // Update module progress if it's a module quiz
    if (quizType === 'module') {
      await ModuleProgress.findOneAndUpdate(
        { username, courseName, moduleIndex },
        { status: 'completed', completion: 100 }
      );
    }

    // Update overall course progress
    const user = await User.findOne({ username });
    if (user) {
      await updateCourseProgress(username, user.email, courseName);
    }

    res.status(200).json({
      success: true,
      score,
      totalQuestions,
      percentage,
      questionResults
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// Check quiz attempt
app.get('/api/check-attempt', async (req, res) => {
  try {
    const { username, courseName, quizType, moduleIndex } = req.query;

    if (!username || !courseName || !quizType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const query = { username, courseName, quizType };
    if (quizType === 'module' && moduleIndex !== undefined) {
      query.moduleIndex = parseInt(moduleIndex);
    }

    const attempt = await QuizAttempt.findOne(query).sort({ submittedAt: -1 });
    const attemptCount = await QuizAttempt.countDocuments(query);

    res.status(200).json({
      success: true,
      hasAttempted: !!attempt,
      attemptData: attempt || null,
      attemptCount: attemptCount || 0
    });

  } catch (error) {
    console.error('Check attempt error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get quiz results
app.get('/api/quiz-results', async (req, res) => {
  const { username, courseName, quizType, moduleIndex } = req.query;

  try {
    const results = await QuizAttempt.find({
      username,
      courseName,
      quizType,
      ...(quizType === 'module' && { moduleIndex })
    }).sort({ submittedAt: -1 });

    res.status(200).json(results);
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

// Progress tracking
app.post('/api/update-module-progress', async (req, res) => {
  const { username, courseName, moduleIndex, completion, status } = req.body;

  if (!username || !courseName || moduleIndex === undefined) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let moduleProgress = await ModuleProgress.findOne({ username, courseName, moduleIndex });

    if (moduleProgress) {
      if (completion !== undefined) moduleProgress.completion = completion;
      if (status) moduleProgress.status = status;
      moduleProgress.lastAccessed = Date.now();
      await moduleProgress.save();
    } else {
      moduleProgress = new ModuleProgress({
        username,
        email: user.email,
        courseName,
        moduleIndex,
        completion: completion || 0,
        status: status || 'not-started'
      });
      await moduleProgress.save();
    }

    await updateCourseProgress(username, user.email, courseName);

    res.status(200).json({ success: true, moduleProgress });
  } catch (error) {
    console.error('Update module progress error:', error);
    res.status(500).json({ error: 'Failed to update module progress' });
  }
});

// Get module progress
app.get('/api/module-progress', async (req, res) => {
  const { username, courseName, moduleIndex } = req.query;

  if (!username || !courseName) {
    return res.status(400).json({ error: 'Username and course name are required' });
  }

  try {
    let query = { username, courseName };
    if (moduleIndex !== undefined) {
      query.moduleIndex = moduleIndex;
    }

    const progress = await ModuleProgress.find(query).sort({ moduleIndex: 1 });
    res.status(200).json(progress);
  } catch (error) {
    console.error('Get module progress error:', error);
    res.status(500).json({ error: 'Failed to fetch module progress' });
  }
});

// Get student progress details
app.get('/api/student-progress-details', async (req, res) => {
  const { username, email } = req.query;

  try {
    const enrollments = await Enrollment.find({ username });
    const progressData = [];

    for (const enrollment of enrollments) {
      const course = await Course.findOne({ name: enrollment.courseName });
      if (!course) continue;

      const moduleProgress = await ModuleProgress.find({
        username,
        courseName: enrollment.courseName
      }).sort({ moduleIndex: 1 });

      const quizResults = await QuizAttempt.find({
        username,
        courseName: enrollment.courseName,
        quizType: 'module'
      }).sort({ moduleIndex: 1 });

      const finalExamResult = await QuizAttempt.findOne({
        username,
        courseName: enrollment.courseName,
        quizType: 'final'
      });

      const totalModules = course.modules.length;
      let completedModules = 0;

      const enhancedModuleProgress = course.modules.map((module, index) => {
        const progressRecord = moduleProgress.find(mp => mp.moduleIndex === index) || {
          status: 'not-started',
          completion: 0
        };

        const quizAttempt = quizResults.find(q => q.moduleIndex === index);
        if (quizAttempt) {
          progressRecord.status = 'completed';
          progressRecord.completion = 100;
          completedModules++;
        }

        return {
          moduleIndex: index,
          moduleName: module.title || `Module ${index + 1}`,
          status: progressRecord.status,
          completion: progressRecord.completion,
          lastAccessed: progressRecord.lastAccessed
        };
      });

      let overallProgress = 0;
      if (totalModules > 0) {
        overallProgress += (completedModules / totalModules) * 60;
      }
      if (quizResults.length > 0) {
        const quizAvg = quizResults.reduce((sum, q) => sum + q.percentage, 0) / quizResults.length;
        overallProgress += (quizAvg / 100) * 20;
      }
      if (finalExamResult) {
        overallProgress += (finalExamResult.percentage / 100) * 20;
      }

      const isCompleted = (completedModules === totalModules) && (finalExamResult !== null);

      progressData.push({
        courseName: enrollment.courseName,
        courseDescription: course.description,
        courseImage: course.image,
        overallProgress: Math.round(overallProgress),
        isCompleted,
        completedAt: enrollment.completedAt,
        totalModules,
        completedModules,
        moduleProgress: enhancedModuleProgress,
        quizScores: quizResults.map(q => ({
          moduleIndex: q.moduleIndex,
          score: q.score,
          totalQuestions: q.totalQuestions,
          percentage: q.percentage
        })),
        finalExamScore: finalExamResult ? {
          score: finalExamResult.score,
          totalQuestions: finalExamResult.totalQuestions,
          percentage: finalExamResult.percentage
        } : null
      });
    }

    res.status(200).json(progressData);
  } catch (error) {
    console.error('Get student progress details error:', error);
    res.status(500).json({ error: 'Failed to fetch progress details' });
  }
});

// Instructor routes
app.get('/api/instructor-courses', async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({ error: 'Failed to fetch instructor courses' });
  }
});

app.get('/api/course-enrollments', async (req, res) => {
  try {
    const { courseName } = req.query;

    if (!courseName) {
      return res.status(400).json({ error: 'Course name is required' });
    }

    const enrollments = await Enrollment.find({ courseName });
    res.status(200).json({
      count: enrollments.length,
      enrollments
    });
  } catch (error) {
    console.error('Get course enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch course enrollments' });
  }
});

app.get('/api/student-progress', async (req, res) => {
  try {
    const { username, courseName } = req.query;

    if (!username || !courseName) {
      return res.status(400).json({ error: 'Username and course name are required' });
    }

    const course = await Course.findOne({ name: courseName });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const moduleProgress = await ModuleProgress.find({ username, courseName }).sort({ moduleIndex: 1 });
    const quizResults = await QuizAttempt.find({
      username,
      courseName,
      quizType: 'module'
    }).sort({ moduleIndex: 1 });

    const finalExamResult = await QuizAttempt.findOne({
      username,
      courseName,
      quizType: 'final'
    });

    let overallCompletion = 0;
    if (course.modules && course.modules.length > 0) {
      const moduleCompletionSum = moduleProgress.reduce((sum, progress) => sum + progress.completion, 0);
      const moduleCompletionAvg = moduleCompletionSum / course.modules.length;
      overallCompletion += moduleCompletionAvg * 0.6;
    }

    if (course.quizzes && course.quizzes.length > 0 && quizResults.length > 0) {
      const quizScoreSum = quizResults.reduce((sum, quiz) => sum + quiz.percentage, 0);
      const quizScoreAvg = quizScoreSum / course.quizzes.length;
      overallCompletion += (quizScoreAvg / 100) * 20;
    }

    if (finalExamResult) {
      overallCompletion += (finalExamResult.percentage / 100) * 20;
    }

    overallCompletion = Math.round(overallCompletion * 10) / 10;

    const progressData = {
      overallCompletion,
      moduleProgress,
      quizResults,
      finalExamResult
    };

    res.status(200).json(progressData);
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ error: 'Failed to fetch student progress' });
  }
});

// Statistics
app.get('/api/total-users', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ count });
  } catch (error) {
    console.error('Get total users error:', error);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`LMS Server is running on http://localhost:${PORT}`);
});

module.exports = app;

