// models/Course.js
const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['video', 'text', 'document', 'interactive'],
    default: 'video'
  },
  content: String, // URL or content text
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
  }
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
  prerequisites: [String],
  learningOutcomes: [String],
  targetAudience: [String],
  modules: [moduleSchema],
  quizzes: [quizSchema],
  finalExam: {
    qanda: [quizQuestionSchema]
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
  next();
});

module.exports = mongoose.model('Course', courseSchema);

