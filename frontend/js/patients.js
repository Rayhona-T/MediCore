/**
 * CareTrack Clinic MRMS - Patient Management
 * CRUD via backend API; links patients to assigned doctors.
 */

let patientsCache = [];
let doctorsCache = [];
let deletePatientId = null;

document.addEventListener("DOMContentLoaded", () => {
  const isProfilePage = document.body.dataset.page === "patient-profile";

  if (isProfilePage) {
    MRMS_AUTH.initApp("patients");
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get("id");
    if (!patientId) {
      window.location.href = "patients.html";
      return;
    }
    loadPatientProfile(patientId);
    return;
  }

  MRMS_AUTH.initApp("patients");
  if (!MRMS_AUTH.can("patients", "read")) {
    window.location.href = "dashboard.html";
    return;
  }
  bindPatientEvents();
  loadPatientsPage();
});

function bindPatientEvents() {
  document.getElementById("search-patients")?.addEventListener("input", filterPatients);
  document.getElementById("filter-doctor")?.addEventListener("change", filterPatients);
  document.getElementById("btn-add-patient")?.addEventListener("click", () => openPatientModal());
  document.getElementById("patient-form")?.addEventListener("submit", handlePatientSubmit);
  document.getElementById("btn-confirm-delete-patient")?.addEventListener("click", confirmDeletePatient);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeAllModals);
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

async function loadPatientsPage() {
  await Promise.all([loadDoctorsForSelect(), loadPatients()]);
}

async function loadDoctorsForSelect() {
  try {
    const response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors`);
    if (response.ok) {
      doctorsCache = await response.json();
      if (!Array.isArray(doctorsCache)) doctorsCache = [];
    } else {
      doctorsCache = [];
    }
  } catch {
    doctorsCache = [];
  }
  populateDoctorSelects();
}

function populateDoctorSelects() {
  const options =
    '<option value="">Select doctor</option>' +
    doctorsCache
      .map(
        (d) =>
          `<option value="${d.id}">${MRMS_AUTH.escapeHtml(d.name || "Doctor " + d.id)}</option>`
      )
      .join("");

  const formSelect = document.getElementById("patient-doctor");
  if (formSelect) formSelect.innerHTML = options;

  const filterSelect = document.getElementById("filter-doctor");
  if (filterSelect) {
    filterSelect.innerHTML =
      '<option value="">All doctors</option>' +
      doctorsCache
        .map(
          (d) =>
            `<option value="${d.id}">${MRMS_AUTH.escapeHtml(d.name || "")}</option>`
        )
        .join("");
  }
}

async function loadPatients() {
  const tbody = document.getElementById("patients-tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Loading...</td></tr>';
  const query = (document.getElementById("search-patients")?.value || "").trim();
  const doctorId = (document.getElementById("filter-doctor")?.value || "").trim();

  try {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (doctorId) params.set("doctorId", doctorId);
    const response = await MRMS_AUTH.apiFetch(
      `${MRMS_AUTH.API_BASE}/patients${params.toString() ? `?${params.toString()}` : ""}`
    );
    if (response.ok) {
      patientsCache = await response.json();
      if (!Array.isArray(patientsCache)) patientsCache = [];
    } else {
      patientsCache = [];
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to load patients.", "error");
    }
  } catch {
    patientsCache = [];
    MRMS_AUTH.showAlert("Network error while loading patients.", "error");
  }

  renderPatientsTable(patientsCache);
}

function getDoctorName(doctorId) {
  const doc = doctorsCache.find((d) => String(d.id) === String(doctorId));
  return doc?.name || doctorId || "—";
}

function filterPatients() {
  loadPatients();
}

function renderPatientsTable(patients) {
  const tbody = document.getElementById("patients-tbody");
  const canUpdate = MRMS_AUTH.can("patients", "update");
  const canDelete = MRMS_AUTH.can("patients", "delete");
  const canRead = MRMS_AUTH.can("patients", "read");

  if (patients.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted">No patients found.</td></tr>';
    return;
  }

  tbody.innerHTML = patients
    .map((p) => {
      let actions = "";
      if (canRead) {
        actions += `<a href="patient-profile.html?id=${encodeURIComponent(p.id)}" class="btn btn-secondary btn-sm">Profile</a>`;
      }
      if (canUpdate) {
        actions += `<button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>`;
      }
      if (canDelete) {
        actions += `<button type="button" class="btn btn-danger btn-sm" data-delete="${p.id}">Delete</button>`;
      }

      return `
        <tr>
          <td>${MRMS_AUTH.escapeHtml(String(p.id))}</td>
          <td>${MRMS_AUTH.escapeHtml(p.fullName || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(p.dateOfBirth || "—")}</td>
          <td>${MRMS_AUTH.escapeHtml(p.gender || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(p.phone || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(p.address || "—")}</td>
          <td>${MRMS_AUTH.escapeHtml(getDoctorName(p.doctorId))}</td>
          <td class="table-actions">${actions || '<span class="text-muted">—</span>'}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const patient = patientsCache.find((p) => String(p.id) === btn.dataset.edit);
      if (patient) openPatientModal(patient);
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
}

function openPatientModal(patient = null) {
  const form = document.getElementById("patient-form");
  const title = document.getElementById("patient-modal-title");
  form.reset();
  clearFormErrors(form);

  if (patient) {
    title.textContent = "Edit Patient";
    document.getElementById("patient-id").value = patient.id;
    document.getElementById("patient-name").value = patient.fullName || "";
    document.getElementById("patient-dob").value = patient.dateOfBirth || "";
    document.getElementById("patient-gender").value = patient.gender || "";
    document.getElementById("patient-phone").value = patient.phone || "";
    document.getElementById("patient-address").value = patient.address || "";
    document.getElementById("patient-doctor").value = patient.doctorId ?? "";
  } else {
    title.textContent = "Register Patient";
    document.getElementById("patient-id").value = "";
  }

  openModal("patient-modal");
}

function openDeleteModal(id) {
  deletePatientId = id;
  const patient = patientsCache.find((p) => String(p.id) === String(id));
  document.getElementById("delete-patient-name").textContent = patient?.fullName || "this patient";
  openModal("delete-patient-modal");
}

async function handlePatientSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!validatePatientForm(form)) return;

  const id = document.getElementById("patient-id").value;
  const payload = {
    fullName: document.getElementById("patient-name").value.trim(),
    dateOfBirth: document.getElementById("patient-dob").value,
    gender: document.getElementById("patient-gender").value,
    phone: document.getElementById("patient-phone").value.trim(),
    address: document.getElementById("patient-address").value.trim(),
    doctorId: Number(document.getElementById("patient-doctor").value),
  };

  try {
    let response;
    if (id) {
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patients/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patients`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    if (response.ok) {
      MRMS_AUTH.showAlert(id ? "Patient updated successfully." : "Patient registered successfully.");
      closeAllModals();
      loadPatients();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to save patient.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while saving patient.", "error");
  }
}

async function confirmDeletePatient() {
  if (!deletePatientId) return;

  try {
    const response = await MRMS_AUTH.apiFetch(
      `${MRMS_AUTH.API_BASE}/patients/${deletePatientId}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      MRMS_AUTH.showAlert("Patient deleted successfully.");
      closeAllModals();
      loadPatients();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to delete patient.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while deleting patient.", "error");
  }
  deletePatientId = null;
}

async function loadPatientProfile(patientId) {
  let patient = null;
  let doctor = null;
  let diagnoses = [];

  try {
    const response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patient-profile/${patientId}`);
    if (response.ok) {
      const profile = await response.json();
      patient = profile.patient || null;
      doctor = profile.doctor || null;
      diagnoses = Array.isArray(profile.diagnoses) ? profile.diagnoses : [];
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to load patient profile.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while loading patient profile.", "error");
  }

  if (!patient) {
    document.getElementById("profile-content").innerHTML =
      '<p class="empty-state">Patient not found.</p>';
    return;
  }

  document.getElementById("profile-patient-name").textContent = patient.fullName || "Patient";
  document.getElementById("patient-details-list").innerHTML = buildDetailList([
    ["Patient ID", patient.id],
    ["Full Name", patient.fullName],
    ["Date of Birth", patient.dateOfBirth],
    ["Gender", patient.gender],
    ["Phone", patient.phone],
    ["Address", patient.address || "—"],
  ]);

  if (doctor) {
    document.getElementById("doctor-details-list").innerHTML = buildDetailList([
      ["Doctor ID", doctor.id],
      ["Name", doctor.name],
      ["Specialty", doctor.specialty],
      ["Department", doctor.department],
      ["Contact", doctor.contact],
    ]);
  } else {
    document.getElementById("doctor-details-list").innerHTML =
      '<p class="text-muted">No assigned doctor on record.</p>';
  }

  renderProfileDiagnoses(diagnoses);
}

function buildDetailList(items) {
  return `<ul class="detail-list">${items
    .map(
      ([label, value]) =>
        `<li><span class="label">${MRMS_AUTH.escapeHtml(label)}</span><span>${MRMS_AUTH.escapeHtml(String(value ?? "—"))}</span></li>`
    )
    .join("")}</ul>`;
}

function renderProfileDiagnoses(diagnoses) {
  const tbody = document.getElementById("profile-diagnoses-tbody");
  if (!tbody) return;

  if (diagnoses.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">No diagnoses on record.</td></tr>';
    return;
  }

  tbody.innerHTML = diagnoses
    .map(
      (d) => `
      <tr>
        <td>${MRMS_AUTH.escapeHtml(d.icdCode || "")}</td>
        <td>${MRMS_AUTH.escapeHtml(d.description || "")}</td>
        <td>${severityBadge(d.severity)}</td>
        <td>${MRMS_AUTH.escapeHtml(String(d.id))}</td>
      </tr>
    `
    )
    .join("");
}

function severityBadge(severity) {
  const s = (severity || "").toLowerCase();
  const cls = ["mild", "moderate", "severe", "critical"].includes(s) ? s : "moderate";
  return `<span class="badge badge-${cls}">${MRMS_AUTH.escapeHtml(severity || "—")}</span>`;
}

function validatePatientForm(form) {
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
