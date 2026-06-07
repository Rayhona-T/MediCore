const { AppError } = require("./errorHandlers");

function requireFields(payload, fields) {
  const missing = fields.filter(
    (field) => payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === ""
  );

  if (missing.length) {
    throw new AppError(`Missing required field(s): ${missing.join(", ")}`, 400);
  }
}

function ensureEntityExists(entity, name = "Resource") {
  if (!entity) {
    throw new AppError(`${name} not found`, 404);
  }
}

function ensureDoctorExists(doctors, doctorId) {
  const doctor = doctors.find((d) => Number(d.id) === Number(doctorId));
  if (!doctor) {
    throw new AppError("doctorId does not match an existing doctor", 400);
  }
}

function ensurePatientExists(patients, patientId) {
  const patient = patients.find((p) => Number(p.id) === Number(patientId));
  if (!patient) {
    throw new AppError("patientId does not match an existing patient", 400);
  }
}

module.exports = {
  requireFields,
  ensureEntityExists,
  ensureDoctorExists,
  ensurePatientExists,
};
