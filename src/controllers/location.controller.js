import { bhopalAreas } from "../data/bhopalAreas.js";
import { bhopalColleges } from "../data/bhopalColleges.js";

function matchesQuery(value, query) {
  return value.toLowerCase().includes(query);
}

export function listAreas(_req, res) {
  res.json({ success: true, areas: bhopalAreas });
}

export function listColleges(_req, res) {
  res.json({ success: true, colleges: bhopalColleges });
}

export function searchLocations(req, res) {
  const query = String(req.query.query || req.query.q || "").trim().toLowerCase();

  if (!query) {
    return res.json({ success: true, areas: [], colleges: [], results: [] });
  }

  const areas = bhopalAreas.filter((area) => matchesQuery(area.areaName, query));
  const colleges = bhopalColleges.filter((college) => matchesQuery(college.collegeName, query));
  const results = [
    ...areas.map((area) => ({ type: "area", name: area.areaName, category: area.category, city: area.city })),
    ...colleges.map((college) => ({ type: "college", name: college.collegeName, category: college.category, city: college.city }))
  ];

  res.json({ success: true, areas, colleges, results });
}
