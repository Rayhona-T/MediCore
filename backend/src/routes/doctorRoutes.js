const express = require("express");
const {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const { allow } = require("../utils/roleMiddleware");
const { asyncHandler } = require("../utils/errorHandlers");

const router = express.Router();

router.get("/", allow("doctors", "read"), asyncHandler(getDoctors));
router.get("/:id", allow("doctors", "read"), asyncHandler(getDoctorById));
router.post("/", allow("doctors", "create"), asyncHandler(createDoctor));
router.put("/:id", allow("doctors", "update"), asyncHandler(updateDoctor));
router.delete("/:id", allow("doctors", "delete"), asyncHandler(deleteDoctor));

module.exports = router;
