const express = require("express");
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientProfile,
} = require("../controllers/patientController");
const { allow } = require("../utils/roleMiddleware");
const { asyncHandler } = require("../utils/errorHandlers");

const router = express.Router();

router.get("/", allow("patients", "read"), asyncHandler(getPatients));
router.get("/:id", allow("patients", "read"), asyncHandler(getPatientById));
router.post("/", allow("patients", "create"), asyncHandler(createPatient));
router.put("/:id", allow("patients", "update"), asyncHandler(updatePatient));
router.delete("/:id", allow("patients", "delete"), asyncHandler(deletePatient));
router.get(
  "/profile/:id",
  allow("patientProfile", "read"),
  asyncHandler(getPatientProfile)
);

module.exports = router;
