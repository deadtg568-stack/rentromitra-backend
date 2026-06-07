import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import userRoutes from "./routes/user.routes.js";
import locationRoutes from "./routes/location.routes.js";
import propertyRoutes from "./routes/property.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import complaintRoutes from "./routes/complaint.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";

export const app = express();

// Security and CORS middleware should run before routes.
app.use(helmet());
app.use(cors(corsOptions));

// Parse incoming request bodies and signed/unsigned cookies.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Development-friendly request logs; production logs include more detail.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Basic API rate limiting protects authentication and public listing routes.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Rentomitra API" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Rentomitra API" });
});

// Versioned REST modules.
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/notifications", notificationRoutes);

// Keep global error middleware last so it can catch route and controller errors.
app.use(notFound);
app.use(errorHandler);
