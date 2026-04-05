const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    collegeId: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student"
    },
    // Email verification status
    isVerified: {
      type: Boolean,
      default: false
    },
    // OTP for email verification (6-digit)
    emailOtp: String,
    // OTP expiry time (5 minutes)
    emailOtpExpires: Date,
    verifiedAt: Date
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
