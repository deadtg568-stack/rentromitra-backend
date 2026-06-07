export const BHOPAL_CITY = "Bhopal";
export const BHOPAL_STATE = "Madhya Pradesh";

export const BHOPAL_LOCALITIES = [
  "MP Nagar",
  "Arera Colony",
  "Indrapuri",
  "Kolar Road",
  "Bawadia Kalan",
  "Hoshangabad Road",
  "Ayodhya Bypass",
  "New Market",
  "Shahpura",
  "Rohit Nagar",
  "Karond",
  "Bairagarh"
];

export const BHOPAL_COLLEGES = [
  "MANIT Bhopal",
  "Barkatullah University",
  "RGPV",
  "LNCT",
  "Oriental College",
  "SAGE University Bhopal",
  "People's University",
  "IES College",
  "BSSS College",
  "Career College"
];

export function normalizeBhopalProperty(payload) {
  return {
    ...payload,
    city: BHOPAL_CITY,
    state: BHOPAL_STATE,
    nearbyColleges: Array.isArray(payload.nearbyColleges)
      ? payload.nearbyColleges
      : String(payload.nearbyColleges || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
  };
}
