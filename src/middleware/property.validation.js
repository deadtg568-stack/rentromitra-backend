import mongoose from "mongoose";
import { ApiError } from "../utils/apiError.js";

const PROPERTY_TYPES = ["room", "hostel", "pg"];
const GENDER_TYPES = ["male", "female", "any"];
const QUERY_GENDER_TYPES = ["male", "female", "any", "boys", "girls"];
const VERIFICATION_STATUSES = ["pending", "submitted", "verified", "rejected"];
const AREA_ZONES = ["north", "south", "east", "west", "central"];
const SHARING_TYPES = ["single", "double", "triple", "four_plus"];
const ROOM_TYPES = ["1_bhk", "2_bhk", "3_bhk", "flat"];

function toArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      throw new ApiError(400, "Invalid JSON array value");
    }
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBoolean(value, field) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(String(value).trim().toLowerCase())) return false;
  throw new ApiError(400, `${field} must be a boolean`);
}

function toObject(value, field) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      throw new ApiError(400, `${field} must be a valid JSON object`);
    }
  }
  throw new ApiError(400, `${field} must be an object`);
}

function normalizeLocation(value) {
  const location = toObject(value, "location");
  if (!location) return undefined;

  const lat = toNumber(location.lat, "location.lat", { min: -90, required: true });
  const lng = toNumber(location.lng, "location.lng", { min: -180, required: true });

  if (lat > 90) throw new ApiError(400, "location.lat must be between -90 and 90");
  if (lng > 180) throw new ApiError(400, "location.lng must be between -180 and 180");

  return {
    address: location.address ? String(location.address).trim() : "",
    lat,
    lng
  };
}

function toNumber(value, field, { min = 0, required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(400, `${field} is required`);
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new ApiError(400, `${field} must be a number greater than or equal to ${min}`);
  }

  return number;
}

function normalizeEnum(value, field, options, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(400, `${field} is required`);
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!options.includes(normalized)) {
    throw new ApiError(400, `${field} must be one of: ${options.join(", ")}`);
  }

  return normalized;
}

function normalizeImages(images) {
  return toArray(images).map((image) => {
    if (typeof image === "string") return { url: image };
    if (!image?.url) throw new ApiError(400, "Each image must include a url");
    return { url: image.url, publicId: image.publicId };
  });
}

function normalizeRooms(rooms) {
  if (rooms === undefined) return undefined;
  if (typeof rooms === "string") {
    try {
      rooms = JSON.parse(rooms);
    } catch {
      throw new ApiError(400, "rooms must be a valid JSON array");
    }
  }
  if (!Array.isArray(rooms)) throw new ApiError(400, "rooms must be an array");

  return rooms.map((room, index) => {
    const legacyRoomType = ROOM_TYPES.includes(room.sharingType) ? room.sharingType : undefined;
    const sharingType = SHARING_TYPES.includes(room.sharingType) ? room.sharingType : "single";

    return {
      ...room,
      title: room.title || `Room ${index + 1}`,
      sharingType: normalizeEnum(sharingType, "room sharingType", SHARING_TYPES, true),
      roomType: normalizeEnum(room.roomType || legacyRoomType || "1_bhk", "room roomType", ROOM_TYPES),
      monthlyRent: toNumber(room.monthlyRent, "room monthlyRent", { min: 0, required: true }),
      deposit: toNumber(room.deposit ?? 0, "room deposit", { min: 0 }),
      totalBeds: toNumber(room.totalBeds ?? 0, "room totalBeds", { min: 0 }),
      availableBeds: toNumber(room.availableBeds, "room availableBeds", { min: 0, required: true })
    };
  });
}

export function validatePropertyId(req, _res, next) {
  const propertyId = req.params.id || req.params.propertyId;

  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    return next(new ApiError(400, "Invalid property id"));
  }

  next();
}

export function validatePropertyQuery(req, _res, next) {
  try {
    const { minPrice, maxPrice, minRent, maxRent, priceMin, priceMax, page, limit } = req.query;
    const numericFields = { minPrice, maxPrice, minRent, maxRent, priceMin, priceMax, page, limit };

    Object.entries(numericFields).forEach(([field, value]) => {
      if (value !== undefined) toNumber(value, field, { min: field === "page" || field === "limit" ? 1 : 0 });
    });

    if (req.query.propertyType) normalizeEnum(req.query.propertyType, "propertyType", PROPERTY_TYPES);
    if (req.query.type) normalizeEnum(req.query.type, "type", PROPERTY_TYPES);
    if (req.query.genderType) normalizeEnum(req.query.genderType, "genderType", QUERY_GENDER_TYPES);
    if (req.query.genderPreference) normalizeEnum(req.query.genderPreference, "genderPreference", QUERY_GENDER_TYPES);
    if (req.query.amenities && typeof req.query.amenities !== "string") {
      throw new ApiError(400, "amenities must be a comma-separated string");
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function validatePropertyPayload(req, _res, next) {
  try {
    const isCreate = req.method === "POST";
    const body = req.body;
    const payload = {};

    ["title", "description", "city", "address", "area", "locality", "nearbyCollege", "state", "pincode"].forEach((field) => {
      if (body[field] !== undefined) payload[field] = String(body[field]).trim();
      if (isCreate && ["title", "description", "address", "area"].includes(field) && !payload[field]) {
        throw new ApiError(400, `${field} is required`);
      }
    });

    if (payload.area) payload.locality = payload.area;
    if (!payload.area && payload.locality) payload.area = payload.locality;

    const propertyType = normalizeEnum(body.propertyType ?? body.type, "propertyType", PROPERTY_TYPES, isCreate);
    if (propertyType) {
      payload.propertyType = propertyType;
      payload.type = propertyType;
    }

    const genderValue = body.genderType ?? body.genderPreference ?? (isCreate ? "any" : undefined);
    const genderType = normalizeEnum(genderValue, "genderType", GENDER_TYPES);
    if (genderType) {
      payload.genderType = genderType;
      payload.genderPreference = genderType;
    }

    const rooms = normalizeRooms(body.rooms);
    if (rooms) payload.rooms = rooms;

    const price = toNumber(body.price, "price", { min: 0, required: isCreate && !rooms?.length });
    if (price !== undefined) payload.price = price;

    const availableRooms = toNumber(body.availableRooms, "availableRooms", { min: 0 });
    if (availableRooms !== undefined) payload.availableRooms = availableRooms;

    ["rentNegotiable", "foodAvailable", "foodIncluded", "laundryAvailable", "wifiAvailable"].forEach((field) => {
      const value = toBoolean(body[field], field);
      if (value !== undefined) payload[field] = value;
    });

    const foodCharges = toNumber(body.foodCharges, "foodCharges", { min: 0 });
    if (foodCharges !== undefined) payload.foodCharges = foodCharges;

    if (body.amenities !== undefined) payload.amenities = toArray(body.amenities);
    if (body.rules !== undefined) payload.rules = toArray(body.rules);
    if (body.nearbyColleges !== undefined) payload.nearbyColleges = toArray(body.nearbyColleges);
    if (payload.nearbyCollege) payload.nearbyColleges = [payload.nearbyCollege];
    if (body.images !== undefined) payload.images = normalizeImages(body.images);

    if (body.location !== undefined) {
      payload.location = normalizeLocation(body.location);
    }

    const areaZone = normalizeEnum(body.areaZone, "areaZone", AREA_ZONES);
    if (areaZone) payload.areaZone = areaZone;

    const coordinates = toObject(body.coordinates, "coordinates");
    if (coordinates) {
      payload.coordinates = {
        lat: toNumber(coordinates.lat, "coordinates.lat"),
        lng: toNumber(coordinates.lng, "coordinates.lng")
      };
    }

    const ownerVerification = toObject(body.ownerVerification, "ownerVerification");
    if (ownerVerification) {
      const status = normalizeEnum(ownerVerification.status, "ownerVerification.status", VERIFICATION_STATUSES);
      payload.ownerVerification = { ...ownerVerification };
      if (status) payload.ownerVerification.status = status;
    }

    if (typeof body.isPublished === "boolean") payload.isPublished = body.isPublished;
    if (typeof body.isVerified === "boolean") payload.isVerified = body.isVerified;

    const ratings = toObject(body.ratings, "ratings");
    if (ratings) {
      payload.ratings = {
        average: toNumber(ratings.average ?? 0, "ratings.average", { min: 0 }),
        count: toNumber(ratings.count ?? 0, "ratings.count", { min: 0 })
      };
      if (payload.ratings.average > 5) throw new ApiError(400, "ratings.average must be between 0 and 5");
      payload.ratingAverage = payload.ratings.average;
      payload.ratingCount = payload.ratings.count;
    }

    if (!Object.keys(payload).length) throw new ApiError(400, "No valid property fields provided");

    req.validatedProperty = payload;
    next();
  } catch (error) {
    next(error);
  }
}
