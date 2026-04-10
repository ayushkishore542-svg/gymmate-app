const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  gymOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  name: {
    type: String,
    required: true
  },
  
  phone: {
    type: String,
    required: true
  },
  
  email: {
    type: String,
    default: null
  },
  
  visitDate: {
    type: Date,
    default: Date.now
  },
  
  interestedInMembership: {
    type: Boolean,
    default: false
  },
  
  notes: {
    type: String,
    default: ''
  },
  
  // Track if converted to member
  convertedToMember: {
    type: Boolean,
    default: false
  },
  
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Visitor', visitorSchema);
