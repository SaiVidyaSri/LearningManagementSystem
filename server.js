const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer'); // For file uploads
const fs = require('fs');
const nodemon = require('nodemon'); // For development server restarts
const nodemailer = require('nodemailer'); // For email functionality
const crypto = require('crypto'); // For generating reset tokens
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Review = require('./models/Review');
const Certificate = require('./models/Certificate');
const Query = require('./models/Query');

const app = express();
const PORT = process.env.PORT || 5001;

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// ADMIN CREDENTIALS - FIXED CREDENTIALS FOR ADMIN LOGIN
const ADMIN_CREDENTIALS = {
  email: 'admin@learnova.com',
  password: 'admin123'
};

// Email Configuration - CONFIGURED WITH YOUR GMAIL CREDENTIALS
const EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'learn.learnova@gmail.com',
    pass: 'xtvt klvd gnna lztl'
  }
};

// Create email transporter
let emailTransporter = null;

// Initialize email transporter
function initializeEmail() {
  try {
    emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
    
    // Verify email configuration
    emailTransporter.verify((error, success) => {
      if (error) {
        console.log('❌ Email configuration error:', error.message);
        console.log('📧 Please update EMAIL_CONFIG in server.js with your email credentials');
      } else {
        console.log('✅ Email server is ready to send messages');
      }
    });
  } catch (error) {
    console.log('❌ Failed to initialize email:', error.message);
  }
}

// In-memory storage for reset tokens (in production, use Redis or database)
const resetTokens = new Map();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of resetTokens.entries()) {
    if (now > value.expiresAt) {
      resetTokens.delete(key);
    }
  }
}, 3600000); // 1 hour

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve logo
app.get('/path/to/your/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
      <rect width="120" height="40" rx="5" fill="#667eea"/>
      <text x="60" y="25" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">LearNova</text>
    </svg>
  `);
});

app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
      <rect width="120" height="40" rx="5" fill="#667eea"/>
      <text x="60" y="25" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">LearNova</text>
    </svg>
  `);
});

// Serve default course image
app.get('/default-course-image.jpg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)"/>
      <circle cx="200" cy="120" r="40" fill="white" opacity="0.9"/>
      <rect x="160" y="180" width="80" height="60" rx="8" fill="white" opacity="0.9"/>
      <text x="200" y="260" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">📚 Course Image</text>
    </svg>
  `);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;
    
    // Create subdirectories based on file type
    if (file.fieldname === 'courseImage') {
      uploadPath = path.join(uploadsDir, 'course-images');
    } else if (file.fieldname === 'previewVideo') {
      uploadPath = path.join(uploadsDir, 'preview-videos');
    } else if (file.fieldname.startsWith('lessonResource')) {
      uploadPath = path.join(uploadsDir, 'lesson-resources');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow specific file types
    const allowedTypes = {
      'courseImage': /jpeg|jpg|png|gif/,
      'previewVideo': /mp4|avi|mov|wmv/,
      'lessonResource': /pdf|doc|docx|ppt|pptx|zip|txt|xls|xlsx/
    };
    
    let fieldType = 'lessonResource'; // default
    if (file.fieldname === 'courseImage') fieldType = 'courseImage';
    else if (file.fieldname === 'previewVideo') fieldType = 'previewVideo';
    else if (file.fieldname.startsWith('lessonResource')) fieldType = 'lessonResource';
    
    const extname = allowedTypes[fieldType].test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes[fieldType].test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${fieldType}`));
    }
  }
});

// MongoDB connection with multiple fallback options
const MONGODB_ATLAS_URI = "mongodb+srv://vidyadonthagani:vidya2004@cluster0.acdpvpq.mongodb.net/lms?retryWrites=true&w=majority&appName=Cluster0";
const MONGODB_LOCAL_URI = "mongodb://localhost:27017/lms";

// Try multiple connection strategies
async function connectToMongoDB() {
  const connectionOptions = {
    serverSelectionTimeoutMS: 5000, // Reduced timeout for faster fallback
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 1, // Reduced for better resource management
    maxIdleTimeMS: 30000,
    heartbeatFrequencyMS: 10000,
    family: 4 // Use IPv4
  };

  console.log('🔄 Attempting to connect to MongoDB...');
  
  // First try: Atlas with reduced timeout
  try {
    console.log('📡 Trying MongoDB Atlas connection...');
    await mongoose.connect(MONGODB_ATLAS_URI, {
      ...connectionOptions,
      serverSelectionTimeoutMS: 8000 // Give Atlas a bit more time
    });
    console.log('✅ Successfully connected to MongoDB Atlas!');
    return;
  } catch (atlasError) {
    console.log('❌ Atlas connection failed:', atlasError.message);
    console.log('🔄 Trying local MongoDB connection...');
    
    // Second try: Local MongoDB
    try {
      await mongoose.connect(MONGODB_LOCAL_URI, {
        ...connectionOptions,
        serverSelectionTimeoutMS: 3000 // Faster timeout for local
      });
      console.log('✅ Successfully connected to local MongoDB!');
      return;
    } catch (localError) {
      console.log('❌ Local MongoDB connection failed:', localError.message);
    }
  }
  
  // If both fail, continue without database
  console.log('⚠️  Running without database connection');
  console.log('📝 Server will continue with limited functionality');
  console.log('🔧 Database connection solutions:');
  console.log('   1. Check your internet connection');
  console.log('   2. Verify MongoDB Atlas cluster is running');
  console.log('   3. Install local MongoDB: https://www.mongodb.com/try/download/community');
  console.log('   4. Update MongoDB Atlas IP whitelist');
}

// Start connection attempt
connectToMongoDB();

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
  // Initialize email functionality
  initializeEmail();
  // Run certificate test after connection is established
  setTimeout(ensureTestCertificate, 3000);
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Database connection middleware - Enhanced for better user experience
function checkDatabaseConnection(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    console.log(`⚠️  Database not connected for ${req.method} ${req.path}`);
    
    // For API endpoints, return detailed error
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({ 
        error: 'Database service temporarily unavailable',
        connectionState: mongoose.connection.readyState,
        message: 'The application is running but database connectivity is experiencing issues. Some features may be limited.',
        solutions: [
          'Check your internet connection',
          'Verify MongoDB Atlas cluster status',
          'Contact system administrator',
          'Try again in a few moments'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    // For HTML pages, allow them to load (they can show connection status)
    return next();
  }
  next();
}

// Enhanced error handler middleware
function handleDatabaseError(error, req, res, next) {
  console.error('Database operation error:', error);
  
  if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
    return res.status(503).json({ 
      error: 'Database connection timeout',
      details: 'The database is currently experiencing connectivity issues. Please try again later.'
    });
  }
  
  if (error.name === 'MongoTimeoutError' || error.message.includes('timed out')) {
    return res.status(503).json({ 
      error: 'Database query timeout',
      details: 'The query took too long to execute. Please try again.'
    });
  }
  
  if (error.name === 'MongoNetworkError') {
    return res.status(503).json({ 
      error: 'Database network error',
      details: 'Unable to connect to the database. Please try again later.'
    });
  }
  
  // Generic database error
  if (error.name && error.name.includes('Mongo')) {
    return res.status(503).json({ 
      error: 'Database error',
      details: 'A database error occurred. Please try again later.'
    });
  }
  
  next(error);
}

// Handle application termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to application termination');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

// Helper function to find course by ID or name, prioritizing user enrollments
async function findCourseForUser(courseId, userId = null) {
  let course;
  
  if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
    // It's an ObjectId
    course = await Course.findById(courseId);
  } else {
    // It's a course name
    const decodedName = decodeURIComponent(courseId);
    
    if (userId) {
      // Try to find courses with this name that the user is enrolled in
      const userEnrollments = await Enrollment.find({ student: userId }).populate('course');
      const enrolledCourse = userEnrollments.find(enrollment => 
        enrollment.course && enrollment.course.name === decodedName
      );
      
      if (enrolledCourse) {
        // User is enrolled in a course with this name, use that one
        course = enrolledCourse.course;
      }
    }
    
    if (!course) {
      // Fallback to finding any published course with this name
      // Priority: published > pending > draft
      course = await Course.findOne({ 
        name: decodedName,
        status: 'published'
      });
      
      // If no published course, try pending/draft as fallback
      if (!course) {
        course = await Course.findOne({ 
          name: decodedName
        }).sort({ status: 1, createdAt: -1 }); // Sort by status then newest first
      }
    }
  }
  
  return course;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    server: 'running',
    database: {
      state: connectionStates[dbState] || 'unknown',
      connected: isHealthy,
      name: mongoose.connection.name || 'none'
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Database status endpoint for frontend
app.get('/api/db-status', (req, res) => {
  const connectionStates = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const dbState = mongoose.connection.readyState;
  
  res.json({
    connected: dbState === 1,
    state: connectionStates[dbState] || 'unknown',
    message: dbState === 1 
      ? 'Database connection is healthy' 
      : 'Database connection issues - some features may be limited',
    timestamp: new Date().toISOString()
  });
});

// MIDDLEWARE: Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('Token verified for user:', decoded.id, 'role:', decoded.role);
    next();
  } catch (error) {
    console.log('Invalid token:', error.message);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// MIDDLEWARE: Verify JWT token (supports both header and query parameter for certificate access)
const verifyTokenForCertificate = (req, res, next) => {
  let token = req.header('Authorization')?.replace('Bearer ', '');
  
  // If no header token, try query parameter
  if (!token) {
    token = req.query.token;
  }
  
  if (!token) {
    console.log('No token provided for certificate access');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('Certificate token verified for user:', decoded.id, 'role:', decoded.role);
    next();
  } catch (error) {
    console.log('Invalid certificate token:', error.message);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// MIDDLEWARE: Verify admin role
const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// MIDDLEWARE: Verify instructor role
const verifyInstructor = (req, res, next) => {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Access denied. Instructor role required.' });
  }
  next();
};

// EXISTING: User registration endpoint
app.post('/api/register', async (req, res) => {
  console.log('Received registration request with body:', req.body);
  const { username: fullName, email, password, role, instructorApplication } = req.body;
  
  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }
  
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      instructorApplication: role === 'instructor' ? instructorApplication : undefined
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!' });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// MODIFIED: Login endpoint with admin support
app.post('/api/login', async (req, res) => {
  console.log('Received login request with body:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email and password.' });
  }

  try {
    // CHECK FOR ADMIN LOGIN FIRST
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const token = jwt.sign(
        { 
          id: 'admin', 
          email: ADMIN_CREDENTIALS.email, 
          role: 'admin' 
        }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        message: 'Admin login successful!',
        user: {
          id: 'admin',
          username: 'Admin',
          fullName: 'System Administrator',
          email: ADMIN_CREDENTIALS.email,
          role: 'admin'
        },
        token
      });
    }

    // REGULAR USER LOGIN
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user._id,
        username: user.fullName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        instructorStatus: user.instructorStatus
      },
      token
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Password Reset Endpoints

// Send reset code via email
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({ message: 'Email and user type are required.' });
    }

    // Check if user exists
    const user = await User.findOne({ email, role: userType });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store reset code with expiration (10 minutes)
    const resetKey = `${email}_${userType}`;
    resetTokens.set(resetKey, {
      code: resetCode,
      email: email,
      userType: userType,
      expiresAt: Date.now() + 600000 // 10 minutes
    });

    // Send email with reset code
    if (emailTransporter) {
      const mailOptions = {
        from: {
          name: 'LearNova Support',
          address: EMAIL_CONFIG.auth.user
        },
        to: email,
        subject: 'Password Reset Code - LearNova',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">LearNova Learning Management System</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                We received a request to reset your password for your ${userType} account. Use the verification code below to reset your password:
              </p>
              
              <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace;">
                  ${resetCode}
                </div>
                <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">This code will expire in 10 minutes</p>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-top: 20px;">
                If you're having trouble, please contact our support team at <a href="mailto:${EMAIL_CONFIG.auth.user}" style="color: #667eea;">${EMAIL_CONFIG.auth.user}</a>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>© 2025 LearNova Learning Management System. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(mailOptions);
      console.log(`✅ Reset code sent to ${email} (${userType})`);
    } else {
      console.log(`⚠️ Email not configured. Reset code for ${email}: ${resetCode}`);
    }

    res.json({ 
      message: 'Reset code sent to your email address.',
      // For testing purposes only - remove in production
      ...(process.env.NODE_ENV !== 'production' && { testCode: resetCode })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset code. Please try again.' });
  }
});

// Verify reset code
app.post('/api/verify-reset-code', async (req, res) => {
  try {
    const { email, code, userType } = req.body;

    if (!email || !code || !userType) {
      return res.status(400).json({ message: 'Email, code, and user type are required.' });
    }

    const resetKey = `${email}_${userType}`;
    const resetData = resetTokens.get(resetKey);

    if (!resetData) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    if (Date.now() > resetData.expiresAt) {
      resetTokens.delete(resetKey);
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    if (resetData.code !== code) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    // Generate reset token for password change
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Update reset data with token (extend expiration to 15 minutes for password reset)
    resetTokens.set(resetKey, {
      ...resetData,
      resetToken: resetToken,
      verified: true,
      expiresAt: Date.now() + 900000 // 15 minutes
    });

    res.json({ 
      message: 'Code verified successfully.',
      resetToken: resetToken
    });

  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ message: 'Failed to verify code. Please try again.' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword, userType } = req.body;

    if (!email || !resetToken || !newPassword || !userType) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const resetKey = `${email}_${userType}`;
    const resetData = resetTokens.get(resetKey);

    if (!resetData || !resetData.verified || resetData.resetToken !== resetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    if (Date.now() > resetData.expiresAt) {
      resetTokens.delete(resetKey);
      return res.status(400).json({ message: 'Reset token has expired. Please start over.' });
    }

    // Find user and update password
    const user = await User.findOne({ email, role: userType });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Clean up reset token
    resetTokens.delete(resetKey);

    // Send confirmation email
    if (emailTransporter) {
      const mailOptions = {
        from: {
          name: 'LearNova Support',
          address: EMAIL_CONFIG.auth.user
        },
        to: email,
        subject: 'Password Reset Successful - LearNova',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">✅ Password Reset Successful</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">LearNova Learning Management System</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Password Successfully Updated</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Your password has been successfully reset for your ${userType} account. You can now log in with your new password.
              </p>
              
              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #155724; margin: 0; font-size: 14px;">
                  <strong>Security Tip:</strong> For your account security, make sure to use a strong, unique password and keep it confidential.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${req.protocol}://${req.get('host')}/login.html" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Login to Your Account
                </a>
              </div>
              
              <p style="color: #666; line-height: 1.6; margin-top: 20px;">
                If you didn't make this change or have any concerns, please contact our support team immediately at <a href="mailto:${EMAIL_CONFIG.auth.user}" style="color: #667eea;">${EMAIL_CONFIG.auth.user}</a>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>© 2025 LearNova Learning Management System. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(mailOptions);
    }

    console.log(`✅ Password reset successful for ${email} (${userType})`);

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message, newsletter } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Send email to admin
    if (emailTransporter) {
      const mailOptions = {
        from: {
          name: 'LearNova Contact Form',
          address: EMAIL_CONFIG.auth.user
        },
        to: 'learn.learnova@gmail.com',
        subject: `New Contact Form Submission: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">📧 New Contact Form Message</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">LearNova Learning Management System</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Contact Details</h2>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #667eea;">Name:</strong> <span style="color: #333;">${name}</span>
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #667eea;">Email:</strong> <span style="color: #333;">${email}</span>
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #667eea;">Subject:</strong> <span style="color: #333;">${subject}</span>
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #667eea;">Newsletter Subscription:</strong> <span style="color: #333;">${newsletter ? 'Yes' : 'No'}</span>
              </div>
              
              <div style="margin-top: 25px;">
                <strong style="color: #667eea;">Message:</strong>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px; border-left: 4px solid #667eea;">
                  <p style="color: #333; margin: 0; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
                </div>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  This message was sent from the LearNova contact form.<br>
                  Please reply directly to: ${email}
                </p>
              </div>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(mailOptions);
      
      // Send confirmation email to user
      const confirmationMailOptions = {
        from: {
          name: 'LearNova Support',
          address: EMAIL_CONFIG.auth.user
        },
        to: email,
        subject: 'Thank you for contacting LearNova',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">✅ Message Received</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">LearNova Learning Management System</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Thank you for reaching out!</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Hi ${name},<br><br>
                We have received your message regarding "${subject}" and will get back to you within 24 hours.
              </p>
              
              <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #155724; margin: 0; font-size: 14px;">
                  <strong>Your Message:</strong><br>
                  ${message.replace(/\n/g, '<br>')}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://learnova.com" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Visit LearNova
                </a>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  Best regards,<br>
                  The LearNova Team
                </p>
              </div>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(confirmationMailOptions);
    }
    
    console.log(`📧 Contact form submission from ${email}: ${subject}`);
    
    res.json({ 
      message: 'Thank you for your message! We\'ll get back to you within 24 hours.',
      success: true 
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// NEW: Admin statistics endpoint
app.get('/api/admin/statistics', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const students = await User.countDocuments({ role: 'student' });
    const instructors = await User.countDocuments({ role: 'instructor', instructorStatus: 'approved' });
    const pendingInstructors = await User.countDocuments({ role: 'instructor', instructorStatus: 'pending' });

    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ status: 'published' });
    const pendingCourses = await Course.countDocuments({ status: 'pending' });
    const rejectedCourses = await Course.countDocuments({ status: 'rejected' });
    const draftCourses = await Course.countDocuments({ status: 'draft' });
    const totalEnrollments = await Enrollment.countDocuments();
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });
    const certificatesIssued = await Certificate.countDocuments();
    const openQueries = await Query.countDocuments({ status: { $in: ['open', 'in-progress'] } });
    const totalReviews = await Review.countDocuments();

    const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

    const stats = {
      users: {
        total: totalUsers,
        students: students,
        instructors: instructors,
        pendingInstructors: pendingInstructors
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
        pending: pendingCourses,
        rejected: rejectedCourses,
        draft: draftCourses,
        enrollments: totalEnrollments,
        completed: completedEnrollments,
        completionRate: completionRate
      },
      certificates: certificatesIssued,
      queries: {
        open: openQueries
      },
      reviews: {
        total: totalReviews
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// NEW: Get all users with filtering
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role, status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (status && role === 'instructor') query.instructorStatus = status;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// NEW: Update instructor status (approve/reject)
app.put('/api/admin/instructor-status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId, status, rejectionReason } = req.body;

    if (!userId || !status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const updateData = { instructorStatus: status };
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `Instructor application ${status} successfully`,
      user
    });

  } catch (error) {
    console.error('Error updating instructor status:', error);
    res.status(500).json({ error: 'Failed to update instructor status' });
  }
});

// NEW: Get all instructors
app.get('/api/admin/instructors', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = { role: 'instructor' };
    if (status) query.instructorStatus = status;

    const instructors = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(instructors);
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({ error: 'Failed to fetch instructors' });
  }
});

// Get all courses for admin (including pending, draft, etc.)
app.get('/api/admin/courses', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, category, level, instructor, search, page = 1, limit = 12 } = req.query;
    
    let query = {}; // No status filter - show all courses
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (level) query.level = level;
    if (instructor) query.instructor = instructor;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('instructor', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching admin courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Approve/Reject courses
app.put('/api/admin/courses/:courseId/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status } = req.body;

    if (!['published', 'pending', 'draft', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const course = await Course.findByIdAndUpdate(
      courseId,
      { status, approvedAt: status === 'published' ? new Date() : null },
      { new: true }
    ).populate('instructor', 'fullName');

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error updating course status:', error);
    res.status(500).json({ error: 'Failed to update course status' });
  }
});

// NEW: Delete user (admin only)
app.delete('/api/admin/users/:userId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== COURSE MANAGEMENT ENDPOINTS ====================

// Get all courses (public endpoint with filtering)
app.get('/api/courses', async (req, res) => {
  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection not available',
        connectionState: mongoose.connection.readyState 
      });
    }

    const { category, level, instructor, search, page = 1, limit = 12 } = req.query;
    
    let query = { status: 'published' };
    
    if (category) query.category = category;
    if (level) query.level = level;
    if (instructor) query.instructor = instructor;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } }
      ];
    }

    // Add timeout option and execute with retries
    const findOperation = Course.find(query)
      .populate('instructor', 'fullName')
      .select('-modules -quizzes -finalExam')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .maxTimeMS(10000); // 10 second timeout

    const countOperation = Course.countDocuments(query).maxTimeMS(5000); // 5 second timeout

    const [courses, total] = await Promise.all([findOperation, countOperation]);

    res.json({
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    
    // Provide specific error handling
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        error: 'Database connection timeout - please try again later',
        details: 'The database is currently experiencing connectivity issues'
      });
    }
    
    if (error.name === 'MongoTimeoutError' || error.message.includes('timed out')) {
      return res.status(503).json({ 
        error: 'Database query timeout - please try again',
        details: 'The query took too long to execute'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      details: error.message 
    });
  }
});

// Get course details by ID or name
app.get('/api/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    let course;
    
    console.log('=== COURSE DETAILS REQUEST ===');
    console.log('Raw courseId parameter:', courseId);
    console.log('Decoded courseId:', decodeURIComponent(courseId));
    console.log('Is ObjectId?', courseId.match(/^[0-9a-fA-F]{24}$/));
    
    // Check if courseId is a MongoDB ObjectId or a course name
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId
      console.log('Searching by ObjectId...');
      course = await Course.findById(courseId)
        .populate('instructor', 'fullName email');
      console.log('Found course by ID:', course ? `${course.name} (Status: ${course.status})` : 'Not found');
    } else {
      // It's a course name - use enhanced lookup to prioritize published courses
      const decodedName = decodeURIComponent(courseId);
      console.log('Searching by name:', decodedName);
      
      // First, try to find a published course with this name
      course = await Course.findOne({ 
        name: decodedName,
        status: 'published'
      }).populate('instructor', 'fullName email');
      
      console.log('Found published course:', course ? `${course.name} (ID: ${course._id}, ${course.modules?.length} modules)` : 'None');
      
      // If no published course found, try any course with this name
      if (!course) {
        course = await Course.findOne({ name: decodedName })
          .populate('instructor', 'fullName email');
        console.log('Fallback course found:', course ? `${course.name} (ID: ${course._id}, Status: ${course.status})` : 'None');
      }
    }

    if (!course) {
      console.log('❌ Course not found for parameter:', courseId);
      return res.status(404).json({ error: 'Course not found' });
    }

    console.log('✅ Returning course:', course.name, 'ID:', course._id, 'Status:', course.status);
    console.log('=== END COURSE DETAILS REQUEST ===');
    res.json(course);
  } catch (error) {
    console.error('❌ Error fetching course details:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

// ENHANCED: Create new course with file upload support (instructor only)
app.post('/api/courses', verifyToken, verifyInstructor, upload.any(), async (req, res) => {
  try {
    console.log('🚀 Course creation request received');
    console.log('User ID:', req.user.id);
    console.log('User role:', req.user.role);
    
    // Handle both JSON and FormData
    let courseData;
    
    if (req.body.courseData) {
      // If courseData is sent as a string (from FormData)
      courseData = JSON.parse(req.body.courseData);
    } else {
      // If sent as direct JSON
      courseData = req.body;
    }

    console.log('📝 Received course data summary:');
    console.log('- Name:', courseData.name);
    console.log('- Category:', courseData.category);
    console.log('- Status:', courseData.status);
    console.log('- Modules count:', courseData.modules ? courseData.modules.length : 0);

    // Add instructor information
    courseData.instructor = req.user.id;
    courseData.instructorName = req.user.fullName || 'Unknown Instructor';
    
    // Set default status if not provided
    if (!courseData.status) {
      courseData.status = 'draft'; // Changed from 'published' to 'draft'
      console.log('⚠️ No status provided, defaulting to draft');
    }

    // Debug: Log the incoming course data
    console.log('📊 Full course data:', JSON.stringify(courseData, null, 2));

    // ENHANCED: Clean up course data before processing
    if (courseData.modules) {
      courseData.modules = courseData.modules.map(module => {
        if (module.lessons) {
          module.lessons = module.lessons.map(lesson => {
            // Clean up examination data
            if (lesson.examination && lesson.examination.questions) {
              // Filter out invalid questions
              const validQuestions = lesson.examination.questions.filter(q => {
                return q && 
                       q.question && 
                       typeof q.question === 'string' && 
                       q.question.trim() && 
                       q.correctAnswer !== null &&
                       q.correctAnswer !== undefined &&
                       typeof q.correctAnswer === 'string' &&
                       q.correctAnswer.trim();
              });
              
              // If no valid questions, disable the exam
              if (validQuestions.length === 0) {
                lesson.examination = {
                  isEnabled: false,
                  title: '',
                  description: '',
                  timeLimit: 30,
                  passingScore: 70,
                  maxAttempts: 3,
                  questions: []
                };
              } else {
                lesson.examination.questions = validQuestions;
                lesson.examination.isEnabled = true;
              }
            }
            return lesson;
          });
        }
        return module;
      });
    }

    // Similar cleanup for finalExam
    if (courseData.finalExam && courseData.finalExam.questions) {
      const validFinalExamQuestions = courseData.finalExam.questions.filter(q => {
        return q && 
               q.question && 
               typeof q.question === 'string' && 
               q.question.trim() && 
               q.correctAnswer !== null &&
               q.correctAnswer !== undefined &&
               typeof q.correctAnswer === 'string' &&
               q.correctAnswer.trim();
      });
      
      if (validFinalExamQuestions.length === 0) {
        courseData.finalExam.isEnabled = false;
        courseData.finalExam.questions = [];
      } else {
        courseData.finalExam.questions = validFinalExamQuestions;
      }
    }

    console.log('Cleaned course data:', JSON.stringify(courseData, null, 2));

    // Ensure modules array exists and has proper structure
    if (!courseData.modules) {
      courseData.modules = [];
    }

    // Handle uploaded files
    const uploadedFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        uploadedFiles[file.fieldname] = {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          url: `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`
        };
      });
    }

    // Set course image and preview video URLs
    if (uploadedFiles.courseImage) {
      courseData.image = uploadedFiles.courseImage.url;
    }
    if (uploadedFiles.previewVideo) {
      courseData.previewVideo = uploadedFiles.previewVideo.url;
    }

    // Process modules to ensure proper structure and handle resource uploads
    courseData.modules = courseData.modules.map((module, moduleIndex) => {
      const processedModule = {
        title: module.title || `Module ${moduleIndex + 1}`,
        description: module.description || '',
        order: module.order || moduleIndex + 1,
        estimatedDuration: module.estimatedDuration || 60,
        lessons: (module.lessons || []).map((lesson, lessonIndex) => {
          const processedLesson = {
            title: lesson.title || `Lesson ${lessonIndex + 1}`,
            description: lesson.description || '',
            type: lesson.type || 'video',
            content: lesson.content || '',
            duration: lesson.duration || 10,
            order: lesson.order || lessonIndex + 1,
            isPreview: lesson.isPreview || false,
            examination: {
              title: '',
              description: '',
              timeLimit: 30,
              passingScore: 70,
              questions: [],
              isEnabled: false
            },
            resources: []
          };

          // Process examination if provided - data should already be cleaned
          if (lesson.examination && lesson.examination.isEnabled && lesson.examination.questions && lesson.examination.questions.length > 0) {
            processedLesson.examination = {
              isEnabled: true,
              title: lesson.examination.title || 'Lesson Quiz',
              description: lesson.examination.description || '',
              timeLimit: lesson.examination.timeLimit || 30,
              passingScore: lesson.examination.passingScore || 70,
              maxAttempts: lesson.examination.maxAttempts || 3,
              questions: lesson.examination.questions
            };
          }

          // Handle lesson resource uploads
          if (lesson.resources && lesson.resources.length > 0) {
            lesson.resources.forEach((resource, resourceIndex) => {
              const resourceFieldName = `lessonResource_${moduleIndex}_${lessonIndex}_${resourceIndex}`;
              if (uploadedFiles[resourceFieldName]) {
                const uploadedResource = uploadedFiles[resourceFieldName];
                processedLesson.resources.push({
                  name: uploadedResource.originalname,
                  type: uploadedResource.mimetype,
                  size: formatFileSize(uploadedResource.size),
                  url: uploadedResource.url,
                  uploadDate: new Date()
                });
              } else if (resource.name && !resource.file) {
                // Keep existing resource data if no new file was uploaded
                processedLesson.resources.push(resource);
              }
            });
          }

          return processedLesson;
        }),
        materials: module.materials || [],
        assignments: module.assignments || []
      };

      return processedModule;
    });

    // Calculate estimated hours based on modules
    if (!courseData.estimatedHours && courseData.modules.length > 0) {
      courseData.estimatedHours = courseData.modules.reduce((total, module) => {
        return total + (module.estimatedDuration || 60);
      }, 0) / 60; // Convert minutes to hours
    }

    // Validate final exam if enabled
    if (courseData.finalExam && courseData.finalExam.isEnabled) {
      if (!courseData.finalExam.questions || courseData.finalExam.questions.length === 0) {
        courseData.finalExam.isEnabled = false;
        courseData.finalExam.questions = [];
      }
    }

    const course = new Course(courseData);
    console.log('💾 Saving course to database...');
    await course.save();
    console.log('✅ Course saved successfully with ID:', course._id);

    res.status(201).json({
      message: 'Course created successfully!',
      course: {
        _id: course._id,
        name: course.name,
        status: course.status,
        instructor: course.instructor
      },
      uploadedFiles: Object.keys(uploadedFiles)
    });
  } catch (error) {
    console.error('❌ Error creating course:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create course', 
      message: error.message,
      details: error.toString()
    });
  }
});

// ENHANCED: Update course with file upload support (instructor only - own courses)
app.put('/api/courses/:courseId', verifyToken, verifyInstructor, upload.any(), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findOne({ _id: courseId, instructor: req.user.id });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    // Handle both JSON and FormData
    let updateData;
    
    if (req.body.courseData) {
      // If courseData is sent as a string (from FormData)
      updateData = JSON.parse(req.body.courseData);
    } else {
      // If sent as direct JSON
      updateData = req.body;
    }

    // Handle uploaded files
    const uploadedFiles = {};
    if (req.files) {
      req.files.forEach(file => {
        uploadedFiles[file.fieldname] = {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          url: `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`
        };
      });
    }

    // Update course image and preview video URLs if new files were uploaded
    if (uploadedFiles.courseImage) {
      updateData.image = uploadedFiles.courseImage.url;
    }
    if (uploadedFiles.previewVideo) {
      updateData.previewVideo = uploadedFiles.previewVideo.url;
    }

    // Process modules to ensure proper structure if modules are being updated
    if (updateData.modules) {
      updateData.modules = updateData.modules.map((module, moduleIndex) => {
        const processedModule = {
          title: module.title || `Module ${moduleIndex + 1}`,
          description: module.description || '',
          order: module.order || moduleIndex + 1,
          estimatedDuration: module.estimatedDuration || 60,
          lessons: (module.lessons || []).map((lesson, lessonIndex) => {
            const processedLesson = {
              title: lesson.title || `Lesson ${lessonIndex + 1}`,
              description: lesson.description || '',
              type: lesson.type || 'video',
              content: lesson.content || '',
              duration: lesson.duration || 10,
              order: lesson.order || lessonIndex + 1,
              isPreview: lesson.isPreview || false,
              examination: lesson.examination || {
                title: '',
                description: '',
                timeLimit: 30,
                passingScore: 70,
                questions: [],
                isEnabled: false
              },
              resources: lesson.resources || []
            };

            // Enable examination if it has questions
            if (processedLesson.examination.questions && processedLesson.examination.questions.length > 0) {
              processedLesson.examination.isEnabled = true;
            }

            // Handle lesson resource uploads for updates
            if (lesson.resources && lesson.resources.length > 0) {
              const updatedResources = [];
              lesson.resources.forEach((resource, resourceIndex) => {
                const resourceFieldName = `lessonResource_${moduleIndex}_${lessonIndex}_${resourceIndex}`;
                if (uploadedFiles[resourceFieldName]) {
                  const uploadedResource = uploadedFiles[resourceFieldName];
                  updatedResources.push({
                    name: uploadedResource.originalname,
                    type: uploadedResource.mimetype,
                    size: formatFileSize(uploadedResource.size),
                    url: uploadedResource.url,
                    uploadDate: new Date()
                  });
                } else if (resource.name && !resource.file) {
                  // Keep existing resource data if no new file was uploaded
                  updatedResources.push(resource);
                }
              });
              processedLesson.resources = updatedResources;
            }

            return processedLesson;
          }),
          materials: module.materials || [],
          assignments: module.assignments || []
        };

        return processedModule;
      });

      // Recalculate estimated hours based on updated modules
      updateData.estimatedHours = updateData.modules.reduce((total, module) => {
        return total + (module.estimatedDuration || 60);
      }, 0) / 60;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Course updated successfully!',
      course: updatedCourse,
      uploadedFiles: Object.keys(uploadedFiles)
    });

  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course', details: error.message });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get instructor's courses
app.get('/api/instructor/courses', verifyToken, verifyInstructor, async (req, res) => {
  try {
    // Only select fields needed for dashboard, including image
    const courses = await Course.find({ instructor: req.user.id })
      .select('name _id image imageUrl description category level estimatedHours status enrollmentCount averageRating totalRatings completionRate createdAt')
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching instructor courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Alternative endpoint for instructor courses (for compatibility)
app.get('/api/instructor-courses', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user.id })
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching instructor courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get instructor's queries/Q&A
app.get('/api/instructor-queries', verifyToken, verifyInstructor, async (req, res) => {
  try {
    // Get instructor's courses
    const instructorCourses = await Course.find({ instructor: req.user.id }).select('_id');
    const courseIds = instructorCourses.map(course => course._id);
    
    // Get queries for instructor's courses
    const queries = await Query.find({ course: { $in: courseIds } })
      .populate('student', 'fullName email')
      .populate('course', 'name')
      .populate('responses.responder', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(queries);
  } catch (error) {
    console.error('Error fetching instructor queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// NEW: Get student's queries (for student dashboard)
app.get('/api/student-queries', verifyToken, async (req, res) => {
  try {
    const queries = await Query.find({ student: req.user.id })
      .populate('course', 'name')
      .populate('instructor', 'fullName')
      .populate('responses.responder', 'fullName')
      .sort({ createdAt: -1 });

    res.json(queries);
  } catch (error) {
    console.error('Error fetching student queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// NEW: Submit a new query (student)
app.post('/api/queries', verifyToken, async (req, res) => {
  try {
    const { courseId, subject, description, category } = req.body;

    if (!courseId || !subject || !description) {
      return res.status(400).json({ error: 'Course ID, subject, and description are required' });
    }

    // Verify the course exists and student is enrolled
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course to ask questions' });
    }

    const query = new Query({
      student: req.user.id,
      course: courseId,
      instructor: course.instructor,
      subject: subject.trim(),
      description: description.trim(),
      category: category || 'general',
      status: 'open',
      createdAt: new Date()
    });

    await query.save();

    // Populate the response
    await query.populate('course', 'name');
    await query.populate('instructor', 'fullName');

    res.status(201).json({
      message: 'Query submitted successfully',
      query
    });

  } catch (error) {
    console.error('Error submitting query:', error);
    res.status(500).json({ error: 'Failed to submit query' });
  }
});

// NEW: Answer a query (instructor)
app.post('/api/queries/:queryId/answer', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const { queryId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Answer content is required' });
    }

    const query = await Query.findById(queryId)
      .populate('course', 'name instructor');

    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Verify the instructor owns the course
    if (query.course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add response to the query
    const response = {
      responder: req.user.id,
      responderName: req.user.fullName || 'Instructor',
      responderRole: 'instructor',
      message: message.trim(),
      respondedAt: new Date()
    };

    query.responses.push(response);
    query.status = 'resolved';
    query.lastResponseAt = new Date();

    await query.save();

    res.json({
      message: 'Query answered successfully',
      query
    });

  } catch (error) {
    console.error('Error answering query:', error);
    res.status(500).json({ error: 'Failed to answer query' });
  }
});

// NEW: Update query status
app.put('/api/queries/:queryId/status', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const { queryId } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const query = await Query.findById(queryId)
      .populate('course', 'name instructor');

    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Verify the instructor owns the course
    if (query.course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    query.status = status;
    query.updatedAt = new Date();

    await query.save();

    res.json({
      message: 'Query status updated successfully',
      query
    });

  } catch (error) {
    console.error('Error updating query status:', error);
    res.status(500).json({ error: 'Failed to update query status' });
  }
});

// NEW: Get queries for a specific course
app.get('/api/courses/:courseId/queries', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Find course by ID or name
    const course = await findCourseForUser(courseId, req.user.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if user has access to this course
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id
    });

    if (!enrollment && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const queries = await Query.find({ course: course._id })
      .populate('student', 'fullName')
      .populate('instructor', 'fullName')
      .sort({ createdAt: -1 });

    res.json(queries);

  } catch (error) {
    console.error('Error fetching course queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// TEST: Simple test endpoint
app.get('/api/instructor/test', verifyToken, verifyInstructor, (req, res) => {
  res.json({ message: 'Test endpoint working', user: req.user });
});

// NEW: Get instructor's students with detailed statistics
app.get('/api/instructor/students', verifyToken, verifyInstructor, async (req, res) => {
  // Enhanced: Robust, clear, and complete students endpoint for instructor
  try {
    // 1. Get all courses for this instructor
    const instructorCourses = await Course.find({ instructor: req.user.id });
    if (!instructorCourses || instructorCourses.length === 0) {
      // No courses for this instructor
      return res.json([]);
    }
    const courseIds = instructorCourses.map(course => course._id);

    // 2. Get all enrollments for these courses
    const enrollments = await Enrollment.find({ course: { $in: courseIds } })
      .populate('student', 'fullName email createdAt lastActiveAt')
      .populate({
        path: 'course',
        select: 'name estimatedHours modules',
      })
      .sort({ enrolledAt: -1 });

    if (!enrollments || enrollments.length === 0) {
      // No students enrolled in instructor's courses
      return res.json([]);
    }

    // 3. Group enrollments by student
    const studentMap = new Map();
    for (const enrollment of enrollments) {
      if (!enrollment.student || !enrollment.course) continue; // Defensive
      const studentId = enrollment.student._id.toString();
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          student: enrollment.student,
          enrollments: [],
          totalCourses: 0,
          completedCourses: 0,
          failedCourses: 0,
          certificatesEarned: 0,
          totalProgress: 0,
          lastActive: enrollment.student.lastActiveAt || enrollment.enrolledAt,
          enrolledAt: enrollment.enrolledAt
        });
      }
      const studentData = studentMap.get(studentId);
      // Calculate course statistics
      // Calculate correct progress based on completed lessons
      let totalLessons = 0;
      let completedLessons = 0;
      let lessonExams = [];
      if (enrollment.course && enrollment.course.modules) {
        enrollment.course.modules.forEach((mod, mIdx) => {
          if (mod.lessons) {
            mod.lessons.forEach((lesson, lIdx) => {
              totalLessons++;
              // Find lesson progress
              let moduleProgress = (enrollment.progress?.modules || []).find(m => m.moduleId?.toString() === mod._id?.toString());
              let lessonProgress = moduleProgress && moduleProgress.lessons ? moduleProgress.lessons.find(l => l.lessonId?.toString() === lesson._id?.toString()) : null;
              if (lessonProgress && lessonProgress.completed) completedLessons++;
              // Collect all lesson exams for this course
              if (lesson.examination && lesson.examination.isEnabled) {
                lessonExams.push({
                  moduleIndex: mIdx,
                  lessonIndex: lIdx,
                  title: lesson.title,
                  exam: lesson.examination
                });
              }
            });
          }
        });
      }
      // Fallback to old progress if no modules
      if (!totalLessons && enrollment.progress?.totalLessons) {
        totalLessons = enrollment.progress.totalLessons;
        completedLessons = enrollment.progress.completedLessons;
      }
      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const isCompleted = enrollment.status === 'completed' || progress >= 100;
      const hasCertificate = enrollment.certificateIssued || false;
      const finalExamPassed = enrollment.progress?.finalExamPassed || false;
      const finalExamScore = enrollment.progress?.finalExamScore || 0;
      const isFailed = enrollment.progress?.finalExamCompleted && !finalExamPassed;
      studentData.enrollments.push({
        courseId: enrollment.course._id,
        courseName: enrollment.course.name,
        progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        isCompleted,
        isFailed,
        hasCertificate,
        finalExamScore,
        finalExamPassed,
        finalExamCompleted: enrollment.progress?.finalExamCompleted || false,
        estimatedHours: enrollment.course.estimatedHours || 0,
        lessonExams // include all lesson exams for frontend
      });
      studentData.totalCourses++;
      studentData.totalProgress += progress;
      if (isCompleted) studentData.completedCourses++;
      if (isFailed) studentData.failedCourses++;
      if (hasCertificate) studentData.certificatesEarned++;
    }

    // 4. Format and return data
    const studentsData = Array.from(studentMap.values()).map(studentData => {
      const averageProgress = studentData.totalCourses > 0
        ? Math.round(studentData.totalProgress / studentData.totalCourses)
        : 0;
      return {
        _id: studentData.student._id,
        fullName: studentData.student.fullName,
        email: studentData.student.email,
        joinedAt: studentData.student.createdAt,
        lastActive: studentData.lastActive,
        enrolledAt: studentData.enrolledAt,
        statistics: {
          totalCourses: studentData.totalCourses,
          completedCourses: studentData.completedCourses,
          failedCourses: studentData.failedCourses,
          inProgressCourses: studentData.totalCourses - studentData.completedCourses - studentData.failedCourses,
          certificatesEarned: studentData.certificatesEarned,
          averageProgress,
          completionRate: studentData.totalCourses > 0
            ? Math.round((studentData.completedCourses / studentData.totalCourses) * 100)
            : 0
        },
        enrollments: studentData.enrollments
      };
    });
    return res.json(studentsData);
  } catch (error) {
    console.error('Error fetching instructor students:', error);
    // Always return a valid JSON array or error object
    return res.status(500).json({ error: 'Failed to fetch students data', details: error.message });
  }
});

// NEW: Get detailed analytics for instructor's students
app.get('/api/instructor/students/analytics', verifyToken, verifyInstructor, async (req, res) => {
  try {
    // Get instructor's courses
    const instructorCourses = await Course.find({ instructor: req.user.id });
    const courseIds = instructorCourses.map(course => course._id);

    // Get all enrollments for instructor's courses
    const enrollments = await Enrollment.find({ 
      course: { $in: courseIds } 
    })
    .populate('student', 'fullName email')
    .populate('course', 'name');

    // Calculate overall statistics
    const totalEnrollments = enrollments.length;
    const uniqueStudents = new Set(enrollments.map(e => e.student._id.toString())).size;
    
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalCertificates = 0;
    let totalProgressSum = 0;
    
    // Course-specific analytics
    const courseAnalytics = {};
    
    enrollments.forEach(enrollment => {
      const courseId = enrollment.course._id.toString();
      const progress = enrollment.progress?.overallProgress || 0;
      const isCompleted = enrollment.status === 'completed' || progress >= 100;
      const hasCertificate = enrollment.certificateIssued || false;
      const finalExamPassed = enrollment.progress?.finalExamPassed || false;
      const isFailed = enrollment.progress?.finalExamCompleted && !finalExamPassed;
      
      // Overall statistics
      totalProgressSum += progress;
      if (isCompleted) totalCompleted++;
      if (isFailed) totalFailed++;
      if (hasCertificate) totalCertificates++;
      
      // Course-specific statistics
      if (!courseAnalytics[courseId]) {
        courseAnalytics[courseId] = {
          courseName: enrollment.course.name,
          totalEnrollments: 0,
          completed: 0,
          failed: 0,
          inProgress: 0,
          certificates: 0,
          averageProgress: 0,
          progressSum: 0
        };
      }
      
      const courseData = courseAnalytics[courseId];
      courseData.totalEnrollments++;
      courseData.progressSum += progress;
      
      if (isCompleted) courseData.completed++;
      else if (isFailed) courseData.failed++;
      else courseData.inProgress++;
      
      if (hasCertificate) courseData.certificates++;
    });
    
    // Calculate averages for courses
    Object.values(courseAnalytics).forEach(course => {
      course.averageProgress = course.totalEnrollments > 0 
        ? Math.round(course.progressSum / course.totalEnrollments) 
        : 0;
      course.completionRate = course.totalEnrollments > 0 
        ? Math.round((course.completed / course.totalEnrollments) * 100) 
        : 0;
      delete course.progressSum; // Remove temporary field
    });

    const analytics = {
      overview: {
        totalEnrollments,
        uniqueStudents,
        totalCompleted,
        totalFailed,
        totalInProgress: totalEnrollments - totalCompleted - totalFailed,
        totalCertificates,
        averageProgress: totalEnrollments > 0 ? Math.round(totalProgressSum / totalEnrollments) : 0,
        completionRate: totalEnrollments > 0 ? Math.round((totalCompleted / totalEnrollments) * 100) : 0,
        failureRate: totalEnrollments > 0 ? Math.round((totalFailed / totalEnrollments) * 100) : 0
      },
      courseBreakdown: Object.values(courseAnalytics)
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching instructor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Comprehensive Instructor Analytics Dashboard
app.get('/api/instructor-analytics', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const { timeFilter = '7days' } = req.query;
    const instructorId = req.user.id;
    
    // Calculate date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (timeFilter) {
      case '7days':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30days':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '3months':
        dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case '1year':
        dateFilter = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
        break;
      case 'all':
      default:
        dateFilter = {}; // No filter for all time
    }

    // Get instructor's courses
    const instructorCourses = await Course.find({ instructor: instructorId });
    const courseIds = instructorCourses.map(course => course._id);

    // Get enrollments with date filter if applicable
    const enrollmentQuery = { course: { $in: courseIds } };
    if (Object.keys(dateFilter).length > 0) {
      enrollmentQuery.enrolledAt = dateFilter;
    }

    const enrollments = await Enrollment.find(enrollmentQuery)
      .populate('student', 'fullName email')
      .populate('course', 'name price');

    // Get reviews for instructor's courses
    const reviews = await mongoose.connection.db.collection('reviews').find({
      courseId: { $in: courseIds.map(id => id.toString()) }
    }).toArray();

    // Calculate statistics
    const totalStudents = new Set(enrollments.map(e => e.student._id.toString())).size;
    const totalCourses = instructorCourses.length;
    const newEnrollments = enrollments.filter(e => {
      if (Object.keys(dateFilter).length === 0) return true;
      return e.enrolledAt >= dateFilter.$gte;
    }).length;

    // Calculate revenue
    const totalRevenue = enrollments.reduce((sum, enrollment) => {
      return sum + (enrollment.course.price || 0);
    }, 0);

    // Calculate completion rate
    const completedEnrollments = enrollments.filter(e => 
      e.status === 'completed' || (e.progress && e.progress.overallProgress >= 100)
    ).length;
    const completionRate = enrollments.length > 0 ? 
      Math.round((completedEnrollments / enrollments.length) * 100) : 0;

    // Calculate average rating
    const averageRating = reviews.length > 0 ? 
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

    // Generate enrollment trends (last 7 data points based on time filter)
    const trendLabels = [];
    const trendData = [];
    const daysBack = timeFilter === '7days' ? 7 : timeFilter === '30days' ? 30 : 90;
    const interval = timeFilter === '7days' ? 1 : timeFilter === '30days' ? 5 : 15;

    for (let i = daysBack; i >= 0; i -= interval) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + interval * 24 * 60 * 60 * 1000);
      
      const enrollmentsInPeriod = enrollments.filter(e => 
        e.enrolledAt >= date && e.enrolledAt < nextDate
      ).length;

      trendLabels.push(date.toLocaleDateString());
      trendData.push(enrollmentsInPeriod);
    }

    // Course performance data
    const coursePerformance = await Promise.all(instructorCourses.map(async (course) => {
      const courseEnrollments = enrollments.filter(e => e.course._id.toString() === course._id.toString());
      const courseReviews = reviews.filter(r => r.courseId === course._id.toString());
      
      const students = courseEnrollments.length;
      const completed = courseEnrollments.filter(e => 
        e.status === 'completed' || (e.progress && e.progress.overallProgress >= 100)
      ).length;
      const completion = students > 0 ? Math.round((completed / students) * 100) : 0;
      const rating = courseReviews.length > 0 ? 
        courseReviews.reduce((sum, review) => sum + review.rating, 0) / courseReviews.length : 0;
      const revenue = courseEnrollments.reduce((sum, e) => sum + (course.price || 0), 0);

      return {
        name: course.name,
        students,
        rating: Math.round(rating * 10) / 10,
        completion,
        revenue
      };
    }));

    // Recent activity (simplified for real-time data)
    const recentActivity = [];
    
    // Recent completions
    const recentCompletions = enrollments
      .filter(e => e.status === 'completed' && e.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 2);
    
    recentCompletions.forEach(enrollment => {
      recentActivity.push({
        icon: '🎓',
        title: `${enrollment.student.fullName} completed "${enrollment.course.name}"`,
        time: getTimeAgo(enrollment.completedAt)
      });
    });

    // Recent enrollments
    const recentNewEnrollments = enrollments
      .sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt))
      .slice(0, 3);
    
    recentNewEnrollments.forEach(enrollment => {
      recentActivity.push({
        icon: '👥',
        title: `${enrollment.student.fullName} enrolled in "${enrollment.course.name}"`,
        time: getTimeAgo(enrollment.enrolledAt)
      });
    });

    // Recent reviews
    const recentReviews = reviews
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);
    
    recentReviews.forEach(review => {
      const course = instructorCourses.find(c => c._id.toString() === review.courseId);
      if (course) {
        recentActivity.push({
          icon: '⭐',
          title: `New ${review.rating}-star review for "${course.name}"`,
          time: getTimeAgo(review.createdAt)
        });
      }
    });

    // Sort activity by most recent and limit to 5
    recentActivity.sort((a, b) => getTimeSort(a.time) - getTimeSort(b.time));

    const analyticsData = {
      stats: {
        totalStudents,
        totalCourses,
        averageRating: Math.round(averageRating * 10) / 10,
        totalRevenue,
        completionRate,
        newEnrollments
      },
      enrollmentTrends: {
        labels: trendLabels,
        data: trendData
      },
      coursePerformance: coursePerformance.sort((a, b) => b.students - a.students),
      recentActivity: recentActivity.slice(0, 5)
    };

    res.json(analyticsData);

  } catch (error) {
    console.error('Error fetching instructor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return 'Just now';
}

// Helper function for sorting by time
function getTimeSort(timeString) {
  if (timeString.includes('Just now')) return 0;
  if (timeString.includes('hour')) return parseInt(timeString);
  if (timeString.includes('day')) return parseInt(timeString) * 24;
  return 999;
}

// Delete course (instructor only - own courses)
app.delete('/api/courses/:courseId', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findOne({ _id: courseId, instructor: req.user.id });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    await Course.findByIdAndDelete(courseId);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ==================== ENROLLMENT ENDPOINTS ====================
// NEW: Get current student's progress details for dashboard
app.get('/api/student-progress-details', verifyToken, async (req, res) => {
  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection not available',
        connectionState: mongoose.connection.readyState 
      });
    }

    const studentId = req.user.id;
    
    // Get all enrollments for this student with timeout
    const enrollments = await Enrollment.find({ student: studentId })
      .populate({
        path: 'course',
        select: 'name image description category level estimatedHours modules status',
      })
      .maxTimeMS(10000); // 10 second timeout

    if (!enrollments || enrollments.length === 0) {
      return res.json([]);
    }

    // Format progress details for dashboard
    const progressDetails = enrollments.map(enrollment => {
      let totalLessons = 0;
      let completedLessons = 0;
      let course = enrollment.course;
      
      // Defensive: If course is missing, return safe defaults
      if (!course) {
        return {
          courseId: null,
          courseName: 'Unknown Course',
          courseImage: '/default-course-image.jpg',
          instructorName: 'Unknown Instructor',
          description: '',
          category: '',
          level: '',
          estimatedHours: 0,
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt,
          overallProgress: 0,
          isCompleted: false,
          certificateIssued: enrollment.certificateIssued || false,
          finalExamTaken: enrollment.progress?.finalExamTaken || false,
          finalExamPassed: enrollment.progress?.finalExamPassed || false,
          finalExamScore: enrollment.progress?.finalExamScore || null,
          quizScores: enrollment.progress?.quizScores || []
        };
      }
      
      // Defensive: Ensure all course properties are defined
      const safeCourseId = course._id || null;
      const safeCourseName = course.name || 'Unknown Course';
      const safeImage = course.image && typeof course.image === 'string' && course.image.trim() ? course.image : '/default-course-image.jpg';
      const safeDescription = course.description || '';
      const safeCategory = course.category || '';
      const safeLevel = course.level || '';
      const safeEstimatedHours = typeof course.estimatedHours === 'number' ? course.estimatedHours : 0;

      if (course.modules && Array.isArray(course.modules)) {
        course.modules.forEach(mod => {
          if (mod.lessons && Array.isArray(mod.lessons)) {
            totalLessons += mod.lessons.length;
          }
        });
      }
      
      if (enrollment.progress?.completedLessons) {
        completedLessons = enrollment.progress.completedLessons;
      }
      if (enrollment.progress?.totalLessons) {
        totalLessons = enrollment.progress.totalLessons;
      }
      
      const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const isCompleted = overallProgress >= 100;
      
      return {
        courseId: safeCourseId,
        courseName: safeCourseName,
        courseImage: safeImage,
        instructorName: course.instructor?.fullName || 'Unknown Instructor',
        description: safeDescription,
        category: safeCategory,
        level: safeLevel,
        estimatedHours: safeEstimatedHours,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        overallProgress,
        isCompleted,
        certificateIssued: enrollment.certificateIssued || false,
        certificateIssuedAt: enrollment.certificateIssuedAt || null,
        finalExamTaken: enrollment.progress?.finalExamTaken || false,
        finalExamPassed: enrollment.progress?.finalExamPassed || false,
        finalExamScore: enrollment.progress?.finalExamScore || null,
        quizScores: enrollment.progress?.quizScores || []
      };
    });
    
    res.json(progressDetails);
  } catch (error) {
    console.error('Error fetching student progress details:', error);
    
    // Provide specific error handling
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        error: 'Database connection timeout - please try again later',
        details: 'The database is currently experiencing connectivity issues'
      });
    }
    
    if (error.name === 'MongoTimeoutError' || error.message.includes('timed out')) {
      return res.status(503).json({ 
        error: 'Database query timeout - please try again',
        details: 'The query took too long to execute'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch progress details',
      details: error.message 
    });
  }
});

// ==================== USER PROFILE ENDPOINTS ====================
// Get user profile data
app.get('/api/user-profile', verifyToken, async (req, res) => {
  try {
    // Get user by ID from token
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.fullName,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      instructorStatus: user.instructorStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
app.put('/api/update-profile', verifyToken, async (req, res) => {
  try {
    const { fullName } = req.body;
    
    // Validate input
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    
    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { fullName: fullName.trim() },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.fullName,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update instructor profile with comprehensive data
app.put('/api/instructor/profile', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const updateData = {};
    
    // Extract fields from request body
    const { 
      fullName,
      email, 
      phone, 
      location, 
      bio, 
      jobTitle, 
      company, 
      experience, 
      education, 
      expertise, 
      teachingExperience, 
      achievements, 
      socialLinks, 
      certifications 
    } = req.body;
    
    // Build update object with only provided fields
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
      updateData.email = email;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;
    if (bio !== undefined) updateData.bio = bio;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (company !== undefined) updateData.company = company;
    if (experience !== undefined) updateData.experience = experience;
    if (education !== undefined) updateData.education = education;
    if (expertise !== undefined) updateData.expertise = expertise;
    if (teachingExperience !== undefined) updateData.teachingExperience = teachingExperience;
    if (achievements !== undefined) updateData.achievements = achievements;
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
    if (certifications !== undefined) updateData.certifications = certifications;
    
    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update localStorage data for consistency
    const responseData = {
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.fullName,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        location: updatedUser.location,
        bio: updatedUser.bio,
        jobTitle: updatedUser.jobTitle,
        company: updatedUser.company,
        experience: updatedUser.experience,
        education: updatedUser.education,
        expertise: updatedUser.expertise,
        teachingExperience: updatedUser.teachingExperience,
        achievements: updatedUser.achievements,
        socialLinks: updatedUser.socialLinks,
        certifications: updatedUser.certifications,
        role: updatedUser.role
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Error updating instructor profile:', error);
    res.status(500).json({ error: 'Failed to update instructor profile' });
  }
});

// Change password
app.put('/api/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await User.findByIdAndUpdate(
      req.user.id,
      { password: hashedNewPassword }
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get user data for download
app.get('/api/user-data', verifyToken, async (req, res) => {
  try {
    // Get user data
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's enrollments and progress
    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate('course')
      .select('course enrolledAt completedAt progress status certificateIssued');

    // Compile user data
    const userData = {
      profile: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      enrollments: enrollments.map(enrollment => ({
        courseId: enrollment.course._id,
        courseName: enrollment.course.name,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        status: enrollment.status,
        progress: enrollment.progress,
        certificateIssued: enrollment.certificateIssued
      })),
      summary: {
        totalCourses: enrollments.length,
        completedCourses: enrollments.filter(e => e.status === 'completed').length,
        dataExportedAt: new Date().toISOString()
      }
    };

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user's enrollments
app.get('/api/enrollments', verifyToken, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate('course')
      .sort({ enrolledAt: -1 });
    
    // Filter out enrollments where course population failed (course was deleted)
    const validEnrollments = enrollments.filter(enrollment => enrollment.course !== null);
    
    if (enrollments.length > validEnrollments.length) {
      console.log(`Filtered out ${enrollments.length - validEnrollments.length} enrollments with deleted courses for user ${req.user.id}`);
    }
    
    res.json(validEnrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch enrollments',
      details: error.message 
    });
  }
});

// Enroll in a course
app.post('/api/enrollments', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Check if course exists and is published
    const course = await Course.findById(courseId);
    if (!course || course.status !== 'published') {
      return res.status(404).json({ error: 'Course not found or not available' });
    }

    // Check if user is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id
    });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create new enrollment
    const enrollment = new Enrollment({
      student: req.user.id,
      course: course._id,
      enrolledAt: new Date(),
      status: 'active',
      progress: {
        modules: [],
        overallProgress: 0,
        completedLessons: 0,
        totalLessons: 0,
        completedModules: 0,
        totalModules: 0
      }
    });
    await enrollment.save();

    // Update course enrollment count
    await Course.findByIdAndUpdate(course._id, {
      $inc: { enrollmentCount: 1 }
    });

    res.status(201).json({
      message: 'Successfully enrolled in course',
      enrollment
    });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

// Legacy enrollment endpoint (for backward compatibility)
app.post('/api/enroll', async (req, res) => {
  try {
    const { courseName, username } = req.body;
    
    if (!courseName || !username) {
      return res.status(400).json({ error: 'Course name and username are required' });
    }

    // Find the user
    const user = await User.findOne({ 
      $or: [{ email: username }, { fullName: username }] 
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the course
    const course = await Course.findOne({ name: courseName });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
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
      enrolledAt: new Date(),
      status: 'active',
      progress: {
        modules: [],
        overallProgress: 0,
        completedLessons: 0,
        totalLessons: 0,
        completedModules: 0,
        totalModules: 0
      }
    });

    await enrollment.save();

    // Update course enrollment count
    await Course.findByIdAndUpdate(course._id, {
      $inc: { enrollmentCount: 1 }
    });

    res.status(201).json({
      message: 'Successfully enrolled in course',
      enrollment
    });

  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

// ==================== LESSON & EXAM ENDPOINTS ====================

// Mark course as started
app.post('/api/courses/:courseId/start', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    let course;
    let enrollment;
    
    // Enhanced course lookup that prioritizes user enrollments
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId - find directly
      course = await Course.findById(courseId);
      if (course) {
        enrollment = await Enrollment.findOne({
          student: studentId,
          course: course._id
        });
        
        // If not enrolled in this specific course, try to find enrolled course with same name
        if (!enrollment) {
          const userEnrollments = await Enrollment.find({ student: studentId }).populate('course');
          const sameNameEnrollment = userEnrollments.find(enroll => 
            enroll.course && enroll.course.name === course.name
          );
          
          if (sameNameEnrollment) {
            course = sameNameEnrollment.course;
            enrollment = sameNameEnrollment;
          }
        }
      }
    } else {
      // It's a course name - use enhanced lookup
      const decodedName = decodeURIComponent(courseId);
      
      // First try to find an enrolled course with this name
      const userEnrollments = await Enrollment.find({ student: studentId }).populate('course');
      const enrolledCourse = userEnrollments.find(enrollment => 
        enrollment.course && enrollment.course.name === decodedName
      );
      
      if (enrolledCourse) {
        course = enrolledCourse.course;
        enrollment = enrolledCourse;
      } else {
        // Fallback to any published course with this name
        course = await Course.findOne({ 
          name: decodedName,
          status: 'published'
        });
        
        if (course) {
          enrollment = await Enrollment.findOne({
            student: studentId,
            course: course._id
          });
        }
      }
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    // If course is already started (progress > 0), don't change anything
    if (enrollment.progress && enrollment.progress.overallProgress > 0) {
      return res.json({ 
        message: 'Course already started',
        enrollment 
      });
    }

    // Initialize progress structure if needed
    if (!enrollment.progress) {
      const totalLessons = course.modules.reduce((total, mod) => total + mod.lessons.length, 0);
      const totalModules = course.modules.length;
      
      enrollment.progress = {
        modules: [],
        overallProgress: 0,
        completedLessons: 0,
        totalLessons: totalLessons,
        completedModules: 0,
        totalModules: totalModules
      };
    }

    // Mark course as started with 1% progress
    enrollment.progress.overallProgress = 1;
    enrollment.progress.startedAt = new Date();
    
    await enrollment.save();

    res.json({
      message: 'Course marked as started',
      enrollment
    });

  } catch (error) {
    console.error('Error starting course:', error);
    res.status(500).json({ error: 'Failed to start course' });
  }
});

// Mark lesson as completed
app.post('/api/courses/:courseId/modules/:moduleIndex/lessons/:lessonIndex/complete', verifyToken, async (req, res) => {
  try {
    const { courseId, moduleIndex, lessonIndex } = req.params;
    const studentId = req.user.id;

    console.log('Lesson completion request:', {
      courseId,
      moduleIndex,
      lessonIndex,
      studentId
    });

    let course;
    let enrollment;
    
    // Enhanced course lookup that prioritizes user enrollments
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId - find directly
      course = await Course.findById(courseId);
      if (course) {
        enrollment = await Enrollment.findOne({
          student: studentId,
          course: course._id
        });
        
        // If not enrolled in this specific course, try to find enrolled course with same name
        if (!enrollment) {
          const userEnrollments = await Enrollment.find({ student: studentId }).populate('course');
          const sameNameEnrollment = userEnrollments.find(enroll => 
            enroll.course && enroll.course.name === course.name
          );
          
          if (sameNameEnrollment) {
            course = sameNameEnrollment.course;
            enrollment = sameNameEnrollment;
          }
        }
      }
    } else {
      // It's a course name - use enhanced lookup
      const decodedName = decodeURIComponent(courseId);
      
      // First try to find an enrolled course with this name
      const userEnrollments = await Enrollment.find({ student: studentId }).populate('course');
      const enrolledCourse = userEnrollments.find(enrollment => 
        enrollment.course && enrollment.course.name === decodedName
      );
      
      if (enrolledCourse) {
        course = enrolledCourse.course;
        enrollment = enrolledCourse;
      } else {
        // Fallback to any published course with this name
        course = await Course.findOne({ 
          name: decodedName,
          status: 'published'
        });
        
        if (course) {
          enrollment = await Enrollment.findOne({
            student: studentId,
            course: course._id
          });
        }
      }
    }

    if (!course) {
      console.log('Course not found for completion:', courseId);
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!enrollment) {
      console.log('User not enrolled in course for lesson completion. User:', studentId, 'Course:', course._id);
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    console.log('Found course and enrollment:', {
      courseName: course.name,
      courseId: course._id,
      enrollmentId: enrollment._id
    });

    // Validate module and lesson indices
    const module = course.modules[moduleIndex];
    const lesson = module?.lessons[lessonIndex];

    if (!module || !lesson) {
      console.log('Module or lesson not found:', {
        moduleIndex,
        lessonIndex,
        moduleExists: !!module,
        lessonExists: !!lesson,
        totalModules: course.modules.length,
        moduleLessons: module?.lessons.length || 0
      });
      return res.status(404).json({ error: 'Module or lesson not found' });
    }

    console.log('Lesson to complete:', {
      moduleTitle: module.title,
      lessonTitle: lesson.title,
      lessonId: lesson._id
    });

    // Initialize progress structure if needed
    if (!enrollment.progress) {
      const totalLessons = course.modules.reduce((total, mod) => total + mod.lessons.length, 0);
      const totalModules = course.modules.length;
      
      enrollment.progress = {
        modules: [],
        overallProgress: 0,
        completedLessons: 0,
        totalLessons: totalLessons,
        completedModules: 0,
        totalModules: totalModules
      };
    }
    if (!enrollment.progress.modules) {
      enrollment.progress.modules = [];
    }

    // Ensure lesson and module counts are accurate
    const totalLessons = course.modules.reduce((total, mod) => total + mod.lessons.length, 0);
    const totalModules = course.modules.length;
    enrollment.progress.totalLessons = totalLessons;
    enrollment.progress.totalModules = totalModules;

    // Find or create module progress
    let moduleProgress = enrollment.progress.modules.find(m => 
      m.moduleId.toString() === module._id.toString()
    );
    
    if (!moduleProgress) {
      moduleProgress = {
        moduleId: module._id,
        completed: false,
        lessons: []
      };
      enrollment.progress.modules.push(moduleProgress);
    }

    // Find or create lesson progress
    let lessonProgress = moduleProgress.lessons.find(l => 
      l.lessonId.toString() === lesson._id.toString()
    );
    
    if (!lessonProgress) {
      lessonProgress = {
        lessonId: lesson._id,
        completed: false
      };
      moduleProgress.lessons.push(lessonProgress);
    }

    // Mark lesson as completed if not already completed
    let progressUpdated = false;
    if (!lessonProgress.completed) {
      lessonProgress.completed = true;
      lessonProgress.completedAt = new Date();
      progressUpdated = true;

      console.log('Marking lesson as completed:', {
        lessonId: lesson._id,
        moduleId: module._id
      });

      // Calculate total lessons and modules
      const totalLessons = course.modules.reduce((total, mod) => total + mod.lessons.length, 0);
      const totalModules = course.modules.length;

      // Update completed lessons count
      const completedLessons = enrollment.progress.modules.reduce(
        (total, mod) => total + mod.lessons.filter(l => l.completed).length, 0
      );
      enrollment.progress.completedLessons = completedLessons;
      enrollment.progress.totalLessons = totalLessons;
      enrollment.progress.overallProgress = Math.round((completedLessons / totalLessons) * 100);

      // Update module completion status
      const moduleCompletedLessons = moduleProgress.lessons.filter(l => l.completed).length;
      moduleProgress.completed = moduleCompletedLessons === module.lessons.length;

      // Update completed modules count
      const completedModules = enrollment.progress.modules.filter(m => m.completed).length;
      enrollment.progress.completedModules = completedModules;
      enrollment.progress.totalModules = totalModules;

      // Update course status if fully completed
      if (enrollment.progress.overallProgress >= 100) {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
      }

      console.log('Progress updated:', {
        totalLessons,
        completedLessons,
        totalModules,
        completedModules,
        overallProgress: enrollment.progress.overallProgress,
        moduleCompleted: moduleProgress.completed,
        courseStatus: enrollment.status
      });

      await enrollment.save();
      console.log('Enrollment saved successfully');
    } else {
      console.log('Lesson already completed');
    }

    // Return comprehensive progress data
    res.json({
      message: progressUpdated ? 'Lesson marked as completed' : 'Lesson already completed',
      progress: {
        overallProgress: enrollment.progress.overallProgress,
        completedLessons: enrollment.progress.completedLessons,
        totalLessons: enrollment.progress.totalLessons,
        completedModules: enrollment.progress.completedModules,
        totalModules: enrollment.progress.totalModules,
        lessonCompleted: lessonProgress.completed,
        moduleCompleted: moduleProgress.completed,
        courseCompleted: enrollment.status === 'completed'
      },
      enrollment: {
        _id: enrollment._id,
        status: enrollment.status,
        progress: enrollment.progress
      }
    });

  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

// Health check endpoint
app.get('/api/health', verifyToken, (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// NEW: Refresh progress for all user's courses
app.post('/api/refresh-progress', verifyToken, async (req, res) => {
  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database connection not available',
        connectionState: mongoose.connection.readyState 
      });
    }

    const studentId = req.user.id;
    
    // Validate user ID
    if (!studentId) {
      return res.status(400).json({ 
        error: 'Invalid user ID',
        details: 'User authentication failed'
      });
    }
    
    // Get all user enrollments with timeout
    const enrollments = await Enrollment.find({ student: studentId })
      .populate('course')
      .maxTimeMS(10000); // 10 second timeout
    
    const updatedEnrollments = [];
    
    for (const enrollment of enrollments) {
      try {
        const course = enrollment.course;
        
        // Skip enrollments with missing or invalid course data
        if (!course || !course._id || !course.name) {
          console.log('Skipping enrollment with invalid course data:', enrollment._id);
          continue;
        }
        
        // Skip courses without modules (valid case)
        if (!course.modules || !Array.isArray(course.modules)) {
          console.log('Skipping course without modules:', course.name);
          continue;
        }
        
        // Initialize progress if missing
        if (!enrollment.progress) {
          enrollment.progress = {
            modules: [],
            overallProgress: 0,
            completedLessons: 0,
            totalLessons: 0,
            completedModules: 0,
            totalModules: 0
          };
        }
      
      // Calculate totals
      const totalLessons = course.modules.reduce((total, mod) => total + (mod.lessons ? mod.lessons.length : 0), 0);
      const totalModules = course.modules.length;
      
      // Update totals
      enrollment.progress.totalLessons = totalLessons;
      enrollment.progress.totalModules = totalModules;
      
      // Calculate completed counts
      let completedLessons = 0;
      let completedModules = 0;
      
      if (enrollment.progress.modules && enrollment.progress.modules.length > 0) {
        completedLessons = enrollment.progress.modules.reduce((total, mod) => 
          total + (mod.lessons ? mod.lessons.filter(l => l.completed).length : 0), 0
        );
        
        completedModules = enrollment.progress.modules.filter(m => m.completed).length;
      }
      
      // Update counts and progress
      enrollment.progress.completedLessons = completedLessons;
      enrollment.progress.completedModules = completedModules;
      enrollment.progress.overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      
      // Update course status
      if (enrollment.progress.overallProgress >= 100 && enrollment.status !== 'completed') {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
      }
      
      // Save with error handling
      try {
        await enrollment.save();
        updatedEnrollments.push({
          courseId: course._id,
          courseName: course.name,
          progress: enrollment.progress,
          status: enrollment.status
        });
      } catch (saveError) {
        console.error('Error saving enrollment:', enrollment._id, saveError.message);
        // Continue with other enrollments
      }
      
    } catch (enrollmentError) {
      console.error('Error processing enrollment:', enrollment._id, enrollmentError.message);
      // Continue with other enrollments
    }
    }
    
    res.json({
      message: 'Progress refreshed for all courses',
      enrollments: updatedEnrollments
    });
    
  } catch (error) {
    console.error('Error refreshing progress:', error);
    
    // Provide specific error handling
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        error: 'Database connection timeout - please try again later',
        details: 'The database is currently experiencing connectivity issues'
      });
    }
    
    if (error.name === 'MongoTimeoutError' || error.message.includes('timed out')) {
      return res.status(503).json({ 
        error: 'Database query timeout - please try again',
        details: 'The query took too long to execute'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Data validation error during progress refresh',
        details: 'Some enrollment data needs to be corrected'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to refresh progress',
      details: 'Progress refresh temporarily unavailable - dashboard will load with existing data'
    });
  }
});

// Add back other existing endpoints
// Get course content for enrolled students
app.get('/api/courses/:courseId/content', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('Course content request for:', courseId, 'by user:', req.user.id);
    
    let course;
    let enrollment;
    
    // If it's an ObjectId, check if user is enrolled in this specific course first
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
      if (course) {
        console.log('Found course by ID:', course.name, 'ID:', course._id);
        
        // Check if user is enrolled in this specific course
        enrollment = await Enrollment.findOne({
          student: req.user.id,
          course: course._id
        });
        
        console.log('Direct enrollment check:', !!enrollment);
        
        // If not enrolled in this specific course, try to find an enrolled course with the same name
        if (!enrollment) {
          console.log('Not enrolled in this specific course, checking for same-name enrolled courses...');
          
          // Find all user enrollments and check for courses with the same name
          const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course');
          const sameNameEnrollment = userEnrollments.find(enroll => 
            enroll.course && enroll.course.name === course.name
          );
          
          if (sameNameEnrollment) {
            console.log('Found enrolled course with same name:', sameNameEnrollment.course.name, 'ID:', sameNameEnrollment.course._id);
            course = sameNameEnrollment.course;
            enrollment = sameNameEnrollment;
          }
        }
      }
    } else {
      // For course names, use the existing helper function
      course = await findCourseForUser(courseId, req.user.id);
      if (course) {
        enrollment = await Enrollment.findOne({
          student: req.user.id,
          course: course._id
        });
      }
    }
    
    // Populate instructor if needed
    if (course && !course.instructor) {
      await course.populate('instructor', 'fullName email');
    }
    
    if (!course) {
      console.log('Course not found:', courseId);
      return res.status(404).json({ error: 'Course not found' });
    }

    console.log('Final course found:', course.name, 'ID:', course._id);
    console.log('Final enrollment found:', !!enrollment);

    if (!enrollment) {
      console.log('User not enrolled in course. User:', req.user.id, 'Course:', course._id);
      
      // Provide debugging information
      const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course', 'name _id');
      const enrolledCourseNames = userEnrollments.map(e => `${e.course.name} (ID: ${e.course._id})`);
      
      console.log('User enrolled courses:', enrolledCourseNames);
      
      return res.status(403).json({ 
        error: 'You must be enrolled to access course content',
        debug: {
          requestedCourse: courseId,
          foundCourseName: course.name,
          foundCourseId: course._id.toString(),
          userEnrolledCourses: enrolledCourseNames
        }
      });
    }

    console.log('Access granted for course content');
    res.json({
      course,
      enrollment
    });

  } catch (error) {
    console.error('Error fetching course content:', error);
    res.status(500).json({ error: 'Failed to fetch course content' });
  }
});

// Submit lesson exam
app.post('/api/courses/:courseId/modules/:moduleIndex/lessons/:lessonIndex/exam', verifyToken, async (req, res) => {
  try {
    const { courseId, moduleIndex, lessonIndex } = req.params;
    const { answers } = req.body;

    let course;
    let enrollment;
    
    // Enhanced course lookup that prioritizes user enrollments
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
      if (course) {
        enrollment = await Enrollment.findOne({
          student: req.user.id,
          course: course._id
        });
        
        if (!enrollment) {
          const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course');
          const sameNameEnrollment = userEnrollments.find(enroll => 
            enroll.course && enroll.course.name === course.name
          );
          
          if (sameNameEnrollment) {
            course = sameNameEnrollment.course;
            enrollment = sameNameEnrollment;
          }
        }
      }
    } else {
      const decodedName = decodeURIComponent(courseId);
      const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course');
      const enrolledCourse = userEnrollments.find(enrollment => 
        enrollment.course && enrollment.course.name === decodedName
      );
      
      if (enrolledCourse) {
        course = enrolledCourse.course;
        enrollment = enrolledCourse;
      } else {
        course = await Course.findOne({ name: decodedName });
        if (course) {
          enrollment = await Enrollment.findOne({
            student: req.user.id,
            course: course._id
          });
        }
      }
    }

    if (!course || !enrollment) {
      return res.status(404).json({ error: 'Course or enrollment not found' });
    }

    const module = course.modules[moduleIndex];
    const lesson = module?.lessons[lessonIndex];
    
    if (!module || !lesson) {
      return res.status(404).json({ error: 'Module or lesson not found' });
    }
    
    let exam = lesson?.examination;

    // Only proceed if exam exists and is enabled - no default/mock content
    if (!exam || !exam.isEnabled || !exam.questions || exam.questions.length === 0) {
      return res.status(404).json({ error: 'No exam available for this lesson' });
    }

    // Calculate score with proper answer handling
    let correctAnswers = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    
    const results = exam.questions.map((question, qIndex) => {
      const userAnswer = answers[qIndex];
      const points = question.points || 1;
      totalPoints += points;

      let isCorrect = false;
      let correctAnswerText = question.correctAnswer;

      // Check answer based on question type
      if (question.type === 'multiple-choice') {
        isCorrect = parseInt(userAnswer) === parseInt(question.correctAnswer);
        // Get the correct answer text from options, with fallback
        if (question.options && question.options[question.correctAnswer] !== undefined) {
          correctAnswerText = question.options[question.correctAnswer];
        } else {
          correctAnswerText = `Option ${question.correctAnswer}`;
        }
      } else if (question.type === 'true-false') {
        isCorrect = userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
        correctAnswerText = question.correctAnswer;
      } else if (question.type === 'short-answer') {
        isCorrect = userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        correctAnswerText = question.correctAnswer;
      }

      if (isCorrect) {
        correctAnswers++;
        earnedPoints += points;
      }
      
      return {
        questionId: question._id,
        question: question.question,
        userAnswer: question.type === 'multiple-choice' ? 
          (question.options[userAnswer] || 'Not answered') : userAnswer,
        correctAnswer: correctAnswerText,
        isCorrect,
        explanation: question.explanation
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= exam.passingScore;

    // Save exam attempt to enrollment
    if (!enrollment.quizAttempts) {
      enrollment.quizAttempts = [];
    }

    enrollment.quizAttempts.push({
      quizId: lesson._id,
      score: earnedPoints,
      totalQuestions: exam.questions.length,
      answers: results.map(r => ({
        questionId: r.questionId,
        selectedAnswer: r.userAnswer,
        isCorrect: r.isCorrect
      })),
      attemptedAt: new Date()
    });

    // Mark lesson as completed if passed
    if (passed) {
      // Update lesson progress
      let moduleProgress = enrollment.progress.modules.find(m => 
        m.moduleId.toString() === module._id.toString()
      );
      
      if (!moduleProgress) {
        moduleProgress = {
          moduleId: module._id,
          completed: false,
          lessons: []
        };
        enrollment.progress.modules.push(moduleProgress);
      }

      let lessonProgress = moduleProgress.lessons.find(l => 
        l.lessonId.toString() === lesson._id.toString()
      );
      
      if (!lessonProgress) {
        lessonProgress = {
          lessonId: lesson._id,
          completed: false
        };
        moduleProgress.lessons.push(lessonProgress);
      }

      lessonProgress.completed = true;
      lessonProgress.completedAt = new Date();

      // Update overall progress
      const totalLessons = course.modules.reduce((total, mod) => total + (mod.lessons ? mod.lessons.length : 0), 0);
      const completedLessons = enrollment.progress.modules.reduce((total, mod) => 
        total + (mod.lessons ? mod.lessons.filter(l => l.completed).length : 0), 0
      );
      
      enrollment.progress.completedLessons = completedLessons;
      enrollment.progress.totalLessons = totalLessons;
      enrollment.progress.overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    }

    // Ensure finalExamScore is always a number (fix for validation error)
    if (enrollment.progress.finalExamScore && typeof enrollment.progress.finalExamScore === 'object') {
      console.log('Found object in finalExamScore, converting to number:', enrollment.progress.finalExamScore);
      enrollment.progress.finalExamScore = 0; // Reset to default number
    }

    await enrollment.save();

    res.json({
      score,
      passed,
      passingScore: exam.passingScore,
      results,
      message: passed ? 'Congratulations! You passed the exam.' : 'You did not pass. Please review and try again.'
    });

  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

// Get lesson exam for student
app.get('/api/courses/:courseId/modules/:moduleIndex/lessons/:lessonIndex/exam', verifyToken, async (req, res) => {
  try {
    const { courseId, moduleIndex, lessonIndex } = req.params;

    let course;
    let enrollment;
    
    // Enhanced course lookup that prioritizes user enrollments
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
      if (course) {
        enrollment = await Enrollment.findOne({
          student: req.user.id,
          course: course._id
        });
        
        if (!enrollment) {
          const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course');
          const sameNameEnrollment = userEnrollments.find(enroll => 
            enroll.course && enroll.course.name === course.name
          );
          
          if (sameNameEnrollment) {
            course = sameNameEnrollment.course;
            enrollment = sameNameEnrollment;
          }
        }
      }
    } else {
      const decodedName = decodeURIComponent(courseId);
      const userEnrollments = await Enrollment.find({ student: req.user.id }).populate('course');
      const enrolledCourse = userEnrollments.find(enrollment => 
        enrollment.course && enrollment.course.name === decodedName
      );
      
      if (enrolledCourse) {
        course = enrolledCourse.course;
        enrollment = enrolledCourse;
      } else {
        course = await Course.findOne({ name: decodedName });
        if (course) {
          enrollment = await Enrollment.findOne({
            student: req.user.id,
            course: course._id
          });
        }
      }
    }

    if (!course || !enrollment) {
      return res.status(404).json({ error: 'Course or enrollment not found' });
    }

    // Ensure finalExamScore is always a number (fix for validation error)
    if (enrollment.progress.finalExamScore && typeof enrollment.progress.finalExamScore === 'object') {
      console.log('Found object in finalExamScore in GET endpoint, converting to number:', enrollment.progress.finalExamScore);
      enrollment.progress.finalExamScore = 0; // Reset to default number
      await enrollment.save();
    }

    const module = course.modules[moduleIndex];
    const lesson = module?.lessons[lessonIndex];
    
    if (!module || !lesson) {
      return res.status(404).json({ error: 'Module or lesson not found' });
    }
    
    let exam = lesson?.examination;

    // Only return exam if it exists and is enabled - no default/mock content
    if (!exam || !exam.isEnabled || !exam.questions || exam.questions.length === 0) {
      return res.status(404).json({ error: 'No exam available for this lesson' });
    }

    // Return exam without correct answers
    const examData = {
      title: exam.title || `${lesson.title} Examination`,
      description: exam.description || 'Complete this examination to finish the lesson',
      timeLimit: exam.timeLimit || 10,
      passingScore: exam.passingScore || 70,
      questions: exam.questions.map(q => ({
        _id: q._id,
        question: q.question,
        type: q.type,
        options: q.options,
        points: q.points
      }))
    };

    res.json(examData);

  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// ==================== FINAL EXAM ENDPOINTS ====================

// Submit final exam
app.post('/api/courses/:courseId/final-exam', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body;
    const userId = req.user.userId;

    console.log('Final exam submission for courseId:', courseId, 'userId:', userId);

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course has final exam
    if (!course.finalExam || !course.finalExam.isEnabled) {
      return res.status(400).json({ error: 'No final exam available for this course' });
    }

    // Find enrollment
    const enrollment = await Enrollment.findOne({ 
      user: userId, 
      course: courseId 
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    // Check if course is 100% complete
    if (enrollment.progress.overallProgress < 100) {
      return res.status(400).json({ error: 'Complete all lessons before taking the final exam' });
    }

    // Check attempt limits
    const attemptsTaken = enrollment.progress.finalExamAttempts || 0;
    const maxAttempts = course.finalExam.maxAttempts || 3;
    
    if (attemptsTaken >= maxAttempts) {
      return res.status(400).json({ error: 'Maximum exam attempts reached' });
    }

    const questions = course.finalExam.questions;
    let correctAnswers = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    const results = [];

    // Grade the exam
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = answers[i];
      const points = question.points || 1;
      totalPoints += points;

      let isCorrect = false;
      let correctAnswer = question.correctAnswer;
      let correctAnswerText = correctAnswer;

      // Check answer based on question type
      if (question.type === 'multiple-choice') {
        isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
        // Get the correct answer text from options, with fallback
        if (question.options && question.options[correctAnswer] !== undefined) {
          correctAnswerText = question.options[correctAnswer];
        } else {
          correctAnswerText = `Option ${correctAnswer}`;
        }
      } else if (question.type === 'true-false') {
        isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        correctAnswerText = correctAnswer;
      } else if (question.type === 'short-answer') {
        isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
        correctAnswerText = correctAnswer;
      }

      if (isCorrect) {
        correctAnswers++;
        earnedPoints += points;
      }

      results.push({
        question: question.question,
        userAnswer: question.type === 'multiple-choice' ? 
          (question.options[userAnswer] || 'Not answered') : userAnswer,
        correctAnswer: correctAnswerText,
        isCorrect,
        explanation: question.explanation || ''
      });
    }

    // Calculate score
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= (course.finalExam.passingScore || 70);

    // Update enrollment with exam results
    enrollment.progress.finalExamCompleted = true;
    enrollment.progress.finalExamPassed = passed;
    enrollment.progress.finalExamScore = score;
    enrollment.progress.finalExamAttempts = attemptsTaken + 1;
    enrollment.progress.finalExamDate = new Date();

    if (passed) {
      enrollment.progress.courseCompleted = true;
      enrollment.progress.completedAt = new Date();
    }

    await enrollment.save();

    console.log(`Final exam graded: ${score}% (${passed ? 'PASSED' : 'FAILED'})`);

    res.json({
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
      results,
      attemptsTaken: enrollment.progress.finalExamAttempts,
      maxAttempts
    });

  } catch (error) {
    console.error('Error submitting final exam:', error);
    res.status(500).json({ error: 'Failed to submit final exam' });
  }
});

// ==================== CERTIFICATE ENDPOINTS ====================

// Generate certificate for completed course
app.post('/api/courses/:courseId/certificate', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('Certificate request for courseId:', courseId);
    console.log('User ID:', req.user.id);

    // Find course by name or ID (with better matching)
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      const decodedName = decodeURIComponent(courseId);
      // Try multiple matching strategies
      course = await Course.findOne({ 
        $or: [
          { name: decodedName },
          { name: { $regex: new RegExp(decodedName, 'i') } },
          { name: { $regex: new RegExp(decodedName.replace(/\s+/g, '.*'), 'i') } }
        ]
      });
    }

    console.log('Found course:', course ? `${course.name} (ID: ${course._id})` : 'None');

    if (!course) {
      // List available courses for debugging
      const allCourses = await Course.find({}).select('name _id');
      console.log('Available courses:', allCourses.map(c => c.name));
      return res.status(404).json({ 
        error: 'Course not found',
        debug: {
          requestedCourse: courseId,
          decodedName: decodeURIComponent(courseId),
          availableCourses: allCourses.map(c => c.name)
        }
      });
    }

    // Find enrollment with overallProgress >= 100 (not just status 'completed')
    let enrollmentQuery = {
      student: req.user.id,
      course: course._id,
      'progress.overallProgress': { $gte: 100 }
    };

    // If course has final exam, also check that it's passed
    if (course.finalExam && course.finalExam.isEnabled) {
      enrollmentQuery['progress.finalExamPassed'] = true;
    }

    const enrollment = await Enrollment.findOne(enrollmentQuery)
      .populate('course', 'name instructor estimatedHours level category finalExam')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'fullName email'
        }
      })
      .populate('student', 'fullName email');

    console.log('Found enrollment:', enrollment ? 'Yes' : 'No');
    console.log('Enrollment progress:', enrollment ? enrollment.progress?.overallProgress : 'N/A');

    if (!enrollment) {
      // Let's also check if there's any enrollment at all
      const anyEnrollment = await Enrollment.findOne({
        student: req.user.id,
        course: course._id
      });
      
      console.log('Any enrollment found:', anyEnrollment ? `Yes, progress: ${anyEnrollment.progress?.overallProgress}%` : 'No');
      console.log('Required progress: 100%');
      console.log('Course has final exam:', course.finalExam && course.finalExam.isEnabled);
      console.log('Final exam passed:', anyEnrollment ? anyEnrollment.progress?.finalExamPassed : 'N/A');
      
      let errorMessage = 'Course not completed or enrollment not found';
      if (anyEnrollment) {
        if (anyEnrollment.progress?.overallProgress < 100) {
          errorMessage = 'Complete all course lessons to be eligible for certificate';
        } else if (course.finalExam && course.finalExam.isEnabled && !anyEnrollment.progress?.finalExamPassed) {
          errorMessage = 'Pass the final examination to receive your certificate';
        }
      }
      
      return res.status(404).json({ 
        error: errorMessage,
        debug: {
          courseFound: !!course,
          courseName: course.name,
          enrollmentFound: !!anyEnrollment,
          progress: anyEnrollment ? anyEnrollment.progress?.overallProgress : 0,
          requiredProgress: 100,
          hasFinalExam: course.finalExam && course.finalExam.isEnabled,
          finalExamPassed: anyEnrollment ? anyEnrollment.progress?.finalExamPassed : false,
          studentId: req.user.id,
          courseId: course._id.toString()
        }
      });
    }

    if (enrollment.certificateIssued) {
      return res.status(400).json({ error: 'Certificate already issued' });
    }

    // Generate certificate number and verification code
    const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const verificationCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    const issuedDate = new Date();

    // Create certificate HTML
    const certificateHTML = generateCertificateHTML({
      studentName: enrollment.student.fullName,
      courseName: enrollment.course.name,
      instructorName: enrollment.course.instructor.fullName || enrollment.course.instructor.name || 'Instructor',
      courseLevel: course.level || 'Intermediate',
      certificateNumber: certificateNumber,
      issuedDate: issuedDate
    });

    // Calculate course duration in weeks (estimate based on estimated hours)
    const courseDurationWeeks = Math.ceil((course.estimatedHours || 4) / 10); // Assuming 10 hours per week
    
    // Calculate final score (use enrollment progress as a proxy)
    const finalScore = enrollment.progress?.overallProgress || 100;

    // Create certificate record with all required fields
    const certificate = new Certificate({
      student: req.user.id,
      course: course._id,
      instructor: course.instructor,
      certificateId: certificateNumber,
      studentName: enrollment.student.fullName,
      courseName: enrollment.course.name,
      instructorName: enrollment.course.instructor.fullName || enrollment.course.instructor.name || 'Instructor',
      completionDate: issuedDate,
      issuedAt: issuedDate,
      finalScore: finalScore,
      courseDuration: courseDurationWeeks,
      verificationCode: verificationCode,
      metadata: {
        courseLevel: course.level || 'Intermediate',
        courseCategory: course.category || 'General',
        totalHours: course.estimatedHours || 4,
        completionRate: finalScore
      }
    });

    await certificate.save();

    // Update enrollment
    enrollment.certificateIssued = true;
    enrollment.certificateIssuedAt = issuedDate;
    enrollment.progress.certificateGenerated = true;
    await enrollment.save();

    // Set headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificateNumber}.html"`);
    res.send(certificateHTML);

  } catch (error) {
    console.error('Error generating certificate:', error);
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Certificate validation failed',
        details: error.message 
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({ 
        error: 'Database error - please try again later',
        details: 'Temporary database connectivity issue'
      });
    }
    
    if (error.code === 'ENOENT' || error.message.includes('file')) {
      return res.status(500).json({ 
        error: 'Certificate template error',
        details: 'Certificate generation system unavailable'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate certificate',
      details: 'An unexpected error occurred. Please try again or contact support.'
    });
  }
});

// Download existing certificate
app.get('/api/courses/:courseId/certificate/download', verifyTokenForCertificate, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Find course
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ name: decodeURIComponent(courseId) });
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Find certificate
    const certificate = await Certificate.findOne({
      student: req.user.id,
      course: course._id
    }).populate('student', 'fullName email')
      .populate('course', 'name instructor')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'fullName'
        }
      });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Generate certificate HTML
    const certificateHTML = generateCertificateHTML({
      studentName: certificate.student?.fullName || certificate.studentName,
      courseName: certificate.course?.name || certificate.courseName,
      instructorName: certificate.course?.instructor?.fullName || certificate.instructorName,
      courseLevel: course.level || 'Intermediate',
      certificateNumber: certificate.certificateId,
      issuedDate: certificate.issuedDate
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.certificateId}.html"`);
    res.send(certificateHTML);

  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

// Get existing certificate for preview
app.get('/api/courses/:courseId/certificate', verifyTokenForCertificate, async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log(`🎓 Certificate view request for courseId: ${courseId} by user: ${req.user.id}`);

    // Find course by name or ID
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`Looking up course by ObjectId: ${courseId}`);
      course = await Course.findById(courseId);
    } else {
      console.log(`Looking up course by name: ${courseId}`);
      course = await Course.findOne({ name: decodeURIComponent(courseId) });
    }

    if (!course) {
      console.log(`❌ Course not found for ID: ${courseId}`);
      return res.status(404).json({ error: 'Course not found' });
    }
    
    console.log(`✅ Found course: ${course.name} (ID: ${course._id})`);

    // Find existing certificate
    const certificate = await Certificate.findOne({
      student: req.user.id,
      course: course._id
    });

    if (!certificate) {
      console.log(`❌ No certificate found for user ${req.user.id} and course ${course._id}`);
      return res.status(404).json({ 
        error: 'Certificate not found',
        details: 'No certificate has been issued for this course yet'
      });
    }
    
    console.log(`✅ Certificate found: ${certificate.certificateId}`);

    // Validate certificate data and attempt recovery
    if (!certificate.studentName || !certificate.courseName || !certificate.certificateNumber) {
      console.error('Invalid certificate data detected, attempting recovery:', certificate);
      
      // Try to recover the certificate data
      try {
        const user = await User.findById(req.user.id);
        const enrollment = await Enrollment.findOne({
          student: req.user.id,
          course: course._id
        });

        if (user && enrollment) {
          // Update certificate with correct data
          certificate.studentName = user.fullName || user.username;
          certificate.courseName = course.name;
          certificate.instructorName = certificate.instructorName || 'Instructor';
          
          // Generate new certificate number if missing
          if (!certificate.certificateNumber) {
            certificate.certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          }
          
          // Ensure issuedAt date is set
          if (!certificate.issuedAt) {
            certificate.issuedAt = enrollment.certificateIssuedAt || certificate.createdAt || new Date();
          }
          
          await certificate.save();
          console.log('Certificate data recovered successfully');
        } else {
          throw new Error('Unable to recover certificate data - missing user or enrollment');
        }
      } catch (recoveryError) {
        console.error('Certificate recovery failed:', recoveryError);
        return res.status(500).json({ 
          error: 'Certificate data is corrupted and cannot be recovered',
          details: 'Please contact support to regenerate your certificate',
          action: 'regenerate_required'
        });
      }
    }

    // Generate certificate HTML with course level from metadata
    const certificateHTML = generateCertificateHTML({
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      instructorName: certificate.instructorName,
      certificateNumber: certificate.certificateId,
      issuedDate: certificate.issuedDate,
      courseLevel: certificate.metadata?.courseLevel || 'Intermediate'
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(certificateHTML);

  } catch (error) {
    console.error('Error retrieving certificate:', error);
    
    // Provide more specific error messages
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid certificate ID or course reference',
        details: 'The requested certificate could not be found'
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({ 
        error: 'Database error - please try again later',
        details: 'Temporary database connectivity issue'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to retrieve certificate',
      details: 'An unexpected error occurred. Please try again or contact support.'
    });
  }
});

// TEST ENDPOINT - Set course progress to 100% for testing certificates
app.post('/api/test/complete-course/:courseId', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('Test completion request for courseId:', courseId);
    console.log('User ID:', req.user.id);
    
    // Find course by name or ID (with better matching)
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      const decodedName = decodeURIComponent(courseId);
      // Try multiple matching strategies
      course = await Course.findOne({ 
        $or: [
          { name: decodedName },
          { name: { $regex: new RegExp(decodedName, 'i') } },
          { name: { $regex: new RegExp(decodedName.replace(/\s+/g, '.*'), 'i') } }
        ]
      });
    }

    console.log('Found course:', course ? `${course.name} (ID: ${course._id})` : 'None');

    if (!course) {
      // List available courses for debugging
      const allCourses = await Course.find({}).select('name _id');
      console.log('Available courses:', allCourses.map(c => c.name));
      return res.status(404).json({ 
        error: 'Course not found',
        debug: {
          requestedCourse: courseId,
          decodedName: decodeURIComponent(courseId),
          availableCourses: allCourses.map(c => c.name)
        }
      });
    }

    // Find or create enrollment
    let enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id
    });

    console.log('Found existing enrollment:', enrollment ? 'Yes' : 'No');

    if (!enrollment) {
      enrollment = new Enrollment({
        student: req.user.id,
        course: course._id,
        enrolledAt: new Date(),
        status: 'completed',
        progress: {
          overallProgress: 100,
          completedLessons: course.modules ? course.modules.reduce((total, module) => total + (module.lessons ? module.lessons.length : 0), 0) : 0,
          modules: course.modules ? course.modules.map(module => ({
            moduleId: module._id,
            completed: true,
            lessons: module.lessons ? module.lessons.map(lesson => ({
              lessonId: lesson._id,
              completed: true,
              completedAt: new Date()
            })) : []
          })) : []
        }
      });
    } else {
      // Initialize progress if it doesn't exist
      if (!enrollment.progress) {
        enrollment.progress = { modules: [], completedLessons: 0, overallProgress: 0 };
      }
      enrollment.progress.overallProgress = 100;
      enrollment.status = 'completed';
      enrollment.progress.completedLessons = course.modules ? course.modules.reduce((total, module) => total + (module.lessons ? module.lessons.length : 0), 0) : 0;
      
      // Mark all lessons as completed
      if (course.modules && course.modules.length > 0) {
        enrollment.progress.modules = course.modules.map(module => ({
          moduleId: module._id,
          completed: true,
          lessons: module.lessons ? module.lessons.map(lesson => ({
            lessonId: lesson._id,
            completed: true,
            completedAt: new Date()
          })) : []
        }));
      }
    }

    await enrollment.save();
    console.log('Enrollment saved with progress:', enrollment.progress.overallProgress);

    res.json({
      message: 'Course marked as 100% complete for testing',
      enrollment: {
        id: enrollment._id,
        progress: enrollment.progress.overallProgress,
        courseName: course.name
      }
    });

  } catch (error) {
    console.error('Error completing course for test:', error);
    res.status(500).json({ error: 'Failed to complete course', details: error.message });
  }
});

// Delete corrupted certificate to allow regeneration
app.delete('/api/courses/:courseId/certificate', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Find course by name or ID
    let course;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    } else {
      course = await Course.findOne({ name: decodeURIComponent(courseId) });
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Find and delete corrupted certificate
    const certificate = await Certificate.findOneAndDelete({
      student: req.user.id,
      course: course._id
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Update enrollment to allow certificate regeneration
    await Enrollment.findOneAndUpdate(
      { student: req.user.id, course: course._id },
      { 
        $unset: { 
          certificateIssued: 1, 
          certificateIssuedAt: 1,
          'progress.certificateGenerated': 1
        } 
      }
    );

    console.log('Deleted corrupted certificate for course:', course.name);
    res.json({ message: 'Certificate deleted successfully, you can now regenerate it' });

  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

// Get certificate HTML for PDF generation by certificate ID
app.get('/api/certificate/:certificateId/html', verifyTokenForCertificate, async (req, res) => {
  try {
    const { certificateId } = req.params;
    console.log(`🎓 Certificate HTML request for certificateId: ${certificateId} by user: ${req.user.id}`);

    // Find certificate by ID
    const certificate = await Certificate.findById(certificateId)
      .populate('student', 'fullName email')
      .populate('course', 'name instructor')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'fullName'
        }
      });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Verify the certificate belongs to the requesting user
    if (certificate.student._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This certificate does not belong to you.' });
    }

    // Get course details
    const course = certificate.course;

    // Generate certificate HTML with PDF functionality
    const certificateHTML = generateCertificateHTML({
      studentName: certificate.student?.fullName || certificate.studentName,
      courseName: course?.name || certificate.courseName,
      instructorName: course?.instructor?.fullName || certificate.instructorName,
      courseLevel: course.level || 'Intermediate',
      certificateNumber: certificate.certificateId,
      issuedDate: certificate.issuedDate
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(certificateHTML);

  } catch (error) {
    console.error('Error getting certificate HTML:', error);
    res.status(500).json({ error: 'Failed to load certificate' });
  }
});

// Get certificate as PDF for direct download
app.get('/api/certificate/:certificateId/pdf', verifyTokenForCertificate, async (req, res) => {
  try {
    const { certificateId } = req.params;
    console.log(`🎓 Certificate PDF request for certificateId: ${certificateId} by user: ${req.user.id}`);

    // Find certificate by ID
    const certificate = await Certificate.findById(certificateId)
      .populate('student', 'fullName email')
      .populate('course', 'name instructor')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'fullName'
        }
      });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Verify the certificate belongs to the requesting user
    if (certificate.student._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This certificate does not belong to you.' });
    }

    // Get course details
    const course = certificate.course;

    // Generate optimized certificate HTML for PDF
    const certificateHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate of Completion</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            background: #ffffff;
            width: 210mm;
            height: 297mm;
            padding: 20mm;
            color: #333;
        }
        
        .certificate-container {
            width: 100%;
            height: 100%;
            background: white;
            border: 8px solid #1e3a8a;
            border-radius: 20px;
            padding: 30px;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .decorative-border {
            position: absolute;
            top: 15px;
            left: 15px;
            right: 15px;
            bottom: 15px;
            border: 2px solid #3b82f6;
            border-radius: 15px;
        }
        
        .header {
            text-align: center;
            z-index: 1;
            margin-bottom: 20px;
        }
        
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 10px;
        }
        
        .certificate-title {
            font-size: 36px;
            color: #1f2937;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .subtitle {
            font-size: 16px;
            color: #6b7280;
            font-style: italic;
        }
        
        .content {
            text-align: center;
            z-index: 1;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .awarded-to {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 15px;
        }
        
        .student-name {
            font-size: 42px;
            color: #1f2937;
            margin-bottom: 25px;
            font-weight: bold;
            text-decoration: underline;
            text-decoration-color: #1e3a8a;
            text-underline-offset: 8px;
        }
        
        .completion-text {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 20px;
        }
        
        .course-name {
            font-size: 28px;
            color: #1e3a8a;
            font-weight: bold;
            margin-bottom: 25px;
            padding: 15px 25px;
            border: 3px solid #1e3a8a;
            border-radius: 15px;
            display: inline-block;
            background: rgba(30, 58, 138, 0.05);
        }
        
        .instructor-info {
            font-size: 16px;
            color: #6b7280;
            line-height: 1.8;
        }
        
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
            font-size: 14px;
            color: #6b7280;
            margin-top: 20px;
        }
        
        .seal {
            position: absolute;
            top: 40px;
            right: 50px;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            border: 4px solid #ffffff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 2;
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="decorative-border"></div>
        <div class="seal">🏆</div>
        
        <div class="header">
            <div class="logo">📚 LearnNova</div>
            <h1 class="certificate-title">Certificate of Completion</h1>
            <p class="subtitle">This certifies that</p>
        </div>
        
        <div class="content">
            <p class="awarded-to">This certificate is proudly awarded to</p>
            <h2 class="student-name">${certificate.student?.fullName || certificate.studentName}</h2>
            
            <p class="completion-text">
                for successfully completing the online course
            </p>
            
            <div class="course-name">${course?.name || certificate.courseName}</div>
            
            <div class="instructor-info">
                <p><strong>Instructor:</strong> ${course?.instructor?.fullName || certificate.instructorName}</p>
                <p><strong>Course Level:</strong> ${course?.level || 'Intermediate'}</p>
            </div>
        </div>
        
        <div class="footer">
            <div class="certificate-number">
                <strong>Certificate No:</strong> ${certificate.certificateId}
            </div>
            <div class="issue-date">
                <strong>Date Issued:</strong> ${certificate.issuedDate ? new Date(certificate.issuedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }) : new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    </div>
</body>
</html>`;

    // Generate PDF using Puppeteer
    const puppeteer = require('puppeteer');
    
    console.log('🚀 Starting Puppeteer...');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    console.log('📄 Creating new page...');
    const page = await browser.newPage();
    
    console.log('🎨 Setting content...');
    await page.setContent(certificateHTML, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('📊 Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });
    
    console.log('🏁 Closing browser...');
    await browser.close();

    console.log(`📄 PDF generated for certificate ${certificate.certificateId}, size: ${pdfBuffer.length} bytes`);

    if (pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.certificateId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log(`📤 Sending PDF response for certificate ${certificate.certificateId}`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    
    // Fallback: Return HTML version with instructions
    const fallbackHTML = `
      <html>
        <head><title>Certificate Download</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>PDF Generation Issue</h2>
          <p>There was an issue generating the PDF. Please try one of these options:</p>
          <div style="margin: 30px 0;">
            <button onclick="window.print()" style="padding: 10px 20px; margin: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Print Certificate
            </button>
            <button onclick="window.location.href='/api/certificate/${certificateId}/html?token=${req.query.token || req.headers.authorization?.replace('Bearer ', '')}'" 
                    style="padding: 10px 20px; margin: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
              View Certificate
            </button>
          </div>
          <p><small>Technical details: ${error.message}</small></p>
        </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(fallbackHTML);
  }
});

// Function to generate certificate HTML
function generateCertificateHTML(data) {
  const { studentName, courseName, instructorName, courseLevel, certificateNumber, issuedDate } = data;
  
  // Ensure issuedDate is a valid Date object
  const certificateDate = issuedDate ? new Date(issuedDate) : new Date();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate of Completion - ${courseName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .certificate-container {
            background: white;
            width: 100%;
            max-width: 800px;
            padding: 60px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            border-radius: 15px;
            position: relative;
            overflow: hidden;
        }
        
        .certificate-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .certificate-title {
            font-family: 'Playfair Display', serif;
            font-size: 3rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .subtitle {
            font-size: 1.2rem;
            color: #7f8c8d;
            font-weight: 300;
        }
        
        .content {
            text-align: center;
            margin: 50px 0;
        }
        
        .awarded-to {
            font-size: 1.1rem;
            color: #7f8c8d;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .student-name {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 30px;
            text-decoration: underline;
            text-decoration-color: #667eea;
            text-decoration-thickness: 3px;
            text-underline-offset: 10px;
        }
        
        .completion-text {
            font-size: 1.2rem;
            color: #34495e;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        
        .course-name {
            font-size: 1.8rem;
            font-weight: 600;
            color: #667eea;
            margin: 20px 0;
            padding: 15px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border-radius: 10px;
            border-left: 5px solid #667eea;
        }
        
        .instructor-info {
            margin-top: 40px;
            font-size: 1rem;
            color: #7f8c8d;
        }
        
        .instructor-info p {
            margin-bottom: 8px;
        }
        
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #ecf0f1;
        }
        
        .certificate-number {
            font-size: 0.9rem;
            color: #95a5a6;
            font-weight: 500;
        }
        
        .issue-date {
            font-size: 0.9rem;
            color: #95a5a6;
            font-weight: 500;
        }
        
        .seal {
            position: absolute;
            top: 30px;
            right: 30px;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 2rem;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        .decorative-border {
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 3px solid;
            border-image: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) 1;
            border-radius: 10px;
            pointer-events: none;
        }
        
        @media print {
            body {
                background: white;
                margin: 0;
                padding: 0;
            }
            
            .certificate-container {
                box-shadow: none;
                margin: 0;
                padding: 40px;
            }
        }
        
        @media (max-width: 768px) {
            .certificate-container {
                padding: 30px 20px;
            }
            
            .certificate-title {
                font-size: 2.2rem;
            }
            
            .student-name {
                font-size: 2rem;
            }
            
            .course-name {
                font-size: 1.4rem;
            }
            
            .seal {
                width: 60px;
                height: 60px;
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="decorative-border"></div>
        <div class="seal">🏆</div>
        
        <div class="header">
            <div class="logo">📚 LearNova</div>
            <h1 class="certificate-title">Certificate of Completion</h1>
            <p class="subtitle">This certifies that</p>
        </div>
        
        <div class="content">
            <p class="awarded-to">This is awarded to</p>
            <h2 class="student-name">${studentName}</h2>
            
            <p class="completion-text">
                for successfully completing the online course
            </p>
            
            <div class="course-name">${courseName}</div>
            
            <div class="instructor-info">
                <p>Instructed by: <strong>${instructorName}</strong></p>
                <p>Course Level: <strong>${courseLevel}</strong></p>
            </div>
        </div>
        
        <div class="footer">
            <div class="certificate-number">
                Certificate No: ${certificateNumber}
            </div>
            <div class="issue-date">
                Issued on: ${certificateDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    </div>
    
    <!-- Include html2pdf library for PDF generation -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    
    <script>
        // Auto-download PDF when page loads
        window.onload = function() {
            setTimeout(() => {
                downloadCertificateAsPDF();
            }, 1000); // Wait 1 second for styles to load
        }
        
        // Download certificate as PDF
        function downloadCertificateAsPDF() {
            const element = document.querySelector('.certificate-container');
            const opt = {
                margin: 0.5,
                filename: 'certificate-${certificateNumber}.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    allowTaint: true 
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'landscape' 
                }
            };
            
            html2pdf()
                .set(opt)
                .from(element)
                .save()
                .catch(error => {
                    console.error('PDF generation error:', error);
                    // Fallback: trigger browser print dialog
                    window.print();
                });
        }
        
        // Manual download button (if needed)
        function downloadPDF() {
            downloadCertificateAsPDF();
        }
        </script>
        
        <!-- Add download button -->
        <div style="text-align: center; margin-top: 2rem; no-print;">
            <button onclick="downloadPDF()" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                📄 Download PDF
            </button>
        </div>
        
        <style>
            @media print {
                .no-print { display: none !important; }
            }
        </style>
</body>
</html>`;
}

// Function to generate optimized certificate HTML for PDF (single page)
function generateOptimizedCertificateHTML(data) {
  const { studentName, courseName, instructorName, courseLevel, certificateNumber, issuedDate } = data;
  
  // Ensure issuedDate is a valid Date object
  const certificateDate = issuedDate ? new Date(issuedDate) : new Date();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate of Completion</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .certificate-container {
            width: 100%;
            max-width: 800px;
            background: white;
            border: 8px solid #667eea;
            border-radius: 20px;
            padding: 40px;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            height: 600px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .decorative-border {
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 2px solid #764ba2;
            border-radius: 15px;
        }
        
        .header {
            text-align: center;
            z-index: 1;
        }
        
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .certificate-title {
            font-size: 2.2rem;
            color: #333;
            margin-bottom: 8px;
            font-weight: normal;
        }
        
        .subtitle {
            font-size: 1rem;
            color: #666;
            font-style: italic;
        }
        
        .content {
            text-align: center;
            z-index: 1;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .awarded-to {
            font-size: 1rem;
            color: #666;
            margin-bottom: 10px;
        }
        
        .student-name {
            font-size: 2.5rem;
            color: #333;
            margin-bottom: 20px;
            font-weight: bold;
            text-decoration: underline;
            text-decoration-color: #667eea;
        }
        
        .completion-text {
            font-size: 1rem;
            color: #666;
            margin-bottom: 15px;
        }
        
        .course-name {
            font-size: 1.6rem;
            color: #667eea;
            font-weight: bold;
            margin-bottom: 20px;
            padding: 10px 20px;
            border: 2px solid #667eea;
            border-radius: 10px;
            display: inline-block;
        }
        
        .instructor-info {
            font-size: 0.9rem;
            color: #666;
            line-height: 1.6;
        }
        
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
            font-size: 0.85rem;
            color: #666;
        }
        
        .certificate-number {
            text-align: left;
        }
        
        .issue-date {
            text-align: right;
        }
        
        .seal {
            position: absolute;
            top: 30px;
            right: 50px;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            border: 3px solid #fff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 2;
        }
        
        @media print {
            body {
                padding: 0;
                height: auto;
            }
            
            .certificate-container {
                max-width: none;
                width: 100%;
                height: auto;
                min-height: 600px;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="decorative-border"></div>
        <div class="seal">🏆</div>
        
        <div class="header">
            <div class="logo">📚 LearnNova</div>
            <h1 class="certificate-title">Certificate of Completion</h1>
            <p class="subtitle">This certifies that</p>
        </div>
        
        <div class="content">
            <p class="awarded-to">This is awarded to</p>
            <h2 class="student-name">${studentName}</h2>
            
            <p class="completion-text">
                for successfully completing the online course
            </p>
            
            <div class="course-name">${courseName}</div>
            
            <div class="instructor-info">
                <p><strong>Instructor:</strong> ${instructorName} | <strong>Level:</strong> ${courseLevel}</p>
            </div>
        </div>
        
        <div class="footer">
            <div class="certificate-number">
                <strong>Certificate No:</strong> ${certificateNumber}
            </div>
            <div class="issue-date">
                <strong>Date Issued:</strong> ${certificateDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Get all certificates for the current student
app.get('/api/student/certificates', verifyToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Find all certificates for this student
    const certificates = await Certificate.find({ 
      student: studentId,
      status: 'active' // Only show active certificates
    })
    .populate('course', 'name category level')
    .populate('instructor', 'fullName')
    .sort({ issuedDate: -1 }); // Most recent first
    
    const formattedCertificates = certificates.map(cert => ({
      _id: cert._id,
      certificateId: cert.certificateId,
      courseName: cert.courseName,
      courseId: cert.course ? cert.course._id : null,
      courseCategory: cert.metadata ? cert.metadata.courseCategory : (cert.course ? cert.course.category : ''),
      courseLevel: cert.metadata ? cert.metadata.courseLevel : (cert.course ? cert.course.level : ''),
      instructorName: cert.instructorName,
      completionDate: cert.completionDate,
      issuedDate: cert.issuedDate,
      finalScore: cert.finalScore,
      courseDuration: cert.courseDuration,
      skills: cert.skills || [],
      verificationCode: cert.verificationCode,
      totalHours: cert.metadata ? cert.metadata.totalHours : null,
      completionRate: cert.metadata ? cert.metadata.completionRate : null
    }));
    
    res.json(formattedCertificates);
    
  } catch (error) {
    console.error('Error fetching student certificates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch certificates',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: 'ok',
    database: {
      state: dbStates[dbState],
      connected: dbState === 1
    },
    server: 'running',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the server at http://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});

// Test function to ensure certificates work (run after DB connection)
async function ensureTestCertificate() {
  try {
    const existingCerts = await Certificate.countDocuments({ 
      student: '68811524b71f9c0e85afb5c8' 
    });
    
    if (existingCerts === 0) {
      console.log('🏆 Creating test certificate for demo...');
      
      const testCert = new Certificate({
        student: '68811524b71f9c0e85afb5c8',
        course: '688244355cc851d42b0d939a',
        instructor: '68812d140f216c24f64ac609',
        certificateId: `CERT-DEMO-${Date.now()}`,
        studentName: 'Demo Student',
        courseName: 'ghjk Programming Course',
        instructorName: 'Demo Instructor',
        completionDate: new Date(),
        finalScore: 88,
        courseDuration: 6,
        skills: ['JavaScript', 'Programming', 'Web Development'],
        verificationCode: `VER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        metadata: {
          totalHours: 25,
          completionRate: 100,
          courseCategory: 'Programming',
          courseLevel: 'Intermediate'
        }
      });
      
      await testCert.save();
      console.log('✅ Demo certificate created:', testCert.certificateId);
    } else {
      console.log(`📋 Found ${existingCerts} existing certificates for demo student`);
    }
  } catch (error) {
    console.log('⚠️ Certificate test error:', error.message);
  }
}
