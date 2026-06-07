/**
 * CareTrack Clinic MRMS - Doctor Management
 * CRUD operations with backend API, search and department filter.
 */

let allDoctors = [];
let deleteDoctorId = null;

document.addEventListener("DOMContentLoaded", () => {
  MRMS_AUTH.initApp("doctors");
  if (!MRMS_AUTH.can("doctors", "read") && !MRMS_AUTH.can("doctors", "create")) {
    /* Receptionist has read-only doctor access */
    if (!MRMS_AUTH.can("doctors", "read")) {
      window.location.href = "dashboard.html";
      return;
    }
  }
  bindDoctorEvents();
  loadDoctors();
});

function bindDoctorEvents() {
  document.getElementById("search-doctors")?.addEventListener("input", applyFilters);
  document.getElementById("filter-department")?.addEventListener("change", applyFilters);
  document.getElementById("btn-add-doctor")?.addEventListener("click", () => openDoctorModal());
  document.getElementById("doctor-form")?.addEventListener("submit", handleDoctorSubmit);
  document.getElementById("btn-confirm-delete")?.addEventListener("click", confirmDeleteDoctor);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeAllModals);
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

/**
 * GET /api/doctors
 */
async function loadDoctors() {
  const tbody = document.getElementById("doctors-tbody");
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';

  try {
    const response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors`);
    if (response.ok) {
      allDoctors = await response.json();
      if (!Array.isArray(allDoctors)) allDoctors = [];
    } else {
      allDoctors = [];
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to load doctors.", "error");
    }
  } catch {
    allDoctors = [];
    MRMS_AUTH.showAlert("Network error while loading doctors.", "error");
  }

  populateDepartmentFilter();
  applyFilters();
}

function populateDepartmentFilter() {
  const select = document.getElementById("filter-department");
  if (!select) return;
  
  // Save current selection to restore it afterwards
  const selectedValue = select.value;

  const departments = [...new Set(allDoctors.map((d) => d.department).filter(Boolean))];
  
  select.innerHTML =
    '<option value="">All departments</option>' +
    departments.map((dep) => `<option value="${MRMS_AUTH.escapeHtml(dep)}">${MRMS_AUTH.escapeHtml(dep)}</option>`).join("");

  if (selectedValue && departments.includes(selectedValue)) {
    select.value = selectedValue;
  } else {
    select.value = "";
  }
}

function applyFilters() {
  const query = (document.getElementById("search-doctors")?.value || "").trim().toLowerCase();
  const department = (document.getElementById("filter-department")?.value || "").trim();

  let filteredDoctors = allDoctors;

  if (query) {
    filteredDoctors = filteredDoctors.filter(
      (d) =>
        String(d.name || "").toLowerCase().includes(query) ||
        String(d.specialty || "").toLowerCase().includes(query)
    );
  }

  if (department) {
    filteredDoctors = filteredDoctors.filter(
      (d) => String(d.department || "").toLowerCase() === department.toLowerCase()
    );
  }

  renderDoctorsTable(filteredDoctors);
}

function renderDoctorsTable(doctors) {
  const tbody = document.getElementById("doctors-tbody");
  const canUpdate = MRMS_AUTH.can("doctors", "update");
  const canDelete = MRMS_AUTH.can("doctors", "delete");

  if (doctors.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted">No doctors found.</td></tr>';
    return;
  }

  tbody.innerHTML = doctors
    .map((d) => {
      const contact = d.contact || "—";
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
          <td>${MRMS_AUTH.escapeHtml(d.name || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(d.specialty || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(d.department || "")}</td>
          <td>${MRMS_AUTH.escapeHtml(contact)}</td>
          <td class="table-actions">${actions}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const doctor = allDoctors.find((d) => String(d.id) === btn.dataset.edit);
      if (doctor) openDoctorModal(doctor);
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
}

function openDoctorModal(doctor = null) {
  const form = document.getElementById("doctor-form");
  const title = document.getElementById("doctor-modal-title");
  form.reset();
  clearFormErrors(form);

  if (doctor) {
    title.textContent = "Edit Doctor";
    document.getElementById("doctor-id").value = doctor.id;
    document.getElementById("doctor-name").value = doctor.name || "";
    document.getElementById("doctor-specialty").value = doctor.specialty || "";
    document.getElementById("doctor-department").value = doctor.department || "";
    document.getElementById("doctor-contact").value =
      doctor.contact || "";
  } else {
    title.textContent = "Add Doctor";
    document.getElementById("doctor-id").value = "";
  }

  openModal("doctor-modal");
}

function openDeleteModal(id) {
  deleteDoctorId = id;
  const doctor = allDoctors.find((d) => String(d.id) === String(id));
  document.getElementById("delete-doctor-name").textContent = doctor?.name || "this doctor";
  openModal("delete-doctor-modal");
}

async function handleDoctorSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateDoctorForm(form)) return;

  const id = document.getElementById("doctor-id").value;
  const payload = {
    name: document.getElementById("doctor-name").value.trim(),
    specialty: document.getElementById("doctor-specialty").value.trim(),
    department: document.getElementById("doctor-department").value.trim(),
    contact: document.getElementById("doctor-contact").value.trim(),
  };

  try {
    let response;
    if (id) {
      /* PUT /api/doctors/:id */
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      /* POST /api/doctors */
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    if (response.ok) {
      MRMS_AUTH.showAlert(id ? "Doctor updated successfully." : "Doctor added successfully.");
      closeAllModals();
      loadDoctors();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to save doctor.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while saving doctor.", "error");
  }
}

/**
 * DELETE /api/doctors/:id
 */
async function confirmDeleteDoctor() {
  if (!deleteDoctorId) return;

  try {
    const response = await MRMS_AUTH.apiFetch(
      `${MRMS_AUTH.API_BASE}/doctors/${deleteDoctorId}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      MRMS_AUTH.showAlert("Doctor deleted successfully.");
      closeAllModals();
      loadDoctors();
    } else {
      const data = await safeResponseJson(response);
      MRMS_AUTH.showAlert(data?.message || "Failed to delete doctor.", "error");
    }
  } catch {
    MRMS_AUTH.showAlert("Network error while deleting doctor.", "error");
  }
  deleteDoctorId = null;
}

function validateDoctorForm(form) {
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
