import { Wishlist } from "../models/Wishlist.js";

export async function listWishlist(req, res, next) {
  try {
    const items = await Wishlist.find({ user: req.user._id }).populate("property").sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
}

export async function toggleWishlist(req, res, next) {
  try {
    const query = { user: req.user._id, property: req.params.propertyId };
    const existing = await Wishlist.findOne(query);

    if (existing) {
      await existing.deleteOne();
      return res.json({ success: true, wished: false });
    }

    await Wishlist.create(query);
    res.status(201).json({ success: true, wished: true });
  } catch (error) {
    next(error);
  }
}
