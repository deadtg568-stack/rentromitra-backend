import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is missing");
  }

  // Mongoose maintains the connection pool internally after this resolves.
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log("MongoDB Connected");
}
