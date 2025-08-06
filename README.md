# 📚 LearNova - Learning Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://www.mongodb.com/atlas)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue)](https://expressjs.com/)

A comprehensive Learning Management System built with Node.js, Express, MongoDB, and vanilla HTML/CSS/JavaScript. LearNova provides a complete platform for online education with features for students, instructors, and administrators.

## 🌟 Features

### 👨‍🎓 **Student Features**
- **User Registration & Authentication** - Secure account creation and login
- **Course Browsing & Search** - Discover courses with advanced filtering
- **Course Enrollment** - Easy enrollment with progress tracking
- **Interactive Learning** - Video lessons, documents, and interactive content
- **Progress Tracking** - Monitor your learning journey
- **Quizzes & Assessments** - Test your knowledge with built-in quizzes
- **Certificate Generation** - Earn certificates upon course completion
- **Review System** - Rate and review courses
- **Query Support** - Get help through the support system
- **Personalized Dashboard** - Track enrollments and achievements

### 👨‍🏫 **Instructor Features**
- **Instructor Application** - Apply to become an instructor
- **Course Creation** - Advanced course builder with modules and lessons
- **Content Management** - Upload videos, documents, and resources
- **Student Management** - Monitor student progress and engagement
- **Quiz Builder** - Create assessments and exams
- **Analytics Dashboard** - Track course performance and student analytics
- **Query Management** - Respond to student questions
- **Revenue Tracking** - Monitor earnings and course statistics

### 🔧 **Admin Features**
- **User Management** - Manage all platform users
- **Instructor Approval** - Review and approve instructor applications
- **Course Moderation** - Approve, reject, or modify courses
- **Platform Analytics** - Comprehensive system statistics
- **Content Oversight** - Monitor and manage all platform content
- **Support Management** - Handle platform-wide support queries
- **System Configuration** - Manage platform settings and features

## 🚀 **Live Demo**

### **Admin Access**
- **Email**: `admin@learnova.com`
- **Password**: `admin123`

### **Demo Student Account**
- **Email**: `demo@learnhub.com`
- **Password**: `demo123`

### **Demo Instructor Account**
- **Email**: `john.smith@learnova.com`
- **Password**: `demo123`

## 🛠️ **Technology Stack**

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB Atlas** - Cloud database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication and authorization
- **bcryptjs** - Password hashing
- **Multer** - File upload handling

### **Frontend**
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Flexbox/Grid
- **JavaScript (ES6+)** - Interactive functionality
- **Responsive Design** - Mobile-first approach

### **Security & Performance**
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API protection
- **Compression** - Response compression
- **Winston** - Logging system

## 📋 **Prerequisites**

- **Node.js** (v16.0 or higher)
- **npm** (v8.0 or higher)
- **MongoDB Atlas** account (free tier available)
- **Git** (for version control)

## ⚡ **Quick Start**

### 1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/learnova-lms.git
cd learnova-lms
```

### 2. **Install Dependencies**
```bash
npm install
```

### 3. **Environment Setup**
Create a `.env` file in the root directory:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secure_jwt_secret_key
ADMIN_EMAIL=admin@learnova.com
ADMIN_PASSWORD=admin123
```

### 4. **Database Setup**
```bash
# Seed the database with sample data
npm run seed
```

### 5. **Start the Server**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 6. **Access the Application**
- **Frontend**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs

## 📁 **Project Structure**

```
lms-project/
├── 📁 models/                 # Database models
│   ├── User.js               # User schema
│   ├── Course.js             # Course schema
│   ├── Enrollment.js         # Enrollment tracking
│   ├── Review.js             # Course reviews
│   ├── Certificate.js        # Certificate generation
│   └── Query.js              # Support queries
├── 📁 public/                # Frontend files
│   ├── 📄 index.html         # Landing page
│   ├── 📄 login.html         # Authentication
│   ├── 📄 dashboard.html     # User dashboard
│   ├── 📄 courses.html       # Course catalog
│   ├── 📄 about.html         # About page
│   ├── 📄 contact.html       # Contact page
│   ├── 📄 search.html        # Course search
│   ├── 🎨 styles.css         # Styling
│   └── 📁 instructor/        # Instructor pages
├── 📁 scripts/               # Utility scripts
│   ├── seed.js               # Database seeding
│   └── backup.js             # Backup utility
├── 📁 uploads/               # File uploads
├── 🔧 server.js              # Main server file
├── 📋 package.json           # Dependencies
├── 📖 README.md              # This file
├── 📚 API_DOCUMENTATION.md   # API docs
└── 🚀 DEPLOYMENT_GUIDE.md    # Deployment guide
```

## 🔗 **API Endpoints**

### **Authentication**
- `POST /api/register` - User registration
- `POST /api/login` - User authentication

### **Course Management**
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course (instructor)
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### **User Management**
- `GET /api/users` - Get all users (admin)
- `PUT /api/users/:id/role` - Update user role
- `PUT /api/users/:id/instructor-status` - Update instructor status

### **Enrollment**
- `POST /api/enroll` - Enroll in course
- `GET /api/my-enrollments` - Get user enrollments
- `PUT /api/enrollments/:id/progress` - Update progress

### **Reviews & Certificates**
- `POST /api/reviews` - Submit review
- `GET /api/certificates` - Get user certificates
- `GET /api/certificates/:id/verify` - Verify certificate

> 📖 **Complete API documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🚀 **Deployment**

### **Quick Deploy Options**

#### **Heroku** (Recommended)
```bash
# Install Heroku CLI and login
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret
git push heroku main
```

#### **Vercel**
```bash
npm install -g vercel
vercel
# Follow the prompts and set environment variables
```

#### **Digital Ocean App Platform**
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy with one click

> 🚀 **Detailed deployment guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🧪 **Available Scripts**

```bash
npm start           # Start production server
npm run dev         # Start development server with auto-reload
npm test            # Run test suite
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
npm run seed        # Seed database with sample data
npm run backup      # Create database backup
npm run build       # Run linting and tests
```

## 🔒 **Security Features**

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Input Validation** - Server-side validation
- **Rate Limiting** - API request limiting
- **CORS Protection** - Cross-origin resource sharing
- **Helmet Security** - Security headers
- **Environment Variables** - Secure configuration
- **File Upload Validation** - Type and size restrictions

## 📊 **Database Models**

### **User Model**
```javascript
{
  fullName: String,
  email: String (unique),
  password: String (hashed),
  role: ['student', 'instructor', 'admin'],
  instructorStatus: ['pending', 'approved', 'rejected'],
  instructorApplication: Object,
  createdAt: Date
}
```

### **Course Model**
```javascript
{
  name: String,
  description: String,
  instructor: ObjectId,
  category: String,
  level: ['Beginner', 'Intermediate', 'Advanced'],
  duration: Number,
  price: Number,
  modules: [ModuleSchema],
  status: ['draft', 'pending', 'published', 'rejected'],
  averageRating: Number,
  enrollmentCount: Number
}
```

## 🤝 **Contributing**

We welcome contributions to LearNova! Here's how you can help:

### **Getting Started**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### **Contribution Guidelines**
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use meaningful commit messages
- Keep PRs focused and small

### **Development Setup**
```bash
# Install development dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Check code style
npm run lint
```

## 🐛 **Bug Reports & Feature Requests**

Please use the [GitHub Issues](https://github.com/yourusername/learnova-lms/issues) page to:
- Report bugs
- Request new features
- Suggest improvements
- Ask questions

### **Bug Report Template**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g. Windows 10]
- Browser: [e.g. Chrome 96]
- Node.js version: [e.g. 16.14.0]
```

## 📈 **Roadmap**

### **Upcoming Features**
- [ ] **Real-time Chat** - Student-instructor communication
- [ ] **Live Sessions** - Video conferencing integration
- [ ] **Mobile App** - React Native mobile application
- [ ] **Payment Gateway** - Stripe/PayPal integration
- [ ] **Advanced Analytics** - Detailed learning analytics
- [ ] **Gamification** - Badges, points, and leaderboards
- [ ] **Multi-language Support** - Internationalization
- [ ] **AI Recommendations** - Personalized course suggestions
- [ ] **Offline Support** - Download courses for offline viewing
- [ ] **Integration APIs** - Third-party service integrations

### **Current Version: v1.0.0**
- ✅ Core LMS functionality
- ✅ User management system
- ✅ Course creation and management
- ✅ Assessment and certification
- ✅ Review and rating system
- ✅ Admin dashboard
- ✅ Responsive design

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 LearNova

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 👥 **Team**

- **[Your Name]** - *Lead Developer* - [GitHub](https://github.com/yourusername)
- **Contributors** - See [Contributors](https://github.com/yourusername/learnova-lms/contributors)

## 🙏 **Acknowledgments**

- **MongoDB Atlas** - For providing excellent cloud database services
- **Express.js Community** - For the robust web framework
- **Node.js Foundation** - For the powerful JavaScript runtime
- **Open Source Community** - For the amazing libraries and tools

## 📞 **Support**

### **Documentation**
- 📖 [API Documentation](./API_DOCUMENTATION.md)
- 🚀 [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- 💻 [Developer Guide](./DEVELOPER_GUIDE.md)

### **Community**
- 💬 [Discord Server](https://discord.gg/learnova)
- 📧 [Email Support](mailto:support@learnova.com)
- 🐛 [GitHub Issues](https://github.com/yourusername/learnova-lms/issues)
- 📖 [Wiki](https://github.com/yourusername/learnova-lms/wiki)

### **Professional Support**
For enterprise support and custom development:
- 📧 enterprise@learnova.com
- 📞 +1 (555) 123-4567

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

Made with ❤️ by the LearNova Team

[🚀 Live Demo](https://learnova-demo.herokuapp.com) | [📖 Documentation](./API_DOCUMENTATION.md) | [🐛 Report Bug](https://github.com/yourusername/learnova-lms/issues) | [💡 Request Feature](https://github.com/yourusername/learnova-lms/issues)

</div>

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)
- MongoDB Atlas account (connection string already configured)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Setup
The application is pre-configured with:
- MongoDB Atlas connection string
- JWT secret key
- Admin credentials
- CORS settings

### Step 3: Start the Server
```bash
node server.js
```

The server will start on `http://localhost:5000`

### Step 4: Access the Application
- **Homepage**: http://localhost:5000/index.html
- **Student Registration**: http://localhost:5000/register.html
- **Login**: http://localhost:5000/login.html
- **Admin Dashboard**: Login with admin@learnova.com / admin123

## Admin Access

### Fixed Admin Credentials
- **Email**: admin@learnova.com
- **Password**: admin123

### Admin Capabilities
1. **User Management**
   - View all registered users
   - Delete user accounts
   - Monitor user activity

2. **Instructor Management**
   - Review instructor applications
   - Approve or reject applications with reasons
   - Manage instructor status

3. **Platform Analytics**
   - Total users, students, instructors
   - Course statistics
   - Enrollment and completion rates
   - Certificate issuance tracking

4. **System Monitoring**
   - Recent platform activity
   - Open support queries
   - Platform health metrics

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login (supports admin login)

### Admin Endpoints (Protected)
- `GET /api/admin/statistics` - Platform statistics
- `GET /api/admin/users` - Get all users with filtering
- `PUT /api/admin/instructor-status` - Approve/reject instructors
- `DELETE /api/admin/users/:userId` - Delete user account

### Course Management
- `GET /api/courses` - Get all published courses
- `GET /api/courses/:courseId` - Get course details
- `POST /api/courses` - Create new course (instructor only)
- `PUT /api/courses/:courseId` - Update course (instructor only)

### Enrollment & Progress
- `POST /api/enroll` - Enroll in a course
- `GET /api/my-courses` - Get student's enrolled courses
- `PUT /api/progress/lesson` - Update lesson progress

### Reviews & Ratings
- `POST /api/reviews` - Submit course review
- `GET /api/courses/:courseId/reviews` - Get course reviews

### Certificates
- `POST /api/certificates/generate` - Generate certificate
- `GET /api/my-certificates` - Get user's certificates
- `GET /api/certificates/verify/:certificateId` - Verify certificate

### Support & Queries
- `POST /api/queries` - Submit support query
- `GET /api/my-queries` - Get user's queries

### User Profile
- `GET /api/user/:username` - Get user profile
- `PUT /api/update-profile` - Update profile
- `PUT /api/change-password` - Change password

## File Structure

```
lms-project/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── models/                # Database models
│   ├── User.js
│   ├── Course.js
│   ├── Enrollment.js
│   ├── Review.js
│   ├── Certificate.js
│   └── Query.js
├── public/                # Frontend files
│   ├── index.html         # Homepage
│   ├── login.html         # Login page
│   ├── register.html      # Registration page
│   ├── admin-dashboard.html # Admin dashboard
│   ├── dashboard.html     # Student dashboard
│   ├── instructor-dashboard.html # Instructor dashboard
│   ├── courses.html       # Course catalog
│   ├── course-details.html # Course details
│   ├── my-courses.html    # Student's courses
│   ├── profile.html       # User profile
│   ├── progress.html      # Progress tracking
│   ├── queries.html       # Support queries
│   ├── quiz.html          # Quiz interface
│   ├── instructor-create-course.html # Course creation
│   ├── instructor-pending.html # Pending instructor status
│   └── styles.css         # Global styles
└── README.md              # This file
```

## Usage Instructions

### For Students
1. Register at `/register.html`
2. Login at `/login.html`
3. Browse courses at `/courses.html`
4. Enroll in courses and track progress
5. Complete courses to earn certificates

### For Instructors
1. Register as instructor at `/register.html`
2. Wait for admin approval
3. Once approved, create courses
4. Manage course content and student progress

### For Administrators
1. Login with admin@learnova.com / admin123
2. Access admin dashboard
3. Manage users and instructors
4. Monitor platform statistics
5. Handle support queries

## Customization

### Logo Replacement
All HTML files contain logo placeholders:
```html
<img src="/path/to/your/logo.png" alt="LearNova Logo" style="height: 40px;">
```
Replace `/path/to/your/logo.png` with your actual logo path.

### Branding
The application uses "LearNova" branding throughout. To change:
1. Update all HTML title tags
2. Modify footer text
3. Change welcome messages
4. Update email templates (if implemented)

### Database Configuration
To use a different MongoDB database:
1. Update the `MONGODB_URI` constant in `server.js`
2. Ensure your database user has read/write permissions

### Admin Credentials
To change admin credentials:
1. Update the `ADMIN_CREDENTIALS` object in `server.js`
2. Restart the server

## Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- Role-based access control
- Input validation and sanitization
- CORS configuration
- Protected admin endpoints

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 5000 is available
   - Verify MongoDB connection string
   - Ensure all dependencies are installed

2. **Database connection failed**
   - Verify MongoDB Atlas credentials
   - Check network connectivity
   - Ensure database user permissions

3. **Admin login not working**
   - Verify credentials: admin@learnova.com / admin123
   - Check browser console for errors
   - Clear browser cache and cookies

4. **Frontend not loading**
   - Ensure server is running on port 5000
   - Check browser console for JavaScript errors
   - Verify file paths are correct

### Development Mode
For development, you can use nodemon for auto-restart:
```bash
npm install -g nodemon
nodemon server.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For technical support or questions:
1. Check this README file
2. Review the code comments
3. Test the API endpoints using tools like Postman
4. Check browser console for frontend errors

---

**Note**: This is a complete, functional Learning Management System ready for deployment. All features are implemented and tested. The admin panel provides full control over users, instructors, and platform operations.

