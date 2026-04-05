const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { sendOtpEmail } = require("../utils/email");

// Helper to generate JWT
const createToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });

// Helper to generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/*
  Register user and send email OTP
*/
const registerUser = async (req, res) => {
  try {
    const { name, email, collegeId, password } = req.body;

    if (!name || !email || !collegeId || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP and expiry (5 minutes)
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Update unverified user details and resend OTP
      existingUser.name = name;
      existingUser.collegeId = collegeId;
      existingUser.password = hashedPassword;
      existingUser.emailOtp = otp;
      existingUser.emailOtpExpires = otpExpires;
      existingUser.isVerified = false;
      await existingUser.save();

      try {
        await sendOtpEmail(existingUser, otp);
      } catch (error) {
        console.error("Register OTP email error:", error);
        return res
          .status(500)
          .json({ message: "Unable to send OTP email. Check SMTP settings." });
      }
      return res.status(200).json({ message: "OTP sent to your email" });
    }

    const user = await User.create({
      name,
      email,
      collegeId,
      password: hashedPassword,
      isVerified: false,
      emailOtp: otp,
      emailOtpExpires: otpExpires
    });

    try {
      await sendOtpEmail(user, otp);
    } catch (error) {
      console.error("Register OTP email error:", error);
      return res
        .status(500)
        .json({ message: "Unable to send OTP email. Check SMTP settings." });
    }
    res.status(201).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*
  Verify email OTP
*/
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (!user.emailOtp || !user.emailOtpExpires) {
      return res.status(400).json({ message: "OTP not generated. Please register again." });
    }

    if (Date.now() > user.emailOtpExpires.getTime()) {
      return res.status(400).json({ message: "OTP expired. Please register again." });
    }

    if (user.emailOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid, mark user verified and clear OTP
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*
  Resend email OTP
*/
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtp = otp;
    user.emailOtpExpires = otpExpires;
    await user.save();

    try {
      await sendOtpEmail(user, otp);
    } catch (error) {
      console.error("Resend OTP email error:", error);
      return res
        .status(500)
        .json({ message: "Unable to send OTP email. Check SMTP settings." });
    }
    res.json({ message: "OTP resent to your email" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/*
  Login user (only if verified)
*/
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = createToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser
};
