const express = require("express");
const router = express.Router();

const Registration = require("../models/Registration");
const Event = require("../models/Event");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const defaultSeatsByCategory = {
  Tech: 100,
  "Non-Tech": 150,
  Workshop: 80,
  Gaming: 100
};

const resolveEventFee = (event) => {
  if (typeof event.fee === "number" && event.fee > 0) return event.fee;
  if (event.category === "Workshop") return 0;
  return event.participationType === "group" ? 200 : 50;
};

router.post("/", protect, async (req, res) => {
  try {
    const { eventId, participantsCount } = req.body;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (typeof event.totalSeats !== "number") {
      event.totalSeats = defaultSeatsByCategory[event.category] || 100;
      event.registeredCount = event.registeredCount || 0;
      await event.save();
    }

    const resolvedFee = resolveEventFee(event);
    if (resolvedFee > 0) {
      return res.status(400).json({ message: "Payment required for this event" });
    }

    const existingRegistration = await Registration.findOne({
      user: req.user._id,
      event: event._id
    });

    if (existingRegistration) {
      return res.status(400).json({ message: "Already registered" });
    }

    // Reserve a seat (prevent overbooking)
    const reservedEvent = await Event.findOneAndUpdate(
      { _id: event._id, $expr: { $lt: ["$registeredCount", "$totalSeats"] } },
      { $inc: { registeredCount: 1 } },
      { new: true }
    );

    if (!reservedEvent) {
      return res.status(400).json({ message: "Registrations closed" });
    }

    const normalizedParticipants =
      event.participationType === "group"
        ? Number(participantsCount || event.minParticipants || 2)
        : 1;

    if (
      event.participationType === "group" &&
      (normalizedParticipants < event.minParticipants ||
        normalizedParticipants > event.maxParticipants)
    ) {
      return res.status(400).json({
        message: `Team size must be between ${event.minParticipants} and ${event.maxParticipants}`
      });
    }

    let registration;
    try {
      registration = await Registration.create({
        user: req.user._id,
        event: event._id,
        participantsCount: normalizedParticipants,
        paymentStatus: "free",
        status: "registered"
      });
    } catch (error) {
      // rollback reserved seat if registration fails
      await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: -1 } });
      throw error;
    }

    res.status(201).json({ message: "Registration successful", registration });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already registered" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/my", protect, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user._id })
      .populate("event")
      .populate("payment")
      .sort({ createdAt: -1 });

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const registrations = await Registration.find()
      .populate("event")
      .populate("user", "name email collegeId")
      .populate("payment")
      .sort({ createdAt: -1 });

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, certificateAvailable } = req.body;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    if (status) registration.status = status;
    if (typeof certificateAvailable === "boolean") {
      registration.certificateAvailable = certificateAvailable;
    }

    await registration.save();
    res.json({ message: "Registration updated", registration });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
