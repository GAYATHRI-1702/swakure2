// Pure validation for prescription analysis. No Deno/Node specific APIs so it can be unit tested in Node.
//
// Core rule: a value is only stored if it can be found in the OCR transcript of the prescription.
// Anything the model adds that is not on the paper (guessed dosages, schedules, generic names) is dropped.

import type { ExtractionResult, ValidatedAnalysis, MedicineRow } from "./types.ts";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MIN_LEGIBILITY = 0.3;
export const MAX_MEDICINES = 25;

const PLACEHOLDERS = new Set([
  "", "-", "--", "?", "n/a", "na", "nil", "none", "null", "undefined", "unknown",
  "not specified", "not mentioned", "not given", "not available", "not provided", "unspecified",
]);

// Lowercase and drop everything except letters/digits (used for duplicate keys).
export function compact(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

// Split into word tokens, also between letters and digits, so "500mg" and "500 mg" both become "500 mg"
// and "1-0-1" becomes "1 0 1". Wrapped in spaces so matches respect word boundaries.
export function tokens(value: string): string {
  const t = value.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .trim();
  return ` ${t} `;
}

export function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  if (PLACEHOLDERS.has(v.toLowerCase())) return null;
  return v.length > maxLength ? null : v;
}

// True when the value appears in the transcript as whole words (ignoring case, spacing and punctuation).
// `transcriptTokens` must come from tokens(transcript).
export function foundInText(value: string, transcriptTokens: string): boolean {
  const v = tokens(value);
  return v.trim().length > 0 && transcriptTokens.includes(v);
}

function verified(value: unknown, transcriptTokens: string, maxLength = 200): string | null {
  const v = cleanText(value, maxLength);
  return v && foundInText(v, transcriptTokens) ? v : null;
}

// Quantity is only trusted when it is explicitly labelled, e.g. "Qty 60", "Qty: 10", "Quantity - 15".
function verifiedQuantity(value: unknown, transcriptTokens: string): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value >= 10000) return null;
  return / (qty|quantity) /.test(transcriptTokens) &&
      new RegExp(` (qty|quantity) ${value} `).test(transcriptTokens)
    ? value
    : null;
}

function clamp01(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

// File checks that run before any external service is called.
export function checkFile(
  file: { mimeType: string | null | undefined; size: number; bytes: Uint8Array },
): string | null {
  const mime = (file.mimeType ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return `Unsupported file type "${file.mimeType ?? "unknown"}". Please upload a JPG, PNG, WEBP, HEIC or PDF.`;
  }
  if (!file.size || file.bytes.length === 0) return "The uploaded file is empty.";
  if (file.size > MAX_FILE_BYTES || file.bytes.length > MAX_FILE_BYTES) return "The file is larger than 5MB.";
  if (!matchesSignature(mime, file.bytes)) return "The file content does not match its type. Please re-upload the prescription.";
  return null;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

export function matchesSignature(mime: string, bytes: Uint8Array): boolean {
  switch (mime) {
    case "image/jpeg": return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png": return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "application/pdf": return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/webp": return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "image/heic":
    case "image/heif": return startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    default: return false;
  }
}

// Validate the OCR step. Returns the cleaned transcript or an error message for the user.
export function checkTranscript(
  ocr: { raw_text?: unknown; legibility?: unknown },
): { text: string; legibility: number | null } | { error: string } {
  const text = typeof ocr.raw_text === "string" ? ocr.raw_text.trim().slice(0, 20000) : "";
  const legibility = clamp01(ocr.legibility);
  if (compact(text).length < 10) {
    return { error: "No readable text was found. Please upload a clearer, well-lit photo of the prescription." };
  }
  if (legibility !== null && legibility < MIN_LEGIBILITY) {
    return { error: "The prescription is too hard to read. Please upload a clearer, well-lit photo." };
  }
  return { text, legibility };
}

// Validate the structured extraction against the transcript.
export function validateExtraction(raw: ExtractionResult | null | undefined, transcript: string): ValidatedAnalysis {
  const t = tokens(transcript);
  const warnings: string[] = [];
  const medicines: MedicineRow[] = [];
  const seen = new Set<string>();
  const foodNotes: string[] = [];

  const list = Array.isArray(raw?.medicines) ? raw!.medicines : [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const name = cleanText(m.medicine_name, 100);
    if (!name) continue;
    if (!foundInText(name, t)) {
      warnings.push(`"${name}" could not be matched to the prescription text and was not saved. Please check the prescription.`);
      continue;
    }
    const strength = verified(m.strength, t, 60);
    const key = `${compact(name)}|${strength ? compact(strength) : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (medicines.length >= MAX_MEDICINES) {
      warnings.push(`More than ${MAX_MEDICINES} medicines were found; only the first ${MAX_MEDICINES} were saved.`);
      break;
    }

    const quantity = verifiedQuantity(m.quantity, t);

    medicines.push({
      medicine_name: name,
      generic_name: verified(m.generic_name, t, 100),
      strength,
      dosage: verified(m.dosage, t),
      frequency: verified(m.frequency, t),
      duration: verified(m.duration, t),
      route: verified(m.route, t, 60),
      quantity,
      confidence: clamp01(m.confidence),
    });

    const instructions = verified(m.instructions, t);
    if (instructions) foodNotes.push(`${name}: ${instructions}`);
  }

  const generalFood = verified(raw?.food_instructions, t, 500);
  if (generalFood) foodNotes.unshift(generalFood);

  const extraWarnings = Array.isArray(raw?.warnings)
    ? raw!.warnings.map((w) => verified(w, t, 300)).filter((w): w is string => Boolean(w))
    : [];

  return {
    doctor_name: verified(raw?.doctor_name, t, 120),
    hospital_name: verified(raw?.hospital_name, t, 160),
    diagnosis: verified(raw?.diagnosis, t, 300),
    food_instructions: foodNotes.length ? foodNotes.join("\n").slice(0, 2000) : null,
    follow_up_instructions: verified(raw?.follow_up_instructions, t, 500),
    // Prescription warnings (verbatim) plus notes about anything that was dropped during validation.
    warnings: [...extraWarnings, ...warnings],
    medicines,
  };
}
