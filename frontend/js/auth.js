/**
 * CareTrack Clinic MRMS - Authentication & Authorization
 * Handles login, session storage, route protection, and role-based UI.
 */

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

  /**
   * Get current session from sessionStorage
   * @returns {{ username: string, role: string } | null}
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save session after login
   */
  function setSession(username, role) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username, role: role.toLowerCase() })
    );
  }

  /**
   * Clear session on logout
   */
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Check if user has permission for resource and action
   */
  function can(resource, action) {
    const session = getSession();
    if (!session) return false;
    const rolePerms = PERMISSIONS[session.role];
    if (!rolePerms || !rolePerms[resource]) return false;
    return Boolean(rolePerms[resource][action]);
  }

  /**
   * Redirect to login if not authenticated (for protected pages)
   */
  function requireAuth() {
    if (!getSession()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  /**
   * Redirect to dashboard if already logged in (login page)
   */
  function redirectIfAuthenticated() {
    if (getSession()) {
      window.location.href = "dashboard.html";
    }
  }

  /**
   * Apply role-based visibility to elements with data-permission attribute
   * Format: data-permission="resource:action" e.g. doctors:create
   */
  function applyRoleVisibility() {
    document.querySelectorAll("[data-permission]").forEach((el) => {
      const [resource, action] = el.dataset.permission.split(":");
      if (can(resource, action)) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });

    /* Hide entire nav items when user cannot read that section */
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

  /**
   * Update sidebar user display
   */
  function renderUserInfo() {
    const session = getSession();
    const userEl = document.getElementById("sidebar-user");
    if (userEl && session) {
      userEl.innerHTML = `
        <strong>${escapeHtml(session.username)}</strong>
        <span>${formatRole(session.role)}</span>
      `;
    }
  }

  /**
   * Highlight active nav link
   */
  function setActiveNav(page) {
    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
      link.classList.toggle(
        "active",
        link.dataset.page === page
      );
    });
  }

  /**
   * Mobile sidebar toggle
   */
  function initSidebarToggle() {
    const toggle = document.getElementById("menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("is-open");
      backdrop?.classList.toggle("is-visible");
    });

    backdrop?.addEventListener("click", () => {
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
    });
  }

  /**
   * Logout handler – calls backend logout endpoint, clears session, redirects
   */
  function initLogout() {
    const btn = document.getElementById("logout-btn");
    if (btn) {
      btn.addEventListener("click", async () => {
        await logout();
        window.location.href = "login.html";
      });
    }
  }

  /**
   * Initialize protected app layout
   */
  function initApp(page) {
    if (!requireAuth()) return;
    applyRoleVisibility();
    renderUserInfo();
    setActiveNav(page);
    initSidebarToggle();
    initLogout();
  }

  /**
   * Show toast-style alert
   */
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

  /**
   * Login via backend API.
   * Sends credentials to POST /api/auth/login, then saves session locally.
   * Backend RBAC is enforced through x-role header on subsequent API calls.
   */
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

  /**
   * Register via backend API.
   * Sends credentials to POST /api/auth/register, then saves session locally.
   */
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

  /**
   * Logout via backend API, then clear the local session.
   */
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
    clearSession();
  }

  /**
   * Shared fetch helper with role header for backend RBAC
   */
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
    requireAuth,
    redirectIfAuthenticated,
    applyRoleVisibility,
    initApp,
    showAlert,
    login,
    register,
    logout,
    apiFetch,
    escapeHtml,
    formatRole,
    PERMISSIONS,
  };
})();

/* Login page initialization */
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  MRMS_AUTH.redirectIfAuthenticated();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const errorEl = document.getElementById("login-error");

    /* Client-side validation */
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
      window.location.href = "dashboard.html";
    } else {
      errorEl.textContent = result.message || "Login failed.";
      errorEl.classList.remove("hidden");
    }
  });
});
