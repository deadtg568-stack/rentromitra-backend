import { ApiError } from "../utils/apiError.js";
import { uploadFiles } from "./upload.controller.js";
import { Property } from "../models/Property.js";
import { notifyPropertyApprovalRequest, notifyPropertyApprovalStatus } from "../services/notification.service.js";

function buildPropertyFilter(query) {
  const filter = {};

  if (query.city) filter.city = new RegExp(query.city, "i");
  if (query.area || query.locality) {
    const area = new RegExp(query.area || query.locality, "i");
    filter.$and = [...(filter.$and || []), { $or: [{ area }, { locality: area }] }];
  }
  if (query.areaZone) filter.areaZone = query.areaZone;
  if (query.nearbyCollege) {
    const college = new RegExp(query.nearbyCollege, "i");
    filter.$and = [...(filter.$and || []), { $or: [{ nearbyCollege: college }, { nearbyColleges: college }] }];
  }
  if (query.propertyType || query.type) {
    filter.propertyType = String(query.propertyType || query.type).toLowerCase();
  }
  if (query.genderType || query.genderPreference) {
    const gender = String(query.genderType || query.genderPreference).toLowerCase();
    filter.genderType = gender === "boys" ? "male" : gender === "girls" ? "female" : gender;
  }
  if (query.q || query.search) {
    const search = new RegExp(query.q || query.search, "i");
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { title: search },
          { address: search },
          { area: search },
          { locality: search },
          { nearbyCollege: search },
          { nearbyColleges: search },
          { propertyType: search },
          { type: search }
        ]
      }
    ];
  }
  if (query.amenities) {
    const amenities = String(query.amenities)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (amenities.length) {
      filter.amenities = { $all: amenities.map((amenity) => new RegExp(`^${amenity}$`, "i")) };
    }
  }

  const minPrice = query.minPrice ?? query.priceMin ?? query.minRent;
  const maxPrice = query.maxPrice ?? query.priceMax ?? query.maxRent;
  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = Number(minPrice);
    if (maxPrice) priceFilter.$lte = Number(maxPrice);

    filter.$or = [{ price: priceFilter }, { "rooms.monthlyRent": priceFilter }];
  }

  return filter;
}

function preparePropertyPayload(payload) {
  const property = { ...payload };

  if (property.rooms?.length) {
    if (property.price === undefined) {
      property.price = Math.min(...property.rooms.map((room) => room.monthlyRent));
    }

    if (property.availableRooms === undefined) {
      property.availableRooms = property.rooms.reduce((total, room) => total + Number(room.availableBeds || 0), 0);
    }
  }

  if (!property.state) property.state = "Madhya Pradesh";
  if (!property.city) property.city = "Bhopal";
  if (!property.area && property.locality) property.area = property.locality;
  if (property.area) property.locality = property.area;
  if (!property.nearbyCollege && property.nearbyColleges?.length) property.nearbyCollege = property.nearbyColleges[0];
  if (property.nearbyCollege) property.nearbyColleges = [property.nearbyCollege];
  if (property.location?.lat !== undefined && property.location?.lng !== undefined) {
    property.coordinates = { lat: property.location.lat, lng: property.location.lng };
    if (property.location.address && !property.address) property.address = property.location.address;
  } else if (property.coordinates?.lat !== undefined && property.coordinates?.lng !== undefined) {
    property.location = {
      address: property.address,
      lat: property.coordinates.lat,
      lng: property.coordinates.lng
    };
  }
  if (!["pg", "hostel"].includes(property.propertyType || property.type)) {
    property.foodAvailable = false;
    property.foodIncluded = false;
    property.foodCharges = 0;
    property.laundryAvailable = false;
    property.wifiAvailable = false;
  }

  return property;
}

async function uploadRequestImages(req, propertyId = "draft") {
  const files = req.files || [];
  if (!files.length) return [];
  return uploadFiles(files, `rentromitra/properties/${propertyId}`);
}

export async function listProperties(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const filter = { ...buildPropertyFilter(req.query), status: "approved" };

    if (process.env.NODE_ENV !== "production") {
      console.log("GET /api/properties", { query: req.query, filter });
    }

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate("owner", "name phone email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Property.countDocuments(filter)
    ]);

    res.json({ success: true, properties, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    next(error);
  }
}

export async function searchProperties(req, res, next) {
  return listProperties(req, res, next);
}

export async function listManagedProperties(req, res, next) {
  try {
    const filter = req.user.role === "admin" ? { owner: req.user._id } : {};
    const properties = await Property.find(filter).populate("owner", "name email").sort({ createdAt: -1 });
    res.json({ success: true, properties });
  } catch (error) {
    next(error);
  }
}

export async function getProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id).populate("owner", "name phone email");
    if (!property || property.status !== "approved") throw new ApiError(404, "Property not found");
    res.json({ success: true, property });
  } catch (error) {
    next(error);
  }
}

export async function createProperty(req, res, next) {
  try {
    const owner = req.user._id;
    const uploadedImages = await uploadRequestImages(req);
    const payload = {
      ...preparePropertyPayload(req.validatedProperty),
      images: [...(req.validatedProperty.images || []), ...uploadedImages],
      owner,
      status: "pending",
      availability: "available",
      isPublished: false,
      isVerified: false,
      ownerVerification: {
        ...(req.validatedProperty.ownerVerification || {}),
        status: "pending",
        verifiedAt: undefined
      }
    };

    const property = await Property.create(payload);
    await property.populate("owner", "name phone email");
    await notifyPropertyApprovalRequest({ property, sender: req.user });

    if (process.env.NODE_ENV !== "production") {
      console.log("POST /api/properties saved", {
        id: property._id,
        title: property.title,
        status: property.status,
        isPublished: property.isPublished,
        ownerVerification: property.ownerVerification?.status
      });
    }

    res.status(201).json({ success: true, property });
  } catch (error) {
    next(error);
  }
}

export async function updateProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) throw new ApiError(404, "Property not found");

    const isOwner = property.owner.toString() === req.user._id.toString();
    if (req.user.role === "admin" && !isOwner) {
      throw new ApiError(403, "Admins can only update their own properties");
    }

    const uploadedImages = await uploadRequestImages(req, property._id);
    const payload = preparePropertyPayload(req.validatedProperty);
    if (uploadedImages.length) {
      payload.images = [...(payload.images || property.images || []), ...uploadedImages];
    }

    Object.assign(property, payload);
    if (req.user.role === "admin") {
      property.status = "pending";
      property.ownerVerification = {
        ...(property.ownerVerification || {}),
        status: "pending",
        verifiedAt: undefined
      };
    }
    await property.save();
    res.json({ success: true, property });
  } catch (error) {
    next(error);
  }
}

export async function deleteProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) throw new ApiError(404, "Property not found");

    const isOwner = property.owner.toString() === req.user._id.toString();
    if (req.user.role === "admin" && !isOwner) {
      throw new ApiError(403, "Admins can only delete their own properties");
    }

    await property.deleteOne();
    res.json({ success: true, message: "Property deleted" });
  } catch (error) {
    next(error);
  }
}

export async function listPendingProperties(req, res, next) {
  try {
    const properties = await Property.find({ status: "pending" }).populate("owner", "name email").sort({ createdAt: -1 });
    res.json({ success: true, properties });
  } catch (error) {
    next(error);
  }
}

async function updateApprovalStatus(req, res, next, status) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) throw new ApiError(404, "Property not found");

    property.status = status;
    property.ownerVerification = {
      ...(property.ownerVerification || {}),
      status: status === "approved" ? "verified" : "rejected",
      verifiedAt: status === "approved" ? new Date() : property.ownerVerification?.verifiedAt
    };
    await property.save();
    await property.populate("owner", "name email");
    await notifyPropertyApprovalStatus({ property, status, sender: req.user });

    res.json({ success: true, property });
  } catch (error) {
    next(error);
  }
}

export async function approveProperty(req, res, next) {
  return updateApprovalStatus(req, res, next, "approved");
}

export async function rejectProperty(req, res, next) {
  return updateApprovalStatus(req, res, next, "rejected");
}

export async function setPropertyAvailability(req, res, next) {
  try {
    const { availability } = req.body;
    if (!["available", "booked"].includes(availability)) {
      throw new ApiError(400, "availability must be 'available' or 'booked'");
    }

    const property = await Property.findById(req.params.id);
    if (!property) throw new ApiError(404, "Property not found");

    property.availability = availability;
    property.manualAvailabilityOverride = true;
    await property.save();
    await property.populate("owner", "name email");

    res.json({ success: true, property });
  } catch (error) {
    next(error);
  }
}

export async function clearPropertyAvailabilityOverride(req, res, next) {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) throw new ApiError(404, "Property not found");

    property.manualAvailabilityOverride = false;
    await property.save();
    await property.populate("owner", "name email");

    res.json({ success: true, property });
  } catch (error) {
    next(error);
  }
}
