const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },
    participantsCount: {
      type: Number,
      default: 1
    },
    paymentStatus: {
      type: String,
      enum: ["free", "paid", "pending", "failed"],
      default: "free"
    },
    paymentId: {
      type: String
    },
    status: {
      type: String,
      enum: ["registered", "completed"],
      default: "registered"
    },
    certificateAvailable: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model("Registration", registrationSchema);
