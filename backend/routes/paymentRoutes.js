const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Event = require("../models/Event");
const Payment = require("../models/Payment");
const Registration = require("../models/Registration");
const { protectPayment } = require("../middleware/authMiddleware");

const router = express.Router();

const defaultSeatsByCategory = {
  Tech: 100,
  "Non-Tech": 150,
  Workshop: 80,
  Gaming: 100
};

const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || "").trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret
});

const resolveEventFee = (event) => {
  if (typeof event.fee === "number" && event.fee > 0) return event.fee;
  if (event.category === "Workshop") return 0;
  return event.participationType === "group" ? 200 : 50;
};

const formatRazorpayError = (error) => {
  if (!error) return "Unknown error";
  if (error.error && error.error.description) return error.error.description;
  if (error.description) return error.description;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch (err) {
    return String(error);
  }
};

router.post("/create-order", protectPayment, async (req, res) => {
  try {
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ message: "Razorpay keys not configured" });
    }

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

    const resolvedFee = Number(resolveEventFee(event) || 0);
    if (!resolvedFee || resolvedFee <= 0) {
      return res.status(400).json({ message: "Event is free. No payment required." });
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

    const existingRegistration = await Registration.findOne({
      user: req.user._id,
      event: event._id
    });

    if (existingRegistration) {
      return res
        .status(400)
        .json({ message: "You are already registered for this event" });
    }

    if (event.registeredCount >= event.totalSeats) {
      return res.status(400).json({ message: "Registrations Closed – Seats Full" });
    }

    const shortId = String(event._id || "").slice(-8);
    const shortTs = Date.now().toString(36);
    const receipt = `bf_${shortId}_${shortTs}`;

    const order = await razorpay.orders.create({
      amount: resolvedFee * 100,
      currency: "INR",
      receipt
    });

    res.json({
      order,
      key: razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      participantsCount: normalizedParticipants
    });
  } catch (error) {
    const detail = formatRazorpayError(error);
    console.error("Create order failed:", detail);
    res.status(500).json({ message: detail || "Server error" });
  }
});

router.post("/verify", protectPayment, async (req, res) => {
  try {
    const {
      eventId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      participantsCount
    } = req.body;

    if (!eventId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment data" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (typeof event.totalSeats !== "number") {
      event.totalSeats = defaultSeatsByCategory[event.category] || 100;
      event.registeredCount = event.registeredCount || 0;
      await event.save();
    }

    const existingRegistration = await Registration.findOne({
      user: req.user._id,
      event: event._id
    });

    if (existingRegistration) {
      return res
        .status(400)
        .json({ message: "You are already registered for this event" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const reservedEvent = await Event.findOneAndUpdate(
      { _id: event._id, $expr: { $lt: ["$registeredCount", "$totalSeats"] } },
      { $inc: { registeredCount: 1 } },
      { new: true }
    );

    if (!reservedEvent) {
      return res.status(400).json({ message: "Registrations Closed – Seats Full" });
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

    let payment;
    let registration;
    try {
      payment = await Payment.create({
        user: req.user._id,
        event: event._id,
        amount: resolveEventFee(event),
        currency: "INR",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: "paid"
      });

      registration = await Registration.create({
        user: req.user._id,
        event: event._id,
        payment: payment._id,
        participantsCount: normalizedParticipants,
        paymentStatus: "paid",
        paymentId: razorpay_payment_id,
        status: "registered"
      });
    } catch (error) {
      await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: -1 } });
      throw error;
    }

    res.json({ message: "Payment verified and registration saved", registrationId: registration._id });
  } catch (error) {
    const detail = formatRazorpayError(error);
    console.error("Payment verification failed:", detail);
    res.status(500).json({ message: detail || "Server error" });
  }
});

module.exports = router;
