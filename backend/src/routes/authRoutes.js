/**
 * CareTrack Clinic MRMS - Authentication Routes
 *
 * Maps HTTP endpoints to authController methods.
 * All auth routes are public (no role middleware) because they are
 * used before a session is established.
 *
 * Routes:
 *   POST /api/auth/register  → authController.register
 *   POST /api/auth/login     → authController.login
 *   POST /api/auth/logout    → authController.logout
 *   GET  /api/auth/me        → authController.getCurrentUser
 */

const express = require("express");
const {
  register,
  login,
  logout,
  getCurrentUser,
} = require("../controllers/authController");
const { asyncHandler } = require("../utils/errorHandlers");

const router = express.Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.get("/me", asyncHandler(getCurrentUser));

module.exports = router;
