/**
 * CareTrack Clinic MRMS - Reports
 * Patient diagnosis summaries with printable layout.
 */

document.addEventListener("DOMContentLoaded", () => {
  MRMS_AUTH.initApp("reports");
  if (!MRMS_AUTH.can("reports", "read")) {
      window.location.href = "dashboard.html";
  }

  document.getElementById("btn-print-report")?.addEventListener("click", () => {
    window.print();
  });

  document.getElementById("btn-refresh-reports")?.addEventListener("click", loadReports);
  loadReports();
});

/**
 * Build report from GET /api/patients and GET /api/diagnoses
 */
async function loadReports() {
  const container = document.getElementById("reports-container");
  const generatedEl = document.getElementById("report-generated-date");
  const generatedPrintEl = document.getElementById("report-generated-date-print");
  container.innerHTML = '<p class="text-muted">Loading report data...</p>';

  let patients = [];
  let diagnoses = [];

  try {
    const [patientsRes, diagnosesRes] = await Promise.all([
      MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patients`),
      MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/diagnoses`),
    ]);

    if (patientsRes.ok) {
      patients = await patientsRes.json();
      if (!Array.isArray(patients)) patients = [];
    }
    if (diagnosesRes.ok) {
      diagnoses = await diagnosesRes.json();
      if (!Array.isArray(diagnoses)) diagnoses = [];
    }
  } catch {
    /* API unavailable */
  }

  const now = new Date();
  if (generatedEl) {
    generatedEl.textContent = now.toLocaleString();
  }
  if (generatedPrintEl) {
    generatedPrintEl.textContent = now.toLocaleString();
  }

  if (patients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No patient data available. Connect the backend API to generate reports.</p>
        <p class="text-muted">Expected: GET /api/patients and GET /api/diagnoses</p>
      </div>
    `;
    return;
  }

  container.innerHTML = patients
    .map((patient) => {
      const patientId = patient.id;
      const name = patient.fullName || "Unknown";
      const patientDiagnoses = diagnoses.filter(
        (d) =>
          String(d.patientId) === String(patientId)
      );

      const diagnosisRows =
        patientDiagnoses.length > 0
          ? patientDiagnoses
              .map(
                (d) => `
              <tr>
                <td>${MRMS_AUTH.escapeHtml(d.icdCode || "")}</td>
                <td>${MRMS_AUTH.escapeHtml(d.description || "")}</td>
                <td>${MRMS_AUTH.escapeHtml(d.severity || "")}</td>
              </tr>
            `
              )
              .join("")
          : `<tr><td colspan="3" class="text-muted">No diagnoses recorded</td></tr>`;

      return `
        <section class="report-section report-patient-block">
          <h3>${MRMS_AUTH.escapeHtml(name)}</h3>
          <p class="text-muted">
            ID: ${MRMS_AUTH.escapeHtml(String(patientId))} |
            DOB: ${MRMS_AUTH.escapeHtml(patient.dateOfBirth || "—")} |
            Gender: ${MRMS_AUTH.escapeHtml(patient.gender || "—")}
          </p>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ICD Code</th>
                  <th>Description</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>${diagnosisRows}</tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join("");
}
