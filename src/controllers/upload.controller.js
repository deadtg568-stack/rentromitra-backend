import { Readable } from "stream";
import { assertCloudinaryConfig, cloudinary } from "../config/cloudinary.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/apiError.js";

function uploadBuffer(buffer, folder = "rentromitra/properties") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    Readable.from(buffer).pipe(stream);
  });
}

function mapUploadResult(item) {
  return {
    url: item.secure_url,
    publicId: item.public_id
  };
}

export async function uploadFiles(files, folder) {
  assertCloudinaryConfig();

  const uploads = await Promise.all(files.map((file) => uploadBuffer(file.buffer, folder)));
  return uploads.map(mapUploadResult);
}

function ensurePropertyUploadAllowed(property, user) {
  const isOwner = property.owner.toString() === user._id.toString();

  if (user.role === "admin" && !isOwner) {
    throw new ApiError(403, "Admins can only upload images for their own properties");
  }
}

export async function uploadSingleImage(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, "Image file is required");

    const [image] = await uploadFiles([req.file], "rentromitra/properties");
    res.status(201).json({ success: true, image });
  } catch (error) {
    next(error);
  }
}

export async function uploadMultipleImages(req, res, next) {
  try {
    const files = req.files || [];
    if (!files.length) throw new ApiError(400, "At least one image is required");

    const images = await uploadFiles(files, "rentromitra/properties");
    res.status(201).json({ success: true, images });
  } catch (error) {
    next(error);
  }
}

export async function deletePropertyImage(req, res, next) {
  try {
    const { publicId } = req.body;
    if (!publicId) throw new ApiError(400, "Image publicId is required");

    const property = await Property.findById(req.params.propertyId);
    if (!property) throw new ApiError(404, "Property not found");

    ensurePropertyUploadAllowed(property, req.user);

    const imageIndex = property.images.findIndex((img) => img.publicId === publicId);
    if (imageIndex === -1) throw new ApiError(404, "Image not found on this property");

    const [removedImage] = property.images.splice(imageIndex, 1);

    // Delete from Cloudinary (non-blocking — don't fail if Cloudinary is unreachable)
    try {
      assertCloudinaryConfig();
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion failed (image removed from property anyway):", cloudinaryError.message);
    }

    await property.save();

    res.json({ success: true, image: removedImage });
  } catch (error) {
    next(error);
  }
}

export async function uploadPropertyImages(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) throw new ApiError(400, "At least one image is required");

    const property = await Property.findById(req.params.propertyId);
    if (!property) throw new ApiError(404, "Property not found");

    ensurePropertyUploadAllowed(property, req.user);

    const images = await uploadFiles(files, `rentromitra/properties/${property._id}`);
    property.images.push(...images);
    await property.save();

    res.status(201).json({
      success: true,
      images,
      property
    });
  } catch (error) {
    next(error);
  }
}
