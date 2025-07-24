# LearNova - Learning Management System

A comprehensive Learning Management System built with Node.js, Express, MongoDB, and vanilla HTML/CSS/JavaScript.

## Features

### 🎓 Student Features
- User registration and authentication
- Browse and enroll in courses
- Track learning progress
- Take quizzes and exams
- Earn certificates upon completion
- Submit queries and get support
- Rate and review courses
- Manage profile and settings

### 👨‍🏫 Instructor Features
- Apply for instructor status
- Create and manage courses
- Add modules, lessons, and quizzes
- Monitor student progress
- Respond to student queries
- View course analytics

### 🔧 Admin Features
- **Fixed Admin Credentials**: admin@learnova.com / admin123
- Approve/reject instructor applications
- Manage all users (students and instructors)
- View platform statistics and analytics
- Monitor system health
- Manage courses and content
- Handle support queries

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas
- **Authentication**: JWT (JSON Web Tokens)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Password Hashing**: bcryptjs
- **CORS**: Enabled for cross-origin requests

## Database Models

1. **User** - User accounts (students, instructors, admin)
2. **Course** - Course information with modules and lessons
3. **Enrollment** - Student course enrollments and progress
4. **Review** - Course reviews and ratings
5. **Certificate** - Generated certificates for completed courses
6. **Query** - Support queries and help requests

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

