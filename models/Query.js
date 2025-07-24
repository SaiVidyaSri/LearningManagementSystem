// models/Query.js
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  responder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responderName: String,
  responderRole: {
    type: String,
    enum: ['instructor', 'admin', 'support']
  },
  message: {
    type: String,
    required: true
  },
  attachments: [String], // URLs to attached files
  respondedAt: {
    type: Date,
    default: Date.now
  }
});

const querySchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  category: {
    type: String,
    required: true,
    enum: ['technical', 'content', 'billing', 'certificate', 'general', 'complaint']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  attachments: [String], // URLs to attached files
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responses: [responseSchema],
  tags: [String], // For categorization and search
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionNotes: String,
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    satisfactionFeedback: String
  },
  escalation: {
    escalatedAt: Date,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalationReason: String,
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastResponseAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient queries
querySchema.index({ student: 1 });
querySchema.index({ course: 1 });
querySchema.index({ instructor: 1 });
querySchema.index({ status: 1 });
querySchema.index({ category: 1 });
querySchema.index({ priority: 1 });
querySchema.index({ assignedTo: 1 });
querySchema.index({ createdAt: -1 });

// Update timestamps before saving
querySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update lastResponseAt if responses were added
  if (this.isModified('responses') && this.responses.length > 0) {
    this.lastResponseAt = this.responses[this.responses.length - 1].respondedAt;
  }
  
  next();
});

module.exports = mongoose.model('Query', querySchema);

