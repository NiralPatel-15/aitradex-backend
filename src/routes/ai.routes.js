const express = require("express");

const { chatWithAi } = require("../controllers/ai.controller");

const firebaseAuthMiddleware = require("../middleware/firebaseAuth.middleware");

const {
  getDisclaimerStatus,
  acceptDisclaimer,
  requireCurrentDisclaimerAcceptance,
} = require("../controllers/aiDisclaimer.controller");

const router = express.Router();

// Get the current disclaimer and this user's acceptance status.
router.get(
  "/disclaimer/status",
  firebaseAuthMiddleware,
  getDisclaimerStatus,
);

// Save acceptance of the current disclaimer version.
router.post(
  "/disclaimer/accept",
  firebaseAuthMiddleware,
  acceptDisclaimer,
);

// AI chat is available only after acceptance.
router.post(
  "/chat",
  firebaseAuthMiddleware,
  requireCurrentDisclaimerAcceptance,
  chatWithAi,
);

module.exports = router;