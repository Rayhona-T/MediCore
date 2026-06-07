const express = require("express");
const {
  getDiagnoses,
  getDiagnosisById,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
} = require("../controllers/diagnosisController");
const { allow } = require("../utils/roleMiddleware");
const { asyncHandler } = require("../utils/errorHandlers");

const router = express.Router();

router.get("/", allow("diagnoses", "read"), asyncHandler(getDiagnoses));
router.get("/:id", allow("diagnoses", "read"), asyncHandler(getDiagnosisById));
router.post("/", allow("diagnoses", "create"), asyncHandler(createDiagnosis));
router.put("/:id", allow("diagnoses", "update"), asyncHandler(updateDiagnosis));
router.delete("/:id", allow("diagnoses", "delete"), asyncHandler(deleteDiagnosis));

module.exports = router;
