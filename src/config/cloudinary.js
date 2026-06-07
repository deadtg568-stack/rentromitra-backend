import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "../utils/apiError.js";

// Cloudinary reads credentials from environment variables and is used by
// upload controllers to store property images outside the API server.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export function getMissingCloudinaryConfig() {
  const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  return required.filter((key) => !process.env[key]);
}

export function assertCloudinaryConfig() {
  const missing = getMissingCloudinaryConfig();

  if (missing.length) {
    throw new ApiError(500, `Cloudinary credentials are not configured: ${missing.join(", ")}`);
  }
}

export { cloudinary };
