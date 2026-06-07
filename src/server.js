import dotenv from "dotenv";
import dns from "node:dns";
import http from "http";

dotenv.config();

const PORT = process.env.PORT || 5000;

function logStartupEnvironment() {
  const missingRequired = ["JWT_SECRET"].filter((key) => !process.env[key]);
  const hasMongoUri = Boolean(process.env.MONGO_URI || process.env.MONGODB_URI);

  if (!hasMongoUri) {
    console.error("Missing required environment variable: MONGO_URI or MONGODB_URI");
  }

  for (const key of missingRequired) {
    console.error(`Missing required environment variable: ${key}`);
  }
}

function logError(label, error) {
  console.error(label);
  console.error(error?.stack || error);
}

async function startServer() {
  console.log("Server starting...");
  logStartupEnvironment();

  // Fix MongoDB Atlas DNS issue.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  const [{ app }, { connectDB }, { initializeSocket }, { getMissingCloudinaryConfig }] = await Promise.all([
    import("./app.js"),
    import("./config/db.js"),
    import("./socket.js"),
    import("./config/cloudinary.js")
  ]);

  const missingCloudinary = getMissingCloudinaryConfig();
  if (missingCloudinary.length) {
    console.warn(`Cloudinary credentials missing: ${missingCloudinary.join(", ")}. Image uploads will fail until configured.`);
  }

  const server = http.createServer(app);

  server.on("error", (error) => {
    logError("Server failed to start:", error);
  });

  try {
    await connectDB();
  } catch (error) {
    logError("MongoDB connection failed:", error);
  }

  try {
    await initializeSocket(server);
  } catch (error) {
    logError("Socket.IO initialization failed:", error);
  }

  await new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      resolve();
    });
  });
}

startServer().catch((error) => {
  logError("Fatal startup error:", error);
});
