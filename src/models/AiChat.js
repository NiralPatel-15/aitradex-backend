const mongoose = require("mongoose");

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    reply: {
      type: String,
      required: true,
    },

    model: {
      type: String,
      default: "openai/gpt-oss-120b",
    },
  },
  {
    timestamps: true,
  },
);

aiChatSchema.index({
  userId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AiChat || mongoose.model("AiChat", aiChatSchema);
