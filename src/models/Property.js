import mongoose from "mongoose";

const PROPERTY_TYPES = ["room", "hostel", "pg"];
const GENDER_TYPES = ["male", "female", "any"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const AVAILABILITY_STATUSES = ["available", "booked"];
const ROOM_TYPES = ["1_bhk", "2_bhk", "3_bhk", "flat"];

const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    sharingType: { type: String, enum: ["single", "double", "triple", "four_plus"], required: true },
    roomType: { type: String, enum: ["1_bhk", "2_bhk", "3_bhk", "flat"], default: "1_bhk" },
    monthlyRent: { type: Number, required: true, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },
    totalBeds: { type: Number, default: 0, min: 0 },
    availableBeds: { type: Number, required: true, min: 0 }
  },
  { _id: true }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String
  },
  { _id: false }
);

const ratingsSchema = new mongoose.Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const propertySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, alias: "ownerId" },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0, index: true },
    propertyType: { type: String, enum: PROPERTY_TYPES, required: true, lowercase: true, trim: true, index: true },
    type: { type: String, enum: PROPERTY_TYPES, lowercase: true, trim: true, index: true },
    genderType: { type: String, enum: GENDER_TYPES, default: "any", lowercase: true, trim: true },
    genderPreference: { type: String, enum: GENDER_TYPES, default: "any", lowercase: true, trim: true },
    address: { type: String, required: true },
    location: {
      address: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number }
    },
    city: { type: String, required: true, default: "Bhopal", index: true },
    area: { type: String, required: true, trim: true, index: true },
    nearbyCollege: { type: String, trim: true, index: true },
    locality: { type: String, index: true },
    areaZone: {
      type: String,
      enum: ["north", "south", "east", "west", "central"],
      default: "central",
      index: true
    },
    state: { type: String, required: true, default: "Madhya Pradesh" },
    pincode: { type: String },
    nearbyColleges: [{ type: String, trim: true, index: true }],
    coordinates: {
      lat: Number,
      lng: Number
    },
    amenities: [{ type: String }],
    rules: [{ type: String }],
    images: [imageSchema],
    rentNegotiable: { type: Boolean, default: false },
    foodAvailable: { type: Boolean, default: false },
    foodIncluded: { type: Boolean, default: false },
    foodCharges: { type: Number, default: 0, min: 0 },
    laundryAvailable: { type: Boolean, default: false },
    wifiAvailable: { type: Boolean, default: false },
    status: { type: String, enum: APPROVAL_STATUSES, default: "pending", index: true },
    availability: { type: String, enum: AVAILABILITY_STATUSES, default: "available", index: true },
    availableRooms: { type: Number, default: 0, min: 0 },
    ratings: { type: ratingsSchema, default: () => ({ average: 0, count: 0 }) },
    rooms: [roomSchema],
    isVerified: { type: Boolean, default: false },
    ownerVerification: {
      status: {
        type: String,
        enum: ["pending", "submitted", "verified", "rejected"],
        default: "pending"
      },
      documentType: {
        type: String,
        enum: ["aadhaar", "pan", "property_tax", "electricity_bill", "rent_agreement", "other"],
        default: "aadhaar"
      },
      verifiedAt: Date,
      notes: String
    },
    isPublished: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

propertySchema.index({
  title: "text",
  description: "text",
  city: "text",
  area: "text",
  locality: "text",
  nearbyCollege: "text",
  nearbyColleges: "text"
});

propertySchema.pre("validate", function syncPropertyAliases(next) {
  if (!this.propertyType && this.type) this.propertyType = this.type;
  if (!this.type && this.propertyType) this.type = this.propertyType;

  if (!this.genderType && this.genderPreference) this.genderType = this.genderPreference;
  if (!this.genderPreference && this.genderType) this.genderPreference = this.genderType;
  if (!this.area && this.locality) this.area = this.locality;
  if (!this.locality && this.area) this.locality = this.area;
  if (!this.nearbyCollege && this.nearbyColleges?.length) this.nearbyCollege = this.nearbyColleges[0];
  if (this.nearbyCollege && !this.nearbyColleges?.includes(this.nearbyCollege)) {
    this.nearbyColleges = [this.nearbyCollege, ...(this.nearbyColleges || [])];
  }
  this.rooms?.forEach((room) => {
    if (ROOM_TYPES.includes(room.sharingType)) {
      room.roomType = room.roomType || room.sharingType;
      room.sharingType = "double";
    }
    if (!room.roomType) room.roomType = "1_bhk";
  });

  if ((this.price === undefined || this.price === null) && this.rooms?.length) {
    this.price = Math.min(...this.rooms.map((room) => room.monthlyRent).filter((rent) => rent !== undefined));
  }

  if ((this.availableRooms === undefined || this.availableRooms === null) && this.rooms?.length) {
    this.availableRooms = this.rooms.reduce((total, room) => total + Number(room.availableBeds || 0), 0);
  }

  if (!this.ratings) this.ratings = { average: 0, count: 0 };
  if (this.ratingAverage === undefined || this.ratingAverage === null) this.ratingAverage = this.ratings.average || 0;
  if (this.ratingCount === undefined || this.ratingCount === null) this.ratingCount = this.ratings.count || 0;
  if (this.ratings.average !== this.ratingAverage) this.ratings.average = this.ratingAverage || 0;
  if (this.ratings.count !== this.ratingCount) this.ratings.count = this.ratingCount || 0;

  if (!this.status) {
    if (this.isPublished && this.isVerified) this.status = "approved";
    else if (this.ownerVerification?.status === "rejected") this.status = "rejected";
    else this.status = "pending";
  }

  if (this.status === "approved") {
    this.isPublished = true;
    this.isVerified = true;
    this.ownerVerification = {
      ...(this.ownerVerification || {}),
      status: "verified",
      verifiedAt: this.ownerVerification?.verifiedAt || new Date()
    };
  } else {
    this.isPublished = false;
    this.isVerified = false;
    this.ownerVerification = {
      ...(this.ownerVerification || {}),
      status: this.status === "rejected" ? "rejected" : "pending"
    };
  }

  this.availability = Number(this.availableRooms || 0) > 0 ? "available" : "booked";

  next();
});

propertySchema.set("toJSON", { virtuals: true });
propertySchema.set("toObject", { virtuals: true });

export const Property = mongoose.model("Property", propertySchema);
