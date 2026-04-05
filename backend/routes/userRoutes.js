const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

router.get("/me", protect, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
