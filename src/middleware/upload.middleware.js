import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const storage = multer.memoryStorage();
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isValidImageFile(file) {
  const filename = file.originalname.toLowerCase();
  return allowedMimeTypes.includes(file.mimetype) && allowedExtensions.some((extension) => filename.endsWith(extension));
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    if (!isValidImageFile(file)) {
      return cb(new ApiError(400, "Only JPG, PNG, WEBP and GIF image files are allowed"));
    }

    cb(null, true);
  }
});

export function handleMulterError(error, _req, _res, next) {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(400, "Each image must be 5MB or smaller"));
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return next(new ApiError(400, "You can upload up to 10 images at a time"));
    }

    return next(new ApiError(400, error.message));
  }

  next(error);
}
