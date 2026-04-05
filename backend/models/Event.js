const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ["Tech", "Workshop", "Non-Tech", "Gaming"],
      required: true
    },
    date: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    venue: {
      type: String,
      default: "To be announced"
    },
    rules: {
      type: String,
      default: ""
    },
    prize: {
      type: String
    },
    participationType: {
      type: String,
      enum: ["solo", "group"],
      default: "solo"
    },
    minParticipants: {
      type: Number,
      default: 1
    },
    maxParticipants: {
      type: Number,
      default: 1
    },
    fee: {
      type: Number,
      default: 0
    },
    totalSeats: {
      type: Number,
      default: 100
    },
    registeredCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Event", eventSchema);
