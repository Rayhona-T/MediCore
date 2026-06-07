const { AppError } = require("./errorHandlers");

const ROLE_ALIASES = {
  admin: "admin",
  administrator: "admin",
  clinician: "clinician",
  receptionist: "receptionist",
};

const rolePermissions = {
  admin: {
    doctors: ["create", "read", "update", "delete"],
    patients: ["create", "read", "update", "delete"],
    diagnoses: ["create", "read", "update", "delete"],
    patientProfile: ["read"],
  },
  clinician: {
    doctors: [],
    patients: ["read", "update"],
    diagnoses: ["read", "update"],
    patientProfile: ["read"],
  },
  receptionist: {
    doctors: ["read"],
    patients: ["create", "read"],
    diagnoses: [],
    patientProfile: ["read"],
  },
};

function normalizeRole(role) {
  return ROLE_ALIASES[String(role || "").toLowerCase()] || null;
}

function allow(resource, action) {
  return (req, res, next) => {
    const role = normalizeRole(req.headers["x-role"]);

    if (!role) {
      return next(
        new AppError(
          "Access denied. Provide x-role header: admin, clinician, or receptionist.",
          403
        )
      );
    }

    const isAllowed = rolePermissions[role]?.[resource]?.includes(action);
    if (!isAllowed) {
      return next(new AppError("Access denied for this role.", 403));
    }

    req.userRole = role;
    next();
  };
}

module.exports = {
  allow,
  normalizeRole,
};
