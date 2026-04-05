const express = require("express");
const PDFDocument = require("pdfkit");

const Registration = require("../models/Registration");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:registrationId", protect, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate("user")
      .populate("event");

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const isOwner = registration.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!registration.certificateAvailable && registration.status !== "completed") {
      return res.status(403).json({ message: "Certificate not available yet" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=bitfest-certificate-${registration._id}.pdf`
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(26).text("Certificate of Participation", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(14).text("This is to certify that", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(20).text(registration.user.name, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text("has successfully participated in", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(18).text(registration.event.title, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text("Organized by Computer Association Committee", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text(`Issued on ${new Date().toLocaleDateString("en-GB")}`, { align: "center" });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
