const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|avi|mov|wmv|doc|docx|ppt|pptx|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.log('MongoDB connection error:', err);
});

// Enhanced User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  dateOfBirth: { type: Date },
  
  // Instructor specific fields
  qualifications: [{ type: String }],
  experience: { type: Number, default: 0 }, // years of experience
  expertise: [{ type: String }], // areas of expertise
  linkedinProfile: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  instructorStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  instructorApplication: {
    appliedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String }
  },
  
  // Statistics
  totalCoursesCreated: { type: Number, default: 0 },
  totalStudentsEnrolled: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Enhanced Course Schema
const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  shortDescription: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
  language: { type: String, default: 'English' },
  duration: { type: Number, required: true }, // in weeks
  estimatedHours: { type: Number, required: true },
  price: { type: Number, default: 0 },
  
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  instructorName: { type: String, required: true },
  
  image: { type: String, required: true },
  previewVideo: { type: String, default: '' },
  
  // Course content structure
  modules: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    order: { type: Number, required: true },
    estimatedDuration: { type: Number, required: true }, // in minutes
    
    lessons: [{
      title: { type: String, required: true },
      description: { type: String, default: '' },
      type: { type: String, enum: ['video', 'text', 'document', 'interactive'], required: true },
      content: { type: String, required: true }, // URL or content
      duration: { type: Number, default: 0 }, // in minutes
      order: { type: Number, required: true },
      isPreview: { type: Boolean, default: false }
    }],
    
    materials: [{
      title: { type: String, required: true },
      type: { type: String, enum: ['pdf', 'document', 'link', 'resource'], required: true },
      url: { type: String, required: true },
      description: { type: String, default: '' }
    }],
    
    assignments: [{
      title: { type: String, required: true },
      description: { type: String, required: true },
      instructions: { type: String, required: true },
      dueDate: { type: Date },
      maxScore: { type: Number, default: 100 },
      submissionFormat: { type: String, enum: ['file', 'text', 'url'], required: true },
      isRequired: { type: Boolean, default: true }
    }]
  }],
  
  // Quiz structure
  quizzes: [{
    moduleIndex: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    timeLimit: { type: Number, default: 15 }, // in minutes
    passingScore: { type: Number, default: 60 }, // percentage
    maxAttempts: { type: Number, default: 3 },
    qanda: [{
      question: { type: String, required: true },
      options: {
        a: { type: String, required: true },
        b: { type: String, required: true },
        c: { type: String, required: true },
        d: { type: String, required: true }
      },
      correctAnswer: { type: String, required: true },
      explanation: { type: String, default: '' },
      points: { type: Number, default: 1 }
    }]
  }],
  
  // Final exam
  finalExam: {
    title: { type: String, default: 'Final Exam' },
    description: { type: String, default: '' },
    timeLimit: { type: Number, default: 60 }, // in minutes
    passingScore: { type: Number, default: 65 }, // percentage
    maxAttempts: { type: Number, default: 2 },
    qanda: [{
      question: { type: String, required: true },
      options: {
        a: { type: String, required: true },
        b: { type: String, required: true },
        c: { type: String, required: true },
        d: { type: String, required: true }
      },
      correctAnswer: { type: String, required: true },
      explanation: { type: String, default: '' },
      points: { type: Number, default: 1 }
    }]
  },
  
  // Course requirements and outcomes
  prerequisites: [{ type: String }],
  learningOutcomes: [{ type: String }],
  targetAudience: [{ type: String }],
  
  // Course statistics
  totalEnrollments: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  
  // Course status
  status: { type: String, enum: ['draft', 'pending', 'published', 'archived'], default: 'draft' },
  publishedAt: { type: Date },
  
  // SEO and metadata
  tags: [{ type: String }],
  metaDescription: { type: String, default: '' },
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Enhanced Enrollment Schema
const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  enrolledAt: { type: Date, default: Date.now },
  
  // Progress tracking
  overallProgress: { type: Number, default: 0 }, // percentage
  completedModules: { type: Number, default: 0 },
  totalModules: { type: Number, required: true },
  
  moduleProgress: [{
    moduleIndex: { type: Number, required: true },
    moduleName: { type: String, required: true },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
    completion: { type: Number, default: 0 }, // percentage
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastAccessed: { type: Date },
    
    lessonProgress: [{
      lessonIndex: { type: Number, required: true },
      lessonTitle: { type: String, required: true },
      isCompleted: { type: Boolean, default: false },
      timeSpent: { type: Number, default: 0 }, // in minutes
      completedAt: { type: Date }
    }],
    
    assignmentSubmissions: [{
      assignmentIndex: { type: Number, required: true },
      submittedAt: { type: Date },
      submissionContent: { type: String },
      submissionFile: { type: String },
      score: { type: Number },
      feedback: { type: String },
      gradedAt: { type: Date },
      gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  }],
  
  // Quiz attempts
  quizAttempts: [{
    moduleIndex: { type: Number, required: true },
    attemptNumber: { type: Number, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    answers: [{ type: String }],
    timeSpent: { type: Number }, // in minutes
    submittedAt: { type: Date, default: Date.now }
  }],
  
  // Final exam
  finalExamAttempts: [{
    attemptNumber: { type: Number, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    answers: [{ type: String }],
    timeSpent: { type: Number }, // in minutes
    submittedAt: { type: Date, default: Date.now },
    passed: { type: Boolean, required: true }
  }],
  
  // Course completion
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  certificateIssued: { type: Boolean, default: false },
  certificateIssuedAt: { type: Date },
  certificateId: { type: String },
  
  // Course feedback
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  reviewSubmittedAt: { type: Date },
  
  lastAccessedAt: { type: Date, default: Date.now }
});

// Query/Doubt Schema
const querySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  title: { type: String, required: true },
  description: { type: String, required: true },
  moduleIndex: { type: Number },
  lessonIndex: { type: Number },
  
  status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  
  replies: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['student', 'instructor', 'admin'], required: true },
    content: { type: String, required: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  }],
  
  attachments: [{ type: String }],
  tags: [{ type: String }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

// Platform Review Schema
const platformReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  
  // Review categories
  categories: {
    userInterface: { type: Number, min: 1, max: 5 },
    courseQuality: { type: Number, min: 1, max: 5 },
    instructorSupport: { type: Number, min: 1, max: 5 },
    platformStability: { type: Number, min: 1, max: 5 },
    valueForMoney: { type: Number, min: 1, max: 5 }
  },
  
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  
  isPublic: { type: Boolean, default: true },
  helpfulVotes: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now }
});

// Certificate Schema
const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  studentName: { type: String, required: true },
  courseName: { type: String, required: true },
  instructorName: { type: String, required: true },
  
  completionDate: { type: Date, required: true },
  finalScore: { type: Number, required: true },
  
  certificateUrl: { type: String },
  issuedAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const Query = mongoose.model('Query', querySchema);
const PlatformReview = mongoose.model('PlatformReview', platformReviewSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Middleware for role-based access
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Helper function to generate certificate ID
function generateCertificateId() {
  return 'CERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, fullName, role = 'student' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      fullName,
      role,
      instructorStatus: role === 'instructor' ? 'pending' : undefined
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }],
      isActive: true 
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check instructor status
    if (user.role === 'instructor' && user.instructorStatus !== 'approved') {
      return res.status(403).json({ 
        error: 'Instructor account pending approval',
        status: user.instructorStatus 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== USER MANAGEMENT ROUTES ====================

// Get user profile
app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -resetPasswordToken');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
app.put('/api/update-profile', async (req, res) => {
  try {
    const { username, fullName, bio, phone, address, dateOfBirth } = req.body;

    const user = await User.findOneAndUpdate(
      { username },
      { 
        fullName, 
        bio, 
        phone, 
        address, 
        dateOfBirth,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== INSTRUCTOR APPLICATION ROUTES ====================

// Apply to become instructor
app.post('/api/apply-instructor', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'certificates', maxCount: 5 },
  { name: 'portfolio', maxCount: 10 }
]), async (req, res) => {
  try {
    const { 
      username, 
      qualifications, 
      experience, 
      expertise, 
      linkedinProfile, 
      portfolioUrl,
      motivation 
    } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'instructor') {
      return res.status(400).json({ error: 'Already an instructor' });
    }

    // Update user with instructor application
    user.role = 'instructor';
    user.instructorStatus = 'pending';
    user.qualifications = JSON.parse(qualifications || '[]');
    user.experience = parseInt(experience) || 0;
    user.expertise = JSON.parse(expertise || '[]');
    user.linkedinProfile = linkedinProfile || '';
    user.portfolioUrl = portfolioUrl || '';
    user.instructorApplication = {
      appliedAt: new Date(),
      motivation: motivation
    };

    // Handle file uploads
    if (req.files) {
      user.instructorApplication.documents = {
        resume: req.files.resume ? req.files.resume[0].filename : null,
        certificates: req.files.certificates ? req.files.certificates.map(f => f.filename) : [],
        portfolio: req.files.portfolio ? req.files.portfolio.map(f => f.filename) : []
      };
    }

    await user.save();

    res.json({ message: 'Instructor application submitted successfully' });
  } catch (error) {
    console.error('Error submitting instructor application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// ==================== COURSE MANAGEMENT ROUTES ====================

// Create course (instructor only)
app.post('/api/courses', authenticateToken, requireRole(['instructor']), upload.fields([
  { name: 'courseImage', maxCount: 1 },
  { name: 'previewVideo', maxCount: 1 },
  { name: 'materials', maxCount: 50 }
]), async (req, res) => {
  try {
    const courseData = JSON.parse(req.body.courseData);
    
    // Get instructor info
    const instructor = await User.findById(req.user.userId);
    if (!instructor || instructor.instructorStatus !== 'approved') {
      return res.status(403).json({ error: 'Not an approved instructor' });
    }

    // Handle file uploads
    if (req.files.courseImage) {
      courseData.image = `/uploads/${req.files.courseImage[0].filename}`;
    }
    if (req.files.previewVideo) {
      courseData.previewVideo = `/uploads/${req.files.previewVideo[0].filename}`;
    }

    // Create course
    const course = new Course({
      ...courseData,
      instructor: instructor._id,
      instructorName: instructor.fullName,
      totalModules: courseData.modules.length
    });

    await course.save();

    // Update instructor stats
    instructor.totalCoursesCreated += 1;
    await instructor.save();

    res.status(201).json({ message: 'Course created successfully', courseId: course._id });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const { category, level, instructor, search, status = 'published' } = req.query;
    
    let filter = { status, isActive: true };
    
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (instructor) filter.instructor = instructor;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const courses = await Course.find(filter)
      .populate('instructor', 'fullName profileImage averageRating')
      .select('-modules.lessons.content -quizzes.qanda -finalExam.qanda')
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get course by ID or name
app.get('/api/courses/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let course;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      course = await Course.findById(identifier);
    } else {
      course = await Course.findOne({ name: identifier });
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await course.populate('instructor', 'fullName profileImage bio averageRating totalStudentsEnrolled');
    
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ==================== ENROLLMENT ROUTES ====================

// Enroll in course
app.post('/api/enroll', async (req, res) => {
  try {
    const { courseName, username } = req.body;

    const user = await User.findOne({ username });
    const course = await Course.findOne({ name: courseName });

    if (!user || !course) {
      return res.status(404).json({ error: 'User or course not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: user._id,
      course: course._id
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create enrollment
    const enrollment = new Enrollment({
      student: user._id,
      course: course._id,
      totalModules: course.modules.length,
      moduleProgress: course.modules.map((module, index) => ({
        moduleIndex: index,
        moduleName: module.title,
        lessonProgress: module.lessons.map((lesson, lessonIndex) => ({
          lessonIndex,
          lessonTitle: lesson.title
        }))
      }))
    });

    await enrollment.save();

    // Update course stats
    course.totalEnrollments += 1;
    await course.save();

    // Update instructor stats
    const instructor = await User.findById(course.instructor);
    if (instructor) {
      instructor.totalStudentsEnrolled += 1;
      await instructor.save();
    }

    res.json({ message: 'Enrolled successfully' });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

// Get student progress
app.get('/api/student-progress-details', async (req, res) => {
  try {
    const { username, email } = req.query;

    const user = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const enrollments = await Enrollment.find({ student: user._id })
      .populate('course', 'name description image instructor')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'fullName'
        }
      });

    const progressData = enrollments.map(enrollment => ({
      courseName: enrollment.course.name,
      courseDescription: enrollment.course.description,
      courseImage: enrollment.course.image,
      instructorName: enrollment.course.instructor.fullName,
      enrolledAt: enrollment.enrolledAt,
      overallProgress: enrollment.overallProgress,
      completedModules: enrollment.completedModules,
      totalModules: enrollment.totalModules,
      moduleProgress: enrollment.moduleProgress,
      quizScores: enrollment.quizAttempts.map(attempt => ({
        moduleIndex: attempt.moduleIndex,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        submittedAt: attempt.submittedAt
      })),
      finalExamScore: enrollment.finalExamAttempts.length > 0 ? {
        score: enrollment.finalExamAttempts[enrollment.finalExamAttempts.length - 1].score,
        totalQuestions: enrollment.finalExamAttempts[enrollment.finalExamAttempts.length - 1].totalQuestions,
        percentage: enrollment.finalExamAttempts[enrollment.finalExamAttempts.length - 1].percentage,
        passed: enrollment.finalExamAttempts[enrollment.finalExamAttempts.length - 1].passed
      } : null,
      isCompleted: enrollment.isCompleted,
      completedAt: enrollment.completedAt,
      certificateIssued: enrollment.certificateIssued,
      rating: enrollment.rating,
      review: enrollment.review
    }));

    res.json(progressData);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ==================== QUIZ AND EXAM ROUTES ====================

// Submit quiz
app.post('/api/submit-quiz', async (req, res) => {
  try {
    const { username, courseName, quizType, moduleIndex, answers } = req.body;

    const user = await User.findOne({ username });
    const course = await Course.findOne({ name: courseName });

    if (!user || !course) {
      return res.status(404).json({ error: 'User or course not found' });
    }

    const enrollment = await Enrollment.findOne({
      student: user._id,
      course: course._id
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    let quizData, attemptArray;
    
    if (quizType === 'final') {
      quizData = course.finalExam;
      attemptArray = enrollment.finalExamAttempts;
    } else {
      quizData = course.quizzes[parseInt(moduleIndex)];
      attemptArray = enrollment.quizAttempts;
    }

    if (!quizData) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check attempt limit
    const previousAttempts = attemptArray.filter(attempt => 
      quizType === 'final' || attempt.moduleIndex === parseInt(moduleIndex)
    );

    if (previousAttempts.length >= quizData.maxAttempts) {
      return res.status(400).json({ error: 'Maximum attempts exceeded' });
    }

    // Calculate score
    let score = 0;
    const questionResults = [];

    quizData.qanda.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      
      if (isCorrect) {
        score += question.points || 1;
      }

      questionResults.push({
        question: question.question,
        options: question.options,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      });
    });

    const totalQuestions = quizData.qanda.length;
    const percentage = Math.round((score / totalQuestions) * 100);
    const passed = percentage >= quizData.passingScore;

    // Create attempt record
    const attemptData = {
      score,
      totalQuestions,
      percentage,
      answers,
      submittedAt: new Date()
    };

    if (quizType === 'final') {
      attemptData.attemptNumber = previousAttempts.length + 1;
      attemptData.passed = passed;
      enrollment.finalExamAttempts.push(attemptData);
      
      // Check for course completion and certificate
      if (passed && enrollment.overallProgress >= 100) {
        enrollment.isCompleted = true;
        enrollment.completedAt = new Date();
        
        // Issue certificate
        if (!enrollment.certificateIssued) {
          const certificateId = generateCertificateId();
          
          const certificate = new Certificate({
            certificateId,
            student: user._id,
            course: course._id,
            instructor: course.instructor,
            studentName: user.fullName,
            courseName: course.name,
            instructorName: course.instructorName,
            completionDate: new Date(),
            finalScore: percentage
          });
          
          await certificate.save();
          
          enrollment.certificateIssued = true;
          enrollment.certificateIssuedAt = new Date();
          enrollment.certificateId = certificateId;
        }
      }
    } else {
      attemptData.moduleIndex = parseInt(moduleIndex);
      attemptData.attemptNumber = previousAttempts.length + 1;
      enrollment.quizAttempts.push(attemptData);
      
      // Update module progress if quiz passed
      if (passed) {
        const moduleProgress = enrollment.moduleProgress[parseInt(moduleIndex)];
        if (moduleProgress && moduleProgress.status !== 'completed') {
          moduleProgress.status = 'completed';
          moduleProgress.completion = 100;
          moduleProgress.completedAt = new Date();
          
          // Update overall progress
          enrollment.completedModules = enrollment.moduleProgress.filter(mp => mp.status === 'completed').length;
          enrollment.overallProgress = Math.round((enrollment.completedModules / enrollment.totalModules) * 100);
        }
      }
    }

    await enrollment.save();

    res.json({
      score,
      totalQuestions,
      percentage,
      passed,
      questionResults,
      message: passed ? 'Quiz passed!' : 'Quiz failed. Try again.'
    });

  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// Check quiz attempt
app.get('/api/check-attempt', async (req, res) => {
  try {
    const { username, courseName, quizType, moduleIndex } = req.query;

    const user = await User.findOne({ username });
    const course = await Course.findOne({ name: courseName });

    if (!user || !course) {
      return res.status(404).json({ error: 'User or course not found' });
    }

    const enrollment = await Enrollment.findOne({
      student: user._id,
      course: course._id
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    let hasAttempted = false;
    let attemptData = null;

    if (quizType === 'final') {
      hasAttempted = enrollment.finalExamAttempts.length > 0;
      if (hasAttempted) {
        const lastAttempt = enrollment.finalExamAttempts[enrollment.finalExamAttempts.length - 1];
        attemptData = {
          score: lastAttempt.score,
          totalQuestions: lastAttempt.totalQuestions,
          percentage: lastAttempt.percentage,
          submittedAt: lastAttempt.submittedAt,
          passed: lastAttempt.passed
        };
      }
    } else {
      const moduleAttempts = enrollment.quizAttempts.filter(
        attempt => attempt.moduleIndex === parseInt(moduleIndex)
      );
      hasAttempted = moduleAttempts.length > 0;
      if (hasAttempted) {
        const lastAttempt = moduleAttempts[moduleAttempts.length - 1];
        attemptData = {
          score: lastAttempt.score,
          totalQuestions: lastAttempt.totalQuestions,
          percentage: lastAttempt.percentage,
          submittedAt: lastAttempt.submittedAt
        };
      }
    }

    res.json({ hasAttempted, attemptData });
  } catch (error) {
    console.error('Error checking attempt:', error);
    res.status(500).json({ error: 'Failed to check attempt' });
  }
});

// ==================== QUERY/DOUBT SYSTEM ROUTES ====================

// Submit query
app.post('/api/submit-query', authenticateToken, async (req, res) => {
  try {
    const { courseId, title, description, moduleIndex, lessonIndex } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const query = new Query({
      student: req.user.userId,
      course: courseId,
      instructor: course.instructor,
      title,
      description,
      moduleIndex,
      lessonIndex
    });

    await query.save();

    res.status(201).json({ message: 'Query submitted successfully', queryId: query._id });
  } catch (error) {
    console.error('Error submitting query:', error);
    res.status(500).json({ error: 'Failed to submit query' });
  }
});

// Get queries for instructor
app.get('/api/instructor-queries', authenticateToken, requireRole(['instructor']), async (req, res) => {
  try {
    const queries = await Query.find({ instructor: req.user.userId })
      .populate('student', 'fullName email')
      .populate('course', 'name')
      .sort({ createdAt: -1 });

    res.json(queries);
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// Reply to query
app.post('/api/reply-query', authenticateToken, async (req, res) => {
  try {
    const { queryId, content } = req.body;

    const query = await Query.findById(queryId);
    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Check if user can reply (instructor of the course or admin)
    if (req.user.role !== 'admin' && query.instructor.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to reply' });
    }

    query.replies.push({
      author: req.user.userId,
      authorRole: req.user.role,
      content
    });

    query.status = 'answered';
    query.updatedAt = new Date();

    await query.save();

    res.json({ message: 'Reply added successfully' });
  } catch (error) {
    console.error('Error replying to query:', error);
    res.status(500).json({ error: 'Failed to reply to query' });
  }
});

// ==================== REVIEW SYSTEM ROUTES ====================

// Submit course review
app.post('/api/submit-course-review', authenticateToken, async (req, res) => {
  try {
    const { courseId, rating, review } = req.body;

    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      course: courseId,
      isCompleted: true
    });

    if (!enrollment) {
      return res.status(400).json({ error: 'Course must be completed to leave a review' });
    }

    if (enrollment.rating) {
      return res.status(400).json({ error: 'Review already submitted' });
    }

    enrollment.rating = rating;
    enrollment.review = review;
    enrollment.reviewSubmittedAt = new Date();

    await enrollment.save();

    // Update course average rating
    const course = await Course.findById(courseId);
    const allReviews = await Enrollment.find({ course: courseId, rating: { $exists: true } });
    
    const totalRating = allReviews.reduce((sum, enr) => sum + enr.rating, 0);
    course.averageRating = totalRating / allReviews.length;
    course.totalRatings = allReviews.length;

    await course.save();

    res.json({ message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Submit platform review
app.post('/api/submit-platform-review', authenticateToken, async (req, res) => {
  try {
    const { rating, title, content, categories } = req.body;

    const review = new PlatformReview({
      user: req.user.userId,
      rating,
      title,
      content,
      categories
    });

    await review.save();

    res.status(201).json({ message: 'Platform review submitted successfully' });
  } catch (error) {
    console.error('Error submitting platform review:', error);
    res.status(500).json({ error: 'Failed to submit platform review' });
  }
});

// Get approved platform reviews
app.get('/api/platform-reviews', async (req, res) => {
  try {
    const reviews = await PlatformReview.find({ isApproved: true, isPublic: true })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    let filter = {};
    if (role) filter.role = role;
    if (status) filter.isActive = status === 'active';
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve/reject instructor application
app.put('/api/admin/instructor-status', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, status, rejectionReason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.instructorStatus = status;
    user.instructorApplication.reviewedAt = new Date();
    user.instructorApplication.reviewedBy = req.user.userId;
    
    if (status === 'rejected') {
      user.instructorApplication.rejectionReason = rejectionReason;
    }

    await user.save();

    res.json({ message: `Instructor application ${status}` });
  } catch (error) {
    console.error('Error updating instructor status:', error);
    res.status(500).json({ error: 'Failed to update instructor status' });
  }
});

// Get platform statistics (admin only)
app.get('/api/admin/statistics', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalInstructors = await User.countDocuments({ role: 'instructor', instructorStatus: 'approved', isActive: true });
    const pendingInstructors = await User.countDocuments({ role: 'instructor', instructorStatus: 'pending', isActive: true });
    
    const totalCourses = await Course.countDocuments({ status: 'published', isActive: true });
    const totalEnrollments = await Enrollment.countDocuments();
    const completedCourses = await Enrollment.countDocuments({ isCompleted: true });
    const certificatesIssued = await Certificate.countDocuments();
    
    const totalQueries = await Query.countDocuments();
    const openQueries = await Query.countDocuments({ status: 'open' });
    
    const totalReviews = await PlatformReview.countDocuments();
    const approvedReviews = await PlatformReview.countDocuments({ isApproved: true });

    res.json({
      users: {
        total: totalUsers,
        students: totalStudents,
        instructors: totalInstructors,
        pendingInstructors
      },
      courses: {
        total: totalCourses,
        enrollments: totalEnrollments,
        completed: completedCourses,
        completionRate: totalEnrollments > 0 ? Math.round((completedCourses / totalEnrollments) * 100) : 0
      },
      certificates: certificatesIssued,
      queries: {
        total: totalQueries,
        open: openQueries
      },
      reviews: {
        total: totalReviews,
        approved: approvedReviews
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ==================== UTILITY ROUTES ====================

// Get total users count
app.get('/api/total-users', async (req, res) => {
  try {
    const count = await User.countDocuments({ isActive: true });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching user count:', error);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Enhanced LMS Server is running on http://localhost:${PORT}`);
});

module.exports = app;

