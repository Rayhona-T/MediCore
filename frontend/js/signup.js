/**
 * CareTrack Clinic MRMS - Sign Up Page
 * Simulated sign-up flow for the prototype.
 */

document.addEventListener("DOMContentLoaded", () => {
  MRMS_AUTH.redirectIfAuthenticated();

  const signupForm = document.getElementById("signup-form");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const errorEl = document.getElementById("signup-error");

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
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const result = await MRMS_AUTH.register(username, password, role);
    submitBtn.disabled = false;

    if (result.success) {
      window.location.href = "dashboard.html";
    } else {
      errorEl.textContent = result.message || "Sign-up failed.";
      errorEl.classList.remove("hidden");
    }
  });
});
