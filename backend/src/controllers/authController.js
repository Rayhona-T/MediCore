/**
 * CareTrack Clinic MRMS - Authentication Controller
 *
 * Handles authentication business logic for registration and login while
 * preserving the existing prototype flow used by the frontend.
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { dataPaths, readJson, writeJson, getNextId } = require("../utils/fileUtils");
const { requireFields } = require("../utils/validationUtils");
const { AppError } = require("../utils/errorHandlers");
const { normalizeRole } = require("../utils/roleMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "mrms_dev_jwt_secret";
const JWT_EXPIRES_IN = "1h";

/** Valid roles that a user may register or log in with */
const VALID_ROLES = ["administrator", "clinician", "receptionist"];

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    uuid: user.uuid,
    username: user.username,
    role: user.role,
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

async function migratePlainTextPassword(user, plainPassword, users) {
  if (!user.password || user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
    return false;
  }

  if (user.password === plainPassword) {
    user.password = await hashPassword(plainPassword);
    await writeJson(dataPaths.users, users);
    return true;
  }

  return false;
}

async function register(req, res) {
  requireFields(req.body, ["username", "password", "role"]);

  const username = req.body.username.trim();
  const password = req.body.password;
  const role = req.body.role.trim().toLowerCase();

  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`, 400);
  }

  const users = await readJson(dataPaths.users);

  const duplicateUser = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (duplicateUser) {
    throw new AppError("Username already exists.", 409);
  }

  const hashedPassword = await hashPassword(password);
  const newUser = {
    id: getNextId(users),
    uuid: uuidv4(),
    username,
    password: hashedPassword,
    role,
  };

  users.push(newUser);
  await writeJson(dataPaths.users, users);

  const safeUser = sanitizeUser(newUser);
  const token = createToken({ sub: newUser.id, uuid: newUser.uuid, username: newUser.username, role: newUser.role });

  res.status(201).json({ token, user: safeUser });
}

async function login(req, res) {
  requireFields(req.body, ["username", "password", "role"]);

  const username = req.body.username.trim();
  const password = req.body.password;
  const role = req.body.role.trim().toLowerCase();

  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`, 400);
  }

  const users = await readJson(dataPaths.users);
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    throw new AppError("Invalid credentials. Please try again.", 401);
  }

  let isPasswordValid = false;
  if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$"))) {
    isPasswordValid = await verifyPassword(password, user.password);
  } else {
    isPasswordValid = user.password === password;
    if (isPasswordValid) {
      await migratePlainTextPassword(user, password, users);
    }
  }

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials. Please try again.", 401);
  }

  if (user.role !== role) {
    throw new AppError("Role does not match the registered account.", 401);
  }

  const safeUser = sanitizeUser(user);
  const token = createToken({ sub: user.id, uuid: user.uuid, username: user.username, role: user.role });

  res.status(200).json({ token, user: safeUser });
}

async function logout(req, res) {
  res.status(200).json({ message: "Logged out successfully." });
}

async function getCurrentUser(req, res) {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.status(200).json({ username: decoded.username, role: decoded.role, uuid: decoded.uuid });
    } catch (err) {
      throw new AppError("Invalid or expired token.", 401);
    }
  }

  const role = normalizeRole(req.headers["x-role"]);
  if (!role) {
    throw new AppError("Not authenticated. Provide a valid x-role header.", 401);
  }

  res.status(200).json({ role });
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
};
