const express = require("express");
const path = require("path");

const doctorRoutes = require("./src/routes/doctorRoutes");
const patientRoutes = require("./src/routes/patientRoutes");
const diagnosisRoutes = require("./src/routes/diagnosisRoutes");
const authRoutes = require("./src/routes/authRoutes");
const { getPatientProfile } = require("./src/controllers/patientController");
const { allow } = require("./src/utils/roleMiddleware");
const {
  asyncHandler,
  notFoundHandler,
  globalErrorHandler,
} = require("./src/utils/errorHandlers");

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-role"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "login.html"));
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/diagnoses", diagnosisRoutes);
app.get(
  "/api/patient-profile/:id",
  allow("patientProfile", "read"),
  asyncHandler(getPatientProfile)
);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
