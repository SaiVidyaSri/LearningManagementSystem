const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // NEW: JWT for authentication
const path = require('path'); 

const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Review = require('./models/Review');
const Certificate = require('./models/Certificate');
const Query = require('./models/Query');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// ADMIN CREDENTIALS - FIXED CREDENTIALS FOR ADMIN LOGIN
const ADMIN_CREDENTIALS = {
  email: 'admin@learnova.com',
  password: 'admin123'
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGODB_URI = "mongodb+srv://vidyadonthagani:vidya2004@cluster0.acdpvpq.mongodb.net/lms?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(error => console.error('Error connecting to MongoDB:', error));

// MIDDLEWARE: Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
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

// NEW: Redirect /login POST to /api/login for compatibility
app.post('/login', (req, res) => {
  res.redirect(307, '/api/login');  // 307 preserves POST method and body
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

    const courses = await Course.find(query)
      .populate('instructor', 'fullName')
      .select('-modules -quizzes -finalExam')
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
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get course details by ID
app.get('/api/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findById(courseId)
      .populate('instructor', 'fullName email')
      .populate({
        path: 'reviews',
        populate: {
          path: 'student',
          select: 'fullName'
        }
      });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error fetching course details:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

// Create new course (instructor only)
app.post('/api/courses', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      instructor: req.user.id,
      instructorName: req.user.fullName || 'Unknown Instructor'
    };

    const course = new Course(courseData);
    await course.save();

    res.status(201).json({
      message: 'Course created successfully!',
      course
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Update course (instructor only - own courses)
app.put('/api/courses/:courseId', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findOne({ _id: courseId, instructor: req.user.id });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    Object.assign(course, req.body);
    await course.save();

    res.json({
      message: 'Course updated successfully!',
      course
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Get instructor's courses
app.get('/api/instructor/courses', verifyToken, verifyInstructor, async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user.id })
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching instructor courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ==================== ENROLLMENT ENDPOINTS ====================

// Enroll in a course
app.post('/api/enroll', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = new Enrollment({
      student: req.user.id,
      course: courseId,
      progress: {
        totalModules: course.modules.length,
        totalLessons: course.modules.reduce((total, module) => total + module.lessons.length, 0)
      }
    });

    await enrollment.save();

    // Update course enrollment count
    course.enrollmentCount += 1;
    await course.save();

    res.status(201).json({
      message: 'Successfully enrolled in course!',
      enrollment
    });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

// Get student's enrollments
app.get('/api/my-courses', verifyToken, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate('course', 'name shortDescription image instructor duration level')
      .populate('course.instructor', 'fullName')
      .sort({ enrolledAt: -1 });

    res.json(enrollments);
  } catch (error) {
    console.error('Error fetching student courses:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled courses' });
  }
});

// Update lesson progress
app.put('/api/progress/lesson', verifyToken, async (req, res) => {
  try {
    const { courseId, moduleId, lessonId, completed, timeSpent } = req.body;
    
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Find or create module progress
    let moduleProgress = enrollment.progress.modules.find(m => m.moduleId.toString() === moduleId);
    if (!moduleProgress) {
      moduleProgress = {
        moduleId: moduleId,
        lessons: []
      };
      enrollment.progress.modules.push(moduleProgress);
    }

    // Find or create lesson progress
    let lessonProgress = moduleProgress.lessons.find(l => l.lessonId.toString() === lessonId);
    if (!lessonProgress) {
      lessonProgress = {
        lessonId: lessonId,
        completed: false,
        timeSpent: 0
      };
      moduleProgress.lessons.push(lessonProgress);
    }

    // Update lesson progress
    lessonProgress.completed = completed;
    lessonProgress.timeSpent += timeSpent || 0;
    if (completed && !lessonProgress.completedAt) {
      lessonProgress.completedAt = new Date();
    }

    // Update overall progress
    const totalLessons = enrollment.progress.totalLessons;
    const completedLessons = enrollment.progress.modules.reduce((total, module) => {
      return total + module.lessons.filter(lesson => lesson.completed).length;
    }, 0);

    enrollment.progress.completedLessons = completedLessons;
    enrollment.progress.overallProgress = Math.round((completedLessons / totalLessons) * 100);

    await enrollment.save();

    res.json({
      message: 'Progress updated successfully',
      progress: enrollment.progress
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ==================== REVIEW ENDPOINTS ====================

// Submit course review
app.post('/api/reviews', verifyToken, async (req, res) => {
  try {
    const { courseId, rating, title, comment, pros, cons, wouldRecommend } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (!enrollment) {
      return res.status(400).json({ error: 'Must be enrolled to review this course' });
    }

    const existingReview = await Review.findOne({
      student: req.user.id,
      course: courseId
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this course' });
    }

    const review = new Review({
      student: req.user.id,
      course: courseId,
      instructor: course.instructor,
      rating,
      title,
      comment,
      pros: pros || [],
      cons: cons || [],
      wouldRecommend: wouldRecommend !== false,
      verified: enrollment.status === 'completed'
    });

    await review.save();

    // Update course rating
    const allReviews = await Review.find({ course: courseId, status: 'approved' });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    course.averageRating = totalRating / allReviews.length;
    course.totalRatings = allReviews.length;
    await course.save();

    res.status(201).json({
      message: 'Review submitted successfully!',
      review
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get course reviews
app.get('/api/courses/:courseId/reviews', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = await Review.find({ course: courseId, status: 'approved' })
      .populate('student', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ course: courseId, status: 'approved' });

    res.json({
      reviews,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ==================== CERTIFICATE ENDPOINTS ====================

// Generate certificate for completed course
app.post('/api/certificates/generate', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
      status: 'completed'
    }).populate('course').populate('student');

    if (!enrollment) {
      return res.status(400).json({ error: 'Course not completed or enrollment not found' });
    }

    const existingCertificate = await Certificate.findOne({
      student: req.user.id,
      course: courseId
    });

    if (existingCertificate) {
      return res.json({
        message: 'Certificate already exists',
        certificate: existingCertificate
      });
    }

    const certificate = new Certificate({
      student: req.user.id,
      course: courseId,
      instructor: enrollment.course.instructor,
      studentName: enrollment.student.fullName,
      courseName: enrollment.course.name,
      instructorName: enrollment.course.instructorName,
      completionDate: enrollment.completedAt,
      finalScore: enrollment.finalExamScore?.score || 100,
      courseDuration: enrollment.course.duration,
      skills: enrollment.course.learningOutcomes || [],
      metadata: {
        courseLevel: enrollment.course.level,
        courseCategory: enrollment.course.category,
        totalHours: enrollment.course.estimatedHours,
        completionRate: enrollment.progress.overallProgress
      }
    });

    await certificate.save();

    // Update enrollment
    enrollment.certificateIssued = true;
    enrollment.certificateIssuedAt = new Date();
    await enrollment.save();

    res.status(201).json({
      message: 'Certificate generated successfully!',
      certificate
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// Get user's certificates
app.get('/api/my-certificates', verifyToken, async (req, res) => {
  try {
    const certificates = await Certificate.find({ student: req.user.id })
      .populate('course', 'name image')
      .sort({ issuedDate: -1 });

    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// Verify certificate
app.get('/api/certificates/verify/:certificateId', async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    const certificate = await Certificate.findOne({ certificateId })
      .populate('student', 'fullName')
      .populate('course', 'name')
      .populate('instructor', 'fullName');

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    if (certificate.status !== 'active') {
      return res.status(400).json({ error: 'Certificate is not active' });
    }

    res.json({
      valid: true,
      certificate: {
        id: certificate.certificateId,
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        instructorName: certificate.instructorName,
        completionDate: certificate.completionDate,
        issuedDate: certificate.issuedDate,
        verificationCode: certificate.verificationCode
      }
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

// ==================== QUERY/SUPPORT ENDPOINTS ====================

// Submit support query
app.post('/api/queries', verifyToken, async (req, res) => {
  try {
    const { courseId, category, subject, description, priority } = req.body;
    
    let instructor = null;
    if (courseId) {
      const course = await Course.findById(courseId);
      if (course) {
        instructor = course.instructor;
      }
    }

    const query = new Query({
      student: req.user.id,
      course: courseId || null,
      instructor: instructor,
      category,
      subject,
      description,
      priority: priority || 'medium'
    });

    await query.save();

    res.status(201).json({
      message: 'Query submitted successfully!',
      query
    });
  } catch (error) {
    console.error('Error submitting query:', error);
    res.status(500).json({ error: 'Failed to submit query' });
  }
});

// Get user's queries
app.get('/api/my-queries', verifyToken, async (req, res) => {
  try {
    const queries = await Query.find({ student: req.user.id })
      .populate('course', 'name')
      .sort({ createdAt: -1 });

    res.json(queries);
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// ==================== USER PROFILE ENDPOINTS ====================

// Get user profile
app.get('/api/user/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ fullName: username })
      .select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
app.put('/api/update-profile', verifyToken, async (req, res) => {
  try {
    const { username, fullName } = req.body;
    
    const user = await User.findOne({ fullName: username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.fullName = fullName;
    await user.save();

    res.json({
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        username: user.fullName,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
app.put('/api/change-password', verifyToken, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    
    const user = await User.findOne({ fullName: username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get student progress details
app.get('/api/student-progress-details', verifyToken, async (req, res) => {
  try {
    const { username, email } = req.query;
    
    const user = await User.findOne({ 
      $or: [
        { fullName: username },
        { email: email }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const enrollments = await Enrollment.find({ student: user._id })
      .populate('course', 'name shortDescription image duration level')
      .sort({ enrolledAt: -1 });

    const progressData = enrollments.map(enrollment => ({
      courseId: enrollment.course._id,
      courseName: enrollment.course.name,
      courseImage: enrollment.course.image,
      enrolledAt: enrollment.enrolledAt,
      progress: enrollment.progress.overallProgress,
      status: enrollment.status,
      isCompleted: enrollment.status === 'completed',
      completedAt: enrollment.completedAt
    }));

    res.json(progressData);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ error: 'Failed to fetch student progress' });
  }
});

// Get user data for download
app.get('/api/user-data/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ fullName: username }).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const enrollments = await Enrollment.find({ student: user._id }).populate('course', 'name');
    const certificates = await Certificate.find({ student: user._id }).populate('course', 'name');
    const reviews = await Review.find({ student: user._id }).populate('course', 'name');
    const queries = await Query.find({ student: user._id }).populate('course', 'name');

    const userData = {
      profile: user,
      enrollments,
      certificates,
      reviews,
      queries,
      exportedAt: new Date()
    };

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// ==================== CATCH-ALL ROUTES FOR HTML FILES ====================

// Handle direct access to HTML files without .html extension
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/courses', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'courses.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/my-courses', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-courses.html'));
});

app.get('/instructor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'instructor-dashboard.html'));
});

app.get('/instructor-create-course', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'instructor-create-course.html'));
});

app.get('/admin-users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-users.html'));
});

app.get('/admin-courses', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-courses.html'));
});

app.get('/admin-instructors', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-instructors.html'));
});

app.get('/admin-reviews', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-reviews.html'));
});

app.get('/admin-reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-reports.html'));
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

// Handle 404 errors for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Handle all other routes - redirect to index.html for SPA behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global 404 handler for unmatched routes (including non-GET methods)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Your frontend is available at http://localhost:5000/index.html');
  console.log(`Admin credentials: ${ADMIN_CREDENTIALS.email} / ${ADMIN_CREDENTIALS.password}`);
});
