const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function getAllowedOrigins() {
  return new Set([
    ...localOrigins,
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.CLIENT_URLS),
    ...splitOrigins(process.env.FRONTEND_URL)
  ]);
}

export function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, "");
  if (getAllowedOrigins().has(normalizedOrigin)) return true;

  try {
    const { hostname, protocol } = new URL(normalizedOrigin);
    return protocol === "https:" && hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
};
