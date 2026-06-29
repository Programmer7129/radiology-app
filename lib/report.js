// Shared (client + server safe) report helpers: canonical sections, the
// precomputed sample report for the instant demo, and a normalizer that turns
// raw model output into clean, ordered, display-ready sections.

// The five anatomical sections CheXagent reports on, in clinical reading order,
// each with a short display label and a one-line description of what it covers.
export const SECTIONS = [
  { id: "Airway",     label: "Airway",      blurb: "Trachea, hila, bronchi" },
  { id: "Breathing",  label: "Breathing",   blurb: "Lungs, pleura, pneumothorax" },
  { id: "Cardiac",    label: "Cardiac",     blurb: "Heart size & contour" },
  { id: "Diaphragm",  label: "Diaphragm",   blurb: "Costophrenic angles" },
  { id: "Everything", label: "Everything else", blurb: "Mediastinum, bones, soft tissue, lines & devices" },
];

function clean(text) {
  return String(text || "").replace(/\*\*/g, "").trim();
}

// Map a raw { section_by_section: {...} } object to an ordered array
// [{ id, label, blurb, text }] regardless of the model's verbose key names.
export function normalizeSections(sectionBySection = {}) {
  const entries = Object.entries(sectionBySection);
  return SECTIONS.map((s) => {
    const match = entries.find(([k]) =>
      k.toLowerCase().startsWith(s.id.toLowerCase())
    );
    return { ...s, text: match ? clean(match[1]) : "" };
  });
}

// Precomputed result for public/sample-cxr.jpg — lets the demo return an instant,
// impressive report with zero cost and zero cold-start wait.
export const SAMPLE_REPORT = {
  section_by_section: {
    Airway: "The hilar contours are normal.",
    Breathing: "The lungs are clear. There is no pneumothorax.",
    Cardiac: "The heart size is normal.",
    Diaphragm: "There is minimal blunting of the left costophrenic angle.",
    "Everything else (mediastinal contours, bones, soft tissues, tubes, valves, and pacemakers)":
      "The mediastinal contours are normal.",
  },
  summary: "No acute cardiopulmonary process.",
};

export const SAMPLE_IMAGE = "/sample-cxr.jpg";
