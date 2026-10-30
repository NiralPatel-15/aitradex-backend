const mongoose = require("mongoose");

const aiDisclaimerAcceptanceSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      trim: true,
    },

    version: {
      type: String,
      required: true,
      trim: true,
    },

    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

aiDisclaimerAcceptanceSchema.index(
  { firebaseUid: 1, version: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.AiDisclaimerAcceptance ||
  mongoose.model(
    "AiDisclaimerAcceptance",
    aiDisclaimerAcceptanceSchema,
  );
