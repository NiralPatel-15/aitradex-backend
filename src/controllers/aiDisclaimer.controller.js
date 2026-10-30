const AiDisclaimerAcceptance = require("../models/AiDisclaimerAcceptance");

const CURRENT_DISCLAIMER_VERSION = "1.0.0";

const DISCLAIMER = {
  version: CURRENT_DISCLAIMER_VERSION,
  title: "Important AI & Investment Disclaimer",
  sections: [
    {
      heading: "Educational purposes",
      text: "AITradeX provides educational information to help you understand financial markets. Its AI-generated content is not personalized financial advice.",
    },
    {
      heading: "Predictions are uncertain",
      text: "Market analysis, forecasts, and predictions may be inaccurate or incomplete. Past performance does not guarantee future results.",
    },
    {
      heading: "Verify market information",
      text: "AI-generated responses may contain errors and may not reflect the latest market prices or events. Check reliable sources before making decisions.",
    },
    {
      heading: "Investment risk",
      text: "Investments can lose value, including the entire amount invested. You are responsible for your own investment decisions and should consider your financial situation and risk tolerance.",
    },
    {
      heading: "No guaranteed returns",
      text: "AITradeX does not guarantee profits, accurate predictions, or successful investment outcomes.",
    },
  ],
};

function getFirebaseUid(req) {
  return (
    req.userId ||
    req.firebaseUser?.uid ||
    req.user?.uid ||
    req.auth?.uid
  );
}

async function getDisclaimerStatus(req, res) {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated Firebase user not found.",
      });
    }

    const acceptance =
      await AiDisclaimerAcceptance.findOne({
        firebaseUid,
        version: CURRENT_DISCLAIMER_VERSION,
      }).lean();

    return res.status(200).json({
      success: true,
      disclaimer: DISCLAIMER,
      accepted: Boolean(acceptance),
      acceptedAt: acceptance?.acceptedAt || null,
    });
  } catch (error) {
    console.error("AI disclaimer status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to check disclaimer acceptance.",
    });
  }
}

async function acceptDisclaimer(req, res) {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated Firebase user not found.",
      });
    }

    const requestedVersion = req.body?.version;

    if (requestedVersion !== CURRENT_DISCLAIMER_VERSION) {
      return res.status(409).json({
        success: false,
        message:
          "The disclaimer version has changed. Please reload and review the current disclaimer.",
        code: "DISCLAIMER_VERSION_MISMATCH",
        currentVersion: CURRENT_DISCLAIMER_VERSION,
      });
    }

    const acceptance =
      await AiDisclaimerAcceptance.findOneAndUpdate(
        {
          firebaseUid,
          version: CURRENT_DISCLAIMER_VERSION,
        },
        {
          $setOnInsert: {
            firebaseUid,
            version: CURRENT_DISCLAIMER_VERSION,
            acceptedAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

    return res.status(200).json({
      success: true,
      message: "Disclaimer acceptance saved.",
      accepted: true,
      version: acceptance.version,
      acceptedAt: acceptance.acceptedAt,
    });
  } catch (error) {
    // A concurrent request can race with the unique index.
    if (error?.code === 11000) {
      try {
        const firebaseUid = getFirebaseUid(req);

        const acceptance =
          await AiDisclaimerAcceptance.findOne({
            firebaseUid,
            version: CURRENT_DISCLAIMER_VERSION,
          }).lean();

        if (acceptance) {
          return res.status(200).json({
            success: true,
            message: "Disclaimer already accepted.",
            accepted: true,
            version: acceptance.version,
            acceptedAt: acceptance.acceptedAt,
          });
        }
      } catch (lookupError) {
        console.error(
          "AI disclaimer duplicate lookup error:",
          lookupError.message,
        );
      }
    }

    console.error("AI disclaimer acceptance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save disclaimer acceptance.",
    });
  }
}

async function requireCurrentDisclaimerAcceptance(req, res, next) {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated Firebase user not found.",
      });
    }

    const acceptance =
      await AiDisclaimerAcceptance.exists({
        firebaseUid,
        version: CURRENT_DISCLAIMER_VERSION,
      });

    if (!acceptance) {
      return res.status(403).json({
        success: false,
        message:
          "Please review and accept the current AI disclaimer before using AI chat.",
        code: "DISCLAIMER_ACCEPTANCE_REQUIRED",
        version: CURRENT_DISCLAIMER_VERSION,
      });
    }

    return next();
  } catch (error) {
    console.error(
      "AI disclaimer enforcement error:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify disclaimer acceptance.",
    });
  }
}

module.exports = {
  getDisclaimerStatus,
  acceptDisclaimer,
  requireCurrentDisclaimerAcceptance,
};

