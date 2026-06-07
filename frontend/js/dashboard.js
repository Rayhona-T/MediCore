/**
 * CareTrack Clinic MRMS - Dashboard
 * Loads statistics and recent activity from backend API.
 */

document.addEventListener("DOMContentLoaded", () => {
  MRMS_AUTH.initApp("dashboard");
  loadDashboardStats();
  loadRecentActivity();
});

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
          /* Support array or { count, total } response shapes */
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
