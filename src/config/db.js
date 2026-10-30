const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from environment variables.");
    }

    // Both Flutter and the website should use the same backend
    // and the same MongoDB database.
    const dbName = process.env.MONGODB_DB_NAME || "aitradex";

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName,
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log("\n========================================");
    console.log("✅ MongoDB Atlas Connected");
    console.log(`📂 Database : ${conn.connection.name}`);
    console.log(`🖥️ Host     : ${conn.connection.host}`);
    console.log("========================================\n");

    mongoose.connection.on("connected", () => {
      console.log("🟢 MongoDB Connected");
    });

    mongoose.connection.on("disconnected", () => {
      console.log("🟠 MongoDB Disconnected");
    });

    mongoose.connection.on("error", (error) => {
      console.error("🔴 MongoDB Error:", error.message);
    });
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ MongoDB Connection Failed");
    console.error(error.message);
    console.error("========================================\n");

    process.exit(1);
  }
};

module.exports = connectDB;
