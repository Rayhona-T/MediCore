/**
 * CareTrack Clinic MRMS - Complete Application
 * Consolidated from all frontend JavaScript files
 * Includes: Authentication, Navigation, Dashboard, Doctors, Patients, Diagnoses, Reports
 */

/* ========================================================================
   PAGE NAVIGATION SYSTEM
   ======================================================================== */
function navigateToPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page-container').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show target page
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
    
    // Load page-specific data if user is authenticated
    if (MRMS_AUTH.getSession() && pageId !== 'home') {
      if (pageId === 'dashboard') {
        setTimeout(() => { loadDashboardStats(); loadRecentActivity(); }, 100);
      } else if (pageId === 'doctors') {
        setTimeout(() => { bindDoctorEvents(); loadDoctors(); }, 100);
      } else if (pageId === 'patients') {
        setTimeout(() => { bindPatientEvents(); loadPatientsPage(); }, 100);
      } else if (pageId === 'diagnoses') {
        setTimeout(() => { bindDiagnosisEvents(); loadDiagnosesPage(); }, 100);
      } else if (pageId === 'reports') {
        setTimeout(() => { loadReports(); }, 100);
      }
    }
  }
}

// Setup navigation button listeners
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-nav-to]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = btn.dataset.navTo;
      if (pageId === 'home' || !MRMS_AUTH.getSession()) {
        navigateToPage(pageId);
      } else if (MRMS_AUTH.can(pageId.split('-')[0], 'read') || pageId === 'dashboard') {
        navigateToPage(pageId);
      }
    });
  });
});

/* ========================================================================
   AUTHENTICATION & AUTHORIZATION MODULE
   ======================================================================== */
const MRMS_AUTH = (function () {
  const SESSION_KEY = "mrms_session";
  const BACKEND_HOST = window.location.origin.includes("5000")
    ? window.location.origin
    : "http://localhost:5000";
  const API_BASE = `${BACKEND_HOST}/api`;

  /** Role permission matrix for UI and actions */
  const PERMISSIONS = {
    administrator: {
      doctors: { create: true, read: true, update: true, delete: true },
      patients: { create: true, read: true, update: true, delete: true },
      diagnoses: { create: true, read: true, update: true, delete: true },
      reports: { read: true },
      dashboard: true,
    },
    clinician: {
      doctors: { create: false, read: false, update: false, delete: false },
      patients: { create: false, read: true, update: true, delete: false },
      diagnoses: { create: false, read: true, update: true, delete: false },
      reports: { read: true },
      dashboard: true,
    },
    receptionist: {
      doctors: { create: false, read: true, update: false, delete: false },
      patients: { create: true, read: true, update: false, delete: false },
      diagnoses: { create: false, read: true, update: false, delete: false },
      reports: { read: false },
      dashboard: true,
    },
  };

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(username, role) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username, role: role.toLowerCase() })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function can(resource, action) {
    const session = getSession();
    if (!session) return false;
    const rolePerms = PERMISSIONS[session.role];
    if (!rolePerms || !rolePerms[resource]) return false;
    return Boolean(rolePerms[resource][action]);
  }

  function applyRoleVisibility() {
    document.querySelectorAll("[data-permission]").forEach((el) => {
      const [resource, action] = el.dataset.permission.split(":");
      if (can(resource, action)) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });

    document.querySelectorAll("[data-nav]").forEach((el) => {
      const resource = el.dataset.nav;
      const rolePerms = PERMISSIONS[getSession()?.role];
      const allowed =
        resource === "dashboard"
          ? rolePerms?.dashboard
          : rolePerms?.[resource]?.read;
      if (!allowed) {
        el.classList.add("hidden");
      }
    });
  }

  function renderUserInfo() {
    const session = getSession();
    const userEls = document.querySelectorAll("#sidebar-user");
    if (session) {
      userEls.forEach(userEl => {
        userEl.innerHTML = `
          <strong>${escapeHtml(session.username)}</strong>
          <span>${formatRole(session.role)}</span>
        `;
      });
    }
  }

  function setActiveNav(page) {
    document.querySelectorAll(".sidebar-btn").forEach((link) => {
      link.classList.toggle(
        "active",
        link.dataset.page === page
      );
    });
  }

  function initSidebarToggle() {
    const toggles = document.querySelectorAll("#menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const backdrops = document.querySelectorAll("#sidebar-backdrop");

    toggles.forEach(toggle => {
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("is-open");
        backdrops.forEach(b => b.classList.toggle("is-visible"));
      });
    });

    backdrops.forEach(backdrop => {
      backdrop?.addEventListener("click", () => {
        sidebar.classList.remove("is-open");
        backdrop.classList.remove("is-visible");
      });
    });
  }

  function initLogout() {
    const btns = document.querySelectorAll("#logout-btn");
    btns.forEach(btn => {
      btn.addEventListener("click", async () => {
        await logout();
        clearSession();
        navigateToPage('home');
      });
    });
  }

  function showAlert(message, type = "success") {
    let container = document.querySelector(".alert-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "alert-container";
      container.setAttribute("role", "status");
      document.body.appendChild(container);
    }

    const alert = document.createElement("div");
    alert.className = `alert alert-${type === "error" ? "error" : type === "info" ? "info" : "success"}`;
    alert.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button type="button" class="alert-dismiss" aria-label="Dismiss">&times;</button>
    `;
    container.appendChild(alert);

    alert.querySelector(".alert-dismiss").addEventListener("click", () => {
      alert.remove();
    });

    setTimeout(() => alert.remove(), 5000);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatRole(role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function mapRoleToApi(role) {
    if (role === "administrator") return "admin";
    return role;
  }

  async function login(username, password, role) {
    if (!username || !password || !role) {
      return { success: false, message: "Invalid credentials. Please try again." };
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.username || username, data.role || role);
        return { success: true };
      }

      const errData = await response.json().catch(() => null);
      return {
        success: false,
        message:
          errData?.message ||
          `Login failed (${response.status} ${response.statusText}). Please try again.`,
      };
    } catch {
      return {
        success: false,
        message: "Network error. Please try again later.",
      };
    }
  }

  async function register(username, password, role) {
    if (!username || !password || !role) {
      return { success: false, message: "Please fill in all fields." };
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.username || username, data.role || role);
        return { success: true };
      }

      const errData = await response.json().catch(() => null);
      return {
        success: false,
        message:
          errData?.message ||
          `Registration failed (${response.status} ${response.statusText}). Please try again.`,
      };
    } catch {
      return {
        success: false,
        message: "Network error. Please try again later.",
      };
    }
  }

  async function logout() {
    try {
      const session = getSession();
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": session ? mapRoleToApi(session.role) : "",
        },
      });
    } catch {
      /* Ignore network errors during logout */
    }
  }

  async function apiFetch(url, options = {}) {
    const session = getSession();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (session) {
      headers["x-role"] = mapRoleToApi(session.role);
    }

    return fetch(url, { ...options, headers });
  }

  return {
    API_BASE,
    getSession,
    setSession,
    clearSession,
    can,
    applyRoleVisibility,
    showAlert,
    login,
    register,
    logout,
    apiFetch,
    escapeHtml,
    formatRole,
    PERMISSIONS,
    initSidebarToggle,
    initLogout,
    setActiveNav,
    renderUserInfo,
  };
})();

/* ========================================================================
   LOGIN FORM HANDLER
   ======================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const role = document.getElementById("role").value;
      const errorEl = document.getElementById("login-error");

      let valid = true;
      ["username", "password", "role"].forEach((id) => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
          input.classList.add("is-invalid");
          valid = false;
        } else {
          input.classList.remove("is-invalid");
        }
      });

      if (!valid) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.classList.remove("hidden");
        return;
      }

      errorEl.classList.add("hidden");
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const result = await MRMS_AUTH.login(username, password, role);
      submitBtn.disabled = false;

      if (result.success) {
        MRMS_AUTH.renderUserInfo();
        MRMS_AUTH.applyRoleVisibility();
        MRMS_AUTH.initSidebarToggle();
        MRMS_AUTH.initLogout();
        navigateToPage("dashboard");
      } else {
        errorEl.textContent = result.message || "Login failed.";
        errorEl.classList.remove("hidden");
      }
    });
  }
});

/* ========================================================================
   SIGNUP FORM HANDLER
   ======================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("signup-username").value.trim();
      const password = document.getElementById("signup-password").value;
      const role = document.getElementById("signup-role").value;
      const errorEl = document.getElementById("signup-error");

      let valid = true;
      ["signup-username", "signup-password", "signup-role"].forEach((id) => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
          input.classList.add("is-invalid");
          valid = false;
        } else {
          input.classList.remove("is-invalid");
        }
      });

      if (!valid) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.classList.remove("hidden");
        return;
      }

      errorEl.classList.add("hidden");
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const result = await MRMS_AUTH.register(username, password, role);
      submitBtn.disabled = false;

      if (result.success) {
        MRMS_AUTH.renderUserInfo();
        MRMS_AUTH.applyRoleVisibility();
        MRMS_AUTH.initSidebarToggle();
        MRMS_AUTH.initLogout();
        navigateToPage("dashboard");
      } else {
        errorEl.textContent = result.message || "Sign-up failed.";
        errorEl.classList.remove("hidden");
      }
    });
  }
});

/* ========================================================================
   DASHBOARD PAGE
   ======================================================================== */
async function loadDashboardStats() {
  const endpoints = [
    { url: `${MRMS_AUTH.API_BASE}/doctors`, elId: "stat-doctors" },
    { url: `${MRMS_AUTH.API_BASE}/patients`, elId: "stat-patients" },
    { url: `${MRMS_AUTH.API_BASE}/diagnoses`, elId: "stat-diagnoses" },
  ];

  await Promise.all(
    endpoints.map(async ({ url, elId }) => {
      const el = document.getElementById(elId);
      if (!el) return;

      try {
        const response = await MRMS_AUTH.apiFetch(url);
        if (response.ok) {
          const data = await response.json();
          const count = Array.isArray(data)
            ? data.length
            : data.count ?? data.total ?? 0;
          el.textContent = count;
        } else {
          el.textContent = "—";
        }
      } catch {
        el.textContent = "—";
      }
    })
  );
}

async function loadRecentActivity() {
  const listEl = document.getElementById("activity-list");
  if (!listEl) return;

  try {
    const [doctorsRes, patientsRes, diagnosesRes] = await Promise.all([
      MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors`),
      MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/patients`),
      MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/diagnoses`),
    ]);

    if (!doctorsRes.ok || !patientsRes.ok || !diagnosesRes.ok) {
      listEl.innerHTML = '<li class="text-muted">Unable to load recent activity.</li>';
      return;
    }

    const [doctors, patients, diagnoses] = await Promise.all([
      doctorsRes.json(),
      patientsRes.json(),
      diagnosesRes.json(),
    ]);

    const activities = [];
    const latestDoctor = [...doctors].sort((a, b) => Number(b.id) - Number(a.id))[0];
    const latestPatient = [...patients].sort((a, b) => Number(b.id) - Number(a.id))[0];
    const latestDiagnosis = [...diagnoses].sort((a, b) => Number(b.id) - Number(a.id))[0];

    if (latestDoctor) {
      activities.push({
        time: "Latest",
        text: `Doctor created/updated: ${latestDoctor.name} (${latestDoctor.department})`,
      });
    }
    if (latestPatient) {
      activities.push({
        time: "Latest",
        text: `Patient registered/updated: ${latestPatient.fullName}`,
      });
    }
    if (latestDiagnosis) {
      activities.push({
        time: "Latest",
        text: `Diagnosis recorded: ${latestDiagnosis.icdCode} (${latestDiagnosis.severity})`,
      });
    }

    renderActivityList(listEl, activities);
  } catch {
    listEl.innerHTML = '<li class="text-muted">Unable to load recent activity.</li>';
  }
}

function renderActivityList(container, activities) {
  if (!activities || activities.length === 0) {
    container.innerHTML =
      '<li class="empty-state">No recent activity.</li>';
    return;
  }

  container.innerHTML = activities
    .map(
      (a) => `
      <li>
        <span class="activity-time">${MRMS_AUTH.escapeHtml(a.time || a.timestamp || "")}</span>
        <span class="activity-text">${MRMS_AUTH.escapeHtml(a.text || a.description || a.message || "")}</span>
      </li>
    `
    )
    .join("");
}

/* ========================================================================
   DOCTORS PAGE
   ======================================================================== */
let allDoctors = [];
let deleteDoctorId = null;

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

async function loadDoctors() {
  const tbody = document.getElementById("doctors-tbody");
  if (!tbody) return;
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
  
  const selectedValue = select.value;
  const departments = [...new Set(allDoctors.map((d) => d.department).filter(Boolean))];
  
  select.innerHTML =
    '<option value="">All departments</option>' +
    departments.map((dep) => `<option value="${MRMS_AUTH.escapeHtml(dep)}">${MRMS_AUTH.escapeHtml(dep)}</option>`).join("");

  if (selectedValue && departments.includes(selectedValue)) {
    select.value = selectedValue;
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
  if (!tbody) return;
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
  if (!form) return;
  const title = document.getElementById("doctor-modal-title");
  form.reset();
  clearFormErrors(form);

  if (doctor) {
    title.textContent = "Edit Doctor";
    document.getElementById("doctor-id").value = doctor.id;
    document.getElementById("doctor-name").value = doctor.name || "";
    document.getElementById("doctor-specialty").value = doctor.specialty || "";
    document.getElementById("doctor-department").value = doctor.department || "";
    document.getElementById("doctor-contact").value = doctor.contact || "";
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
      response = await MRMS_AUTH.apiFetch(`${MRMS_AUTH.API_BASE}/doctors/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
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

/* ========================================================================
   PATIENTS PAGE
   ======================================================================== */
let patientsCache = [];
let doctorsCache = [];
let deletePatientId = null;

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
  if (!tbody) return;
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
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete, 'patient'));
  });
}

function openPatientModal(patient = null) {
  const form = document.getElementById("patient-form");
  if (!form) return;
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

/* ========================================================================
   DIAGNOSES PAGE
   ======================================================================== */
let diagnosesCache = [];
let deleteDiagnosisId = null;

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
  await Promise.all([loadPatientsForDiagnosis(), loadDiagnoses()]);
}

async function loadPatientsForDiagnosis() {
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
  if (!tbody) return;
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
  if (!tbody) return;
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
    btn.addEventListener("click", () => openDeleteDiagnosisModal(btn.dataset.delete));
  });
}

function severityBadge(severity) {
  const s = (severity || "").toLowerCase();
  const cls = ["mild", "moderate", "severe", "critical"].includes(s) ? s : "moderate";
  return `<span class="badge badge-${cls}">${MRMS_AUTH.escapeHtml(severity || "—")}</span>`;
}

function openDiagnosisModal(diagnosis = null) {
  const form = document.getElementById("diagnosis-form");
  if (!form) return;
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

function openDeleteDiagnosisModal(id) {
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

/* ========================================================================
   REPORTS PAGE
   ======================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const printBtn = document.getElementById("btn-print-report");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  const refreshBtn = document.getElementById("btn-refresh-reports");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadReports);
  }
});

async function loadReports() {
  const container = document.getElementById("reports-container");
  if (!container) return;
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

/* ========================================================================
   SHARED UTILITY FUNCTIONS
   ======================================================================== */
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

function openDeleteModal(id, type = 'doctor') {
  if (type === 'doctor') {
    deleteDoctorId = id;
    const doctor = allDoctors.find((d) => String(d.id) === String(id));
    document.getElementById("delete-doctor-name").textContent = doctor?.name || "this doctor";
    openModal("delete-doctor-modal");
  } else if (type === 'patient') {
    deletePatientId = id;
    const patient = patientsCache.find((p) => String(p.id) === String(id));
    document.getElementById("delete-patient-name").textContent = patient?.fullName || "this patient";
    openModal("delete-patient-modal");
  }
}

/* Initialize on page load */
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is authenticated
  const session = MRMS_AUTH.getSession();
  if (session) {
    // Initialize app
    MRMS_AUTH.renderUserInfo();
    MRMS_AUTH.applyRoleVisibility();
    MRMS_AUTH.initSidebarToggle();
    MRMS_AUTH.initLogout();
    MRMS_AUTH.setActiveNav('dashboard');
    navigateToPage('dashboard');
  } else {
    // Show home page
    navigateToPage('home');
  }
});
