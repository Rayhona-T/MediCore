const { dataPaths, readJson, writeJson, getNextId } = require("../utils/fileUtils");
const { requireFields, ensureEntityExists } = require("../utils/validationUtils");
const { AppError } = require("../utils/errorHandlers");

async function getDoctors(req, res) {
  let doctors = await readJson(dataPaths.doctors);
  const { search, department } = req.query;

  if (search) {
    const term = String(search).toLowerCase();
    doctors = doctors.filter((d) => String(d.name || "").toLowerCase().includes(term));
  }

  if (department) {
    const dep = String(department).toLowerCase();
    doctors = doctors.filter((d) => String(d.department || "").toLowerCase() === dep);
  }

  res.status(200).json(doctors);
}

async function getDoctorById(req, res) {
  const doctors = await readJson(dataPaths.doctors);
  const doctor = doctors.find((d) => Number(d.id) === Number(req.params.id));
  ensureEntityExists(doctor, "Doctor");
  res.status(200).json(doctor);
}

async function createDoctor(req, res) {
  requireFields(req.body, ["name", "specialty", "department", "contact"]);

  const doctors = await readJson(dataPaths.doctors);
  const newDoctor = {
    id: getNextId(doctors),
    name: req.body.name.trim(),
    specialty: req.body.specialty.trim(),
    department: req.body.department.trim(),
    contact: req.body.contact.trim(),
  };

  doctors.push(newDoctor);
  await writeJson(dataPaths.doctors, doctors);

  res.status(201).json(newDoctor);
}

async function updateDoctor(req, res) {
  requireFields(req.body, ["name", "specialty", "department", "contact"]);

  const doctors = await readJson(dataPaths.doctors);
  const index = doctors.findIndex((d) => Number(d.id) === Number(req.params.id));
  if (index === -1) throw new AppError("Doctor not found", 404);

  doctors[index] = {
    ...doctors[index],
    name: req.body.name.trim(),
    specialty: req.body.specialty.trim(),
    department: req.body.department.trim(),
    contact: req.body.contact.trim(),
  };

  await writeJson(dataPaths.doctors, doctors);
  res.status(200).json(doctors[index]);
}

async function deleteDoctor(req, res) {
  const doctors = await readJson(dataPaths.doctors);
  const patients = await readJson(dataPaths.patients);
  const id = Number(req.params.id);

  const doctor = doctors.find((d) => Number(d.id) === id);
  ensureEntityExists(doctor, "Doctor");

  const hasLinkedPatients = patients.some((p) => Number(p.doctorId) === id);
  if (hasLinkedPatients) {
    throw new AppError("Cannot delete doctor with linked patients", 400);
  }

  const updated = doctors.filter((d) => Number(d.id) !== id);
  await writeJson(dataPaths.doctors, updated);

  res.status(200).json({ message: "Doctor deleted successfully" });
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
