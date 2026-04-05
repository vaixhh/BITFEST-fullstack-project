const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { registerUser, verifyOtp, resendOtp, loginUser } = require("../controllers/authController");

const router = express.Router();

/*
  @route   POST /api/auth/register
  @desc    Register user and send email OTP
*/
router.post("/register", registerUser);

/*
  @route   POST /api/auth/verify-otp
  @desc    Verify email OTP
*/
router.post("/verify-otp", verifyOtp);

/*
  @route   POST /api/auth/resend-otp
  @desc    Resend email OTP
*/
router.post("/resend-otp", resendOtp);

/*
  @route   POST /api/auth/login
  @desc    Login user (only if verified)
*/
router.post("/login", loginUser);

/*
  @route   GET /api/auth/protected
  @desc    Test protected route
*/
router.get("/protected", protect, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user
  });
});

module.exports = router;
