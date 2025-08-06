// models/Course.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  },
  options: [String], // For multiple-choice and true-false questions
  correctAnswer: {
    type: String,
    required: true
  },
  explanation: String, // Optional explanation for the correct answer
  points: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }
});

const examinationSchema = new mongoose.Schema({
  title: {
    type: String,
    default: ''
  },
  description: String,
  timeLimit: {
    type: Number,
    default: 30, // in minutes
    min: 5,
    max: 180
  },
  passingScore: {
    type: Number,
    default: 70, // percentage
    min: 1,
    max: 100
  },
  questions: [questionSchema],
  isEnabled: {
    type: Boolean,
    default: false
  }
});

const resourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  size: String, // Human readable size (e.g., "2.5 MB")
  url: String, // URL to the uploaded file
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['video', 'text', 'document', 'interactive', 'image', 'link'],
    default: 'video'
  },
  content: String, // URL or content text
  videoUrl: String, // Specific field for video URLs
  imageUrl: String, // Specific field for image URLs
  documentUrl: String, // Specific field for document URLs
  externalLink: String, // Specific field for external links
  duration: {
    type: Number,
    default: 10 // in minutes
  },
  order: {
    type: Number,
    required: true
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  notes: String, // Instructor notes for this lesson
  
  // NEW: Examination for this lesson
  examination: examinationSchema,
  
  // NEW: Resources for this lesson
  resources: [resourceSchema]
});

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  order: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number,
    default: 60 // in minutes
  },
  lessons: [lessonSchema],
  materials: [String], // URLs to additional materials
  assignments: [String] // Assignment descriptions or URLs
});

const quizQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [String],
  correctAnswer: {
    type: String,
    required: true
  },
  explanation: String
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module'
  },
  questions: [quizQuestionSchema],
  passingScore: {
    type: Number,
    default: 70
  },
  timeLimit: {
    type: Number,
    default: 30 // in minutes
  }
});

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 150
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  instructorName: String,
  category: {
    type: String,
    required: true,
    enum: ['Programming', 'Web Development', 'Data Science', 'Design', 'Business', 'Marketing', 'Photography', 'Music', 'Language', 'Other']
  },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  language: {
    type: String,
    default: 'English'
  },
  duration: {
    type: Number,
    required: true // in weeks
  },
  estimatedHours: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  image: String, // Course image URL
  previewVideo: String, // Preview video URL
  promotionalVideo: String, // Promotional video URL
  prerequisites: [String],
  learningOutcomes: [String],
  targetAudience: [String],
  resources: [String], // Additional course resources
  tags: [String], // Course tags for better searchability
  modules: [moduleSchema],
  quizzes: [quizSchema],
  finalExam: {
    title: {
      type: String,
      default: 'Final Course Examination'
    },
    description: {
      type: String,
      default: 'This is the final examination for the course. You must pass to receive your certificate.'
    },
    timeLimit: {
      type: Number,
      default: 60, // in minutes
      min: 30,
      max: 300
    },
    passingScore: {
      type: Number,
      default: 70, // percentage
      min: 60,
      max: 100
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    questions: [questionSchema],
    isEnabled: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'rejected'],
    default: 'draft'
  },
  enrollmentCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  completionRate: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  
  // NEW: Course-level statistics
  totalQuestions: {
    type: Number,
    default: 0
  },
  totalResources: {
    type: Number,
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total questions and resources
  let totalQuestions = 0;
  let totalResources = 0;
  
  this.modules.forEach(module => {
    module.lessons.forEach(lesson => {
      if (lesson.examination && lesson.examination.questions) {
        totalQuestions += lesson.examination.questions.length;
      }
      if (lesson.resources) {
        totalResources += lesson.resources.length;
      }
    });
  });
  
  this.totalQuestions = totalQuestions;
  this.totalResources = totalResources;
  
  next();
});

module.exports = mongoose.model('Course', courseSchema);

