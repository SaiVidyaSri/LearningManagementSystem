// models/Certificate.js
const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  certificateId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  courseName: {
    type: String,
    required: true
  },
  instructorName: {
    type: String,
    required: true
  },
  completionDate: {
    type: Date,
    required: true
  },
  issuedDate: {
    type: Date,
    default: Date.now
  },
  finalScore: {
    type: Number,
    required: true
  },
  courseDuration: {
    type: Number,
    required: true // in weeks
  },
  skills: [String], // Skills acquired from the course
  certificateUrl: String, // URL to the generated certificate PDF
  verificationCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active'
  },
  revokedAt: Date,
  revokedReason: String,
  expiresAt: Date, // Some certificates might expire
  metadata: {
    courseLevel: String,
    courseCategory: String,
    totalHours: Number,
    completionRate: Number
  }
});

// Generate certificate ID before saving
certificateSchema.pre('save', function(next) {
  if (!this.certificateId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.certificateId = `CERT-${timestamp}-${random}`.toUpperCase();
  }
  
  if (!this.verificationCode) {
    const random = Math.random().toString(36).substr(2, 8);
    this.verificationCode = random.toUpperCase();
  }
  
  next();
});

// Create indexes with unique constraints
certificateSchema.index({ student: 1 });
certificateSchema.index({ course: 1 });
certificateSchema.index({ certificateId: 1 }, { unique: true });
certificateSchema.index({ verificationCode: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);

