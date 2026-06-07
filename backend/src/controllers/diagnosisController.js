const { dataPaths, readJson, writeJson, getNextId } = require("../utils/fileUtils");
const {
  requireFields,
  ensureEntityExists,
  ensurePatientExists,
} = require("../utils/validationUtils");
const { AppError } = require("../utils/errorHandlers");

async function getDiagnoses(req, res) {
  let diagnoses = await readJson(dataPaths.diagnoses);
  const { search, severity } = req.query;

  if (search) {
    const term = String(search).toLowerCase();
    diagnoses = diagnoses.filter((d) => String(d.icdCode || "").toLowerCase().includes(term));
  }

  if (severity) {
    const sev = String(severity).toLowerCase();
    diagnoses = diagnoses.filter((d) => String(d.severity || "").toLowerCase() === sev);
  }

  res.status(200).json(diagnoses);
}

async function getDiagnosisById(req, res) {
  const diagnoses = await readJson(dataPaths.diagnoses);
  const diagnosis = diagnoses.find((d) => Number(d.id) === Number(req.params.id));
  ensureEntityExists(diagnosis, "Diagnosis");
  res.status(200).json(diagnosis);
}

async function createDiagnosis(req, res) {
  requireFields(req.body, ["icdCode", "description", "severity", "patientId"]);

  const [diagnoses, patients] = await Promise.all([
    readJson(dataPaths.diagnoses),
    readJson(dataPaths.patients),
  ]);

  ensurePatientExists(patients, req.body.patientId);

  const newDiagnosis = {
    id: getNextId(diagnoses),
    icdCode: req.body.icdCode.trim(),
    description: req.body.description.trim(),
    severity: req.body.severity.trim(),
    patientId: Number(req.body.patientId),
  };

  diagnoses.push(newDiagnosis);
  await writeJson(dataPaths.diagnoses, diagnoses);

  res.status(201).json(newDiagnosis);
}

async function updateDiagnosis(req, res) {
  requireFields(req.body, ["icdCode", "description", "severity", "patientId"]);

  const [diagnoses, patients] = await Promise.all([
    readJson(dataPaths.diagnoses),
    readJson(dataPaths.patients),
  ]);

  const index = diagnoses.findIndex((d) => Number(d.id) === Number(req.params.id));
  if (index === -1) throw new AppError("Diagnosis not found", 404);

  ensurePatientExists(patients, req.body.patientId);

  diagnoses[index] = {
    ...diagnoses[index],
    icdCode: req.body.icdCode.trim(),
    description: req.body.description.trim(),
    severity: req.body.severity.trim(),
    patientId: Number(req.body.patientId),
  };

  await writeJson(dataPaths.diagnoses, diagnoses);
  res.status(200).json(diagnoses[index]);
}

async function deleteDiagnosis(req, res) {
  const diagnoses = await readJson(dataPaths.diagnoses);
  const id = Number(req.params.id);

  const diagnosis = diagnoses.find((d) => Number(d.id) === id);
  ensureEntityExists(diagnosis, "Diagnosis");

  const updated = diagnoses.filter((d) => Number(d.id) !== id);
  await writeJson(dataPaths.diagnoses, updated);

  res.status(200).json({ message: "Diagnosis deleted successfully" });
}

module.exports = {
  getDiagnoses,
  getDiagnosisById,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
};
