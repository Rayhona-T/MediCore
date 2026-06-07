const { dataPaths, readJson, writeJson, getNextId } = require("../utils/fileUtils");
const {
  requireFields,
  ensureEntityExists,
  ensureDoctorExists,
} = require("../utils/validationUtils");
const { AppError } = require("../utils/errorHandlers");

async function getPatients(req, res) {
  let patients = await readJson(dataPaths.patients);
  const { search, doctorId } = req.query;

  if (search) {
    const term = String(search).toLowerCase();
    patients = patients.filter((p) => String(p.fullName || "").toLowerCase().includes(term));
  }

  if (doctorId) {
    patients = patients.filter((p) => Number(p.doctorId) === Number(doctorId));
  }

  res.status(200).json(patients);
}

async function getPatientById(req, res) {
  const patients = await readJson(dataPaths.patients);
  const patient = patients.find((p) => Number(p.id) === Number(req.params.id));
  ensureEntityExists(patient, "Patient");
  res.status(200).json(patient);
}

async function createPatient(req, res) {
  requireFields(req.body, [
    "fullName",
    "dateOfBirth",
    "gender",
    "phone",
    "address",
    "doctorId",
  ]);

  const [patients, doctors] = await Promise.all([
    readJson(dataPaths.patients),
    readJson(dataPaths.doctors),
  ]);

  ensureDoctorExists(doctors, req.body.doctorId);

  const newPatient = {
    id: getNextId(patients),
    fullName: req.body.fullName.trim(),
    dateOfBirth: req.body.dateOfBirth.trim(),
    gender: req.body.gender.trim(),
    phone: req.body.phone.trim(),
    address: req.body.address.trim(),
    doctorId: Number(req.body.doctorId),
  };

  patients.push(newPatient);
  await writeJson(dataPaths.patients, patients);

  res.status(201).json(newPatient);
}

async function updatePatient(req, res) {
  requireFields(req.body, [
    "fullName",
    "dateOfBirth",
    "gender",
    "phone",
    "address",
    "doctorId",
  ]);

  const [patients, doctors] = await Promise.all([
    readJson(dataPaths.patients),
    readJson(dataPaths.doctors),
  ]);

  const index = patients.findIndex((p) => Number(p.id) === Number(req.params.id));
  if (index === -1) throw new AppError("Patient not found", 404);

  ensureDoctorExists(doctors, req.body.doctorId);

  patients[index] = {
    ...patients[index],
    fullName: req.body.fullName.trim(),
    dateOfBirth: req.body.dateOfBirth.trim(),
    gender: req.body.gender.trim(),
    phone: req.body.phone.trim(),
    address: req.body.address.trim(),
    doctorId: Number(req.body.doctorId),
  };

  await writeJson(dataPaths.patients, patients);
  res.status(200).json(patients[index]);
}

async function deletePatient(req, res) {
  const [patients, diagnoses] = await Promise.all([
    readJson(dataPaths.patients),
    readJson(dataPaths.diagnoses),
  ]);
  const id = Number(req.params.id);

  const patient = patients.find((p) => Number(p.id) === id);
  ensureEntityExists(patient, "Patient");

  const hasLinkedDiagnoses = diagnoses.some((d) => Number(d.patientId) === id);
  if (hasLinkedDiagnoses) {
    throw new AppError("Cannot delete patient with linked diagnoses", 400);
  }

  const updated = patients.filter((p) => Number(p.id) !== id);
  await writeJson(dataPaths.patients, updated);

  res.status(200).json({ message: "Patient deleted successfully" });
}

async function getPatientProfile(req, res) {
  const patientId = Number(req.params.id);
  const [patients, doctors, diagnoses] = await Promise.all([
    readJson(dataPaths.patients),
    readJson(dataPaths.doctors),
    readJson(dataPaths.diagnoses),
  ]);

  const patient = patients.find((p) => Number(p.id) === patientId);
  ensureEntityExists(patient, "Patient");

  const doctor = doctors.find((d) => Number(d.id) === Number(patient.doctorId)) || null;
  const patientDiagnoses = diagnoses.filter((d) => Number(d.patientId) === patientId);

  res.status(200).json({
    patient,
    doctor,
    diagnoses: patientDiagnoses,
  });
}

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientProfile,
};
