import { Router } from "express";
import { listAreas, listColleges, searchLocations } from "../controllers/location.controller.js";

const router = Router();

router.get("/areas", listAreas);
router.get("/colleges", listColleges);
router.get("/search", searchLocations);

export default router;
