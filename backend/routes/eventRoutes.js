const express = require("express");
const router = express.Router();

const Event = require("../models/Event");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const defaultSeatsByCategory = {
  Tech: 100,
  "Non-Tech": 150,
  Workshop: 80,
  Gaming: 100
};

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      date,
      time,
      prize,
      fee,
      venue,
      rules,
      totalSeats,
      participationType,
      minParticipants,
      maxParticipants
    } = req.body;

    if (!title || !description || !category || !date || !time) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const seats =
      typeof totalSeats !== "undefined" && totalSeats !== ""
        ? Number(totalSeats)
        : defaultSeatsByCategory[category] || 100;

    const normalizedParticipation =
      participationType === "group" ? "group" : "solo";
    const normalizedMin =
      normalizedParticipation === "group" ? Number(minParticipants || 2) : 1;
    const normalizedMax =
      normalizedParticipation === "group" ? Number(maxParticipants || 4) : 1;

    const event = new Event({
      title,
      description,
      category,
      date,
      time,
      venue,
      rules,
      prize,
      participationType: normalizedParticipation,
      minParticipants: normalizedMin,
      maxParticipants: normalizedMax,
      fee: Number(fee || 0),
      totalSeats: seats,
      registeredCount: 0,
      createdBy: req.user._id
    });

    await event.save();

    res.status(201).json({
      message: "Event created successfully",
      event
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const events = await Event.find(filter).sort({ createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updates = req.body;
    if (typeof updates.totalSeats !== "undefined") {
      const newTotal = Number(updates.totalSeats);
      if (newTotal < event.registeredCount) {
        return res.status(400).json({
          message: "Total seats cannot be less than registered count"
        });
      }
      event.totalSeats = newTotal;
    }

    if (typeof updates.title !== "undefined") event.title = updates.title;
    if (typeof updates.description !== "undefined") event.description = updates.description;
    if (typeof updates.category !== "undefined") event.category = updates.category;
    if (typeof updates.date !== "undefined") event.date = updates.date;
    if (typeof updates.time !== "undefined") event.time = updates.time;
    if (typeof updates.venue !== "undefined") event.venue = updates.venue;
    if (typeof updates.rules !== "undefined") event.rules = updates.rules;
    if (typeof updates.prize !== "undefined") event.prize = updates.prize;
    if (typeof updates.fee !== "undefined") event.fee = Number(updates.fee || 0);

    if (typeof updates.participationType !== "undefined") {
      event.participationType = updates.participationType === "group" ? "group" : "solo";
    }
    if (event.participationType === "group") {
      if (typeof updates.minParticipants !== "undefined") {
        event.minParticipants = Number(updates.minParticipants || 2);
      }
      if (typeof updates.maxParticipants !== "undefined") {
        event.maxParticipants = Number(updates.maxParticipants || 4);
      }
    } else {
      event.minParticipants = 1;
      event.maxParticipants = 1;
    }

    await event.save();

    res.json({ message: "Event updated", event });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
