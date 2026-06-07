/**
 * CareTrack Clinic MRMS - Disease / Diagnosis Management
 * CRUD via backend API with severity filter and patient linking.
 */

let diagnosesCache = [];
let patientsCache = [];
let deleteDiagnosisId = null;

document.addEventListener("DOMContentLoaded", () => {
  MRMS_AUTH.initApp("diagnoses");
  if (!MRMS_AUTH.can("diagnoses", "read")) {
    window.location.href = "dashboard.html";
    return;
  }
  bindDiagnosisEvents();
  loadDiagnosesPage();
});

function bindDiagnosisEvents() {
  document.getElementById("search-diagnoses")?.addEventListener("input", filterDiagnoses);
  document.getElementById("filter-severity")?.addEventListener("change", filterDiagnoses);
  document.getElementById("btn-add-diagnosis")?.addEventListener("click", () => openDiagnosisModal());
  document.getElementById("diagnosis-form")?.addEventListener("submit", handleDiagnosisSubmit);
  document.getElementById("btn-confirm-delete-diagnosis")?.addEventListener("click", confirmDeleteDiagnosis);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeAllModals);
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

async function loadDiagnosesPage() {
  await Promise.all([loadPatientsForSelect(), loadDiagnoses()]);
}

async function loadPatientsForSelect() {
  try {
    const response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patients`);
    if (response.ok) {
      patientsCache = await response.json();
      if (!Array.isArray(patientsCache)) patientsCache = [];
    }
  } catch {
    patientsCache = [];
  }

  const select = document.getElementById("diagnosis-patient");
  if (select) {
    select.innerHTML =
      '<option value="">Select patient</option>' +
      patientsCache
        .map((p) => {
          const name = p.fullName || "Patient " + p.id;
          return `<option value="${p.id}">${MRMS_AUTH.escapeHtml(name)}</option>`;
        })
        .join("");
  }
}

async function loadDiagnoses() {
  const tbody = document.getElementById("diagnoses-tbody");
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';
  const query = (document.getElementById("search-diagnoses")?.value || "").trim();
  const severity = (document.getElementById("filter-severity")?.value || "").trim();

  try {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (severity) params.set("severity", severity);
    const response = await MRMS_AUTH.apiFetch(
      `${MRMS_AUTH.API_BASE}/diagnoses${params.toString() ? `?${params.toString()}` : ""}`
    );
    if (response.ok) {
      diagnosesCache = await response.json();
      if (!Array.isArray(diagnosesCache)) diagnosesCache = [];
    } else {
      diagnosesCache = [];
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to load diagnoses.", "error");
    }
  } catch {
    diagnosesCache = [];
    MRMS_AUTH.showAlert("Network error while loading diagnoses.", "error");
  }

  renderDiagnosesTable(diagnosesCache);
}

function getPatientName(patientId) {
  const p = patientsCache.find((x) => String(x.id) === String(patientId));
  return p?.fullName || patientId || "—";
}

function filterDiagnoses() {
  loadDiagnoses();
}

function renderDiagnosesTable(diagnoses) {
  const tbody = document.getElementById("diagnoses-tbody");
  const canUpdate = MRMS_AUTH.can("diagnoses", "update");
  const canDelete = MRMS_AUTH.can("diagnoses", "delete");

  if (diagnoses.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted">No diagnoses found.</td></tr>';
    return;
  }

  tbody.innerHTML = diagnoses
    .map((d) => {
      let actions = "";
      if (canUpdate) {
        actions += `<button type="button" class="btn btn-secondary btn-sm" data-edit="${d.id}">Edit</button>`;
      }
      if (canDelete) {
        actions += `<button type="button" class="btn btn-danger btn-sm" data-delete="${d.id}">Delete</button>`;
      }
      if (!actions) actions = '<span class="text-muted">View only</span>';

      return `
        <tr>
          <td>${MRMS_AUTH.escapeHtml(String(d.id))}</td>
          <td>${MRMS_AUTH.escapeHtml(d.icdCode || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(d.description || "")}</td>
          <td>${severityBadge(d.severity)}</td>
          <td>${MRMS_AUTH.escapeHtml(getPatientName(d.patientId))}</td>
          <td class="table-actions">${actions}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = diagnosesCache.find((d) => String(d.id) === btn.dataset.edit);
      if (item) openDiagnosisModal(item);
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
}

function severityBadge(severity) {
  const s = (severity || "").toLowerCase();
  const cls = ["mild", "moderate", "severe", "critical"].includes(s) ? s : "moderate";
  return `<span class="badge badge-${cls}">${MRMS_AUTH.escapeHtml(severity || "—")}</span>`;
}

function openDiagnosisModal(diagnosis = null) {
  const form = document.getElementById("diagnosis-form");
  const title = document.getElementById("diagnosis-modal-title");
  form.reset();
  clearFormErrors(form);

  if (diagnosis) {
    title.textContent = "Edit Diagnosis";
    document.getElementById("diagnosis-id").value = diagnosis.id;
    document.getElementById("diagnosis-icd").value = diagnosis.icdCode || "";
    document.getElementById("diagnosis-description").value = diagnosis.description || "";
    document.getElementById("diagnosis-severity").value = (diagnosis.severity || "").toLowerCase();
    document.getElementById("diagnosis-patient").value = diagnosis.patientId ?? "";
  } else {
    title.textContent = "Add Diagnosis";
    document.getElementById("diagnosis-id").value = "";
  }

  openModal("diagnosis-modal");
}

function openDeleteModal(id) {
  deleteDiagnosisId = id;
  const item = diagnosesCache.find((d) => String(d.id) === String(id));
  document.getElementById("delete-diagnosis-label").textContent =
    item?.description || item?.icdCode || "this diagnosis";
  openModal("delete-diagnosis-modal");
}

async function handleDiagnosisSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateDiagnosisForm(form)) return;

  const id = document.getElementById("diagnosis-id").value;
  const payload = {
    icdCode: document.getElementById("diagnosis-icd").value.trim(),
    description: document.getElementById("diagnosis-description").value.trim(),
    severity: document.getElementById("diagnosis-severity").value,
    patientId: Number(document.getElementById("diagnosis-patient").value),
  };

  try {
    let response;
    if (id) {
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/diagnoses/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/diagnoses`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    if (response.ok) {
      MRMS_AUTH.showAlert(id ? "Diagnosis updated successfully." : "Diagnosis added successfully.");
      closeAllModals();
      loadDiagnoses();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to save diagnosis.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while saving diagnosis.", "error");
  }
}

async function confirmDeleteDiagnosis() {
  if (!deleteDiagnosisId) return;

  try {
    const response = await MRMS_AUTH.apiFetch(
      `${MRMS_AUTH.API_BASE}/diagnoses/${deleteDiagnosisId}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      MRMS_AUTH.showAlert("Diagnosis deleted successfully.");
      closeAllModals();
      loadDiagnoses();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to delete diagnosis.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while deleting diagnosis.", "error");
  }
  deleteDiagnosisId = null;
}

function validateDiagnosisForm(form) {
  let valid = true;
  form.querySelectorAll("[required]").forEach((input) => {
    if (!input.value.trim()) {
      input.classList.add("is-invalid");
      valid = false;
    } else {
      input.classList.remove("is-invalid");
    }
  });
  return valid;
}

function clearFormErrors(form) {
  form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
}

function openModal(id) {
  document.getElementById(id)?.classList.add("is-open");
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach((m) => m.classList.remove("is-open"));
}

async function safeResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
