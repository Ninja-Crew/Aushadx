import { z } from "zod";

// Schema for a single medicine extracted from the input
export const singleMedicineSchema = z.object({
  drug_name: z.string(),
  indications: z.array(z.string()).default([]),
  recommended_dosage: z.object({
    amount: z.number().nullable(),
    unit: z.string().nullable(),
    notes: z.string().nullable()
  }).nullable(),
  typical_dosage_range: z.string().nullable(),
  side_effects: z.array(z.string()).default([]),
  interactions: z.array(z.object({
    substance: z.string(),
    severity: z.string(),
    notes: z.string().nullable()
  })).default([]),
  contraindications: z.array(z.string()).default([]),
  risks_of_wrong_dosage: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  confidence: z.object({
    level: z.enum(["high", "medium", "low"]),
    rationale: z.string().nullable()
  }).nullable(),
  references: z.array(z.string()).default([])
});

// Top-level response schema
export const medicineSchema = z.object({
  // What type of input was detected
  input_type: z.enum(["prescription", "medicine_label", "unknown"]),

  // Whether the input contains any recognisable medicine content at all
  is_medicine_label: z.boolean(),

  // One entry per distinct medicine found.
  // A prescription may have several lines; a medicine_label is ALWAYS exactly one.
  medicines: z.array(singleMedicineSchema).default([])
});

export function buildPrompt(user_data, medicalInfo = null, ragContext = null) {

  let contextSection = "";

  if (ragContext && ragContext.length > 0) {
    contextSection = `
Retrieved Medical Knowledge (RAG Context):
${ragContext.map((r, i) => `[${i}] ${r.text}`).join("\n")}
`;
  }

  return `
You are a clinical medicine information extraction assistant.

Your job is to extract structured medicine information from OCR text or a plain text medicine name.

Follow these rules strictly.

----------------------
STEP 1 — CLASSIFY THE INPUT
----------------------

First, decide what kind of input you have received:

A) "prescription"  — A document written/printed by a doctor listing multiple medicines,
   dosages and instructions for a patient. Typical markers: patient name, doctor name/signature,
   Rx symbol, multiple medicine lines with quantities.

B) "medicine_label" — Packaging, box, or blister text for a SINGLE product (e.g. "Aspirin 500mg
   Tablets"). The brand name and the active ingredient/formula printed underneath are the SAME
   medicine — do NOT create two separate entries for them.

C) "unknown" — Plain text that does not clearly match A or B (e.g. a general question or
   random text). Set is_medicine_label to false and return an empty medicines array.

Set "input_type" to the appropriate value.
Set "is_medicine_label" to true for types A and B, false for C.

----------------------
STEP 2 — EXTRACT MEDICINES
----------------------

• For a "medicine_label" input: return EXACTLY ONE entry in the medicines array.
  The drug_name must be the primary brand/generic name of the product.
  Do NOT create a second entry for the active ingredient formula printed under the brand name.

• For a "prescription" input: return ONE entry per distinct medicine line.
  Each line with a different medicine name gets its own entry.

• For "unknown" input: return an empty medicines array [].

----------------------
STEP 3 — FILL EACH MEDICINE ENTRY
----------------------

For each medicine:

1. drug_name: The primary recognised medicine name (brand or generic). Never use a chemical
   formula (e.g. "C₉H₈O₄") as the drug_name — if only a formula is visible, attempt to
   resolve it to its generic name.

2. typical_dosage_range: ALWAYS populate this field if you have any pharmacological knowledge
   about the medicine, even if the label does not state it. Format as a concise clinical string,
   e.g. "325–650 mg every 4–6 hours (max 4 g/day)". If you truly have no knowledge, set null.

3. recommendations: ALWAYS include the following disclaimer as the LAST item in this array
   (add it even if there are no other recommendations):
   "Always consult a licensed doctor or pharmacist before starting, stopping, or changing any medicine dosage."

4. Use retrieved medical knowledge if it is relevant. If RAG context is insufficient, rely on
   general pharmacology knowledge. Never fabricate facts.

5. If a value cannot be determined:
   - Use empty array [] for arrays
   - Use null for nullable fields
   - Use "" for strings if unknown

6. Numbers must be real numbers (not strings).

7. Only include references that correspond to provided RAG context indices.

${contextSection}

----------------------
PATIENT INFORMATION
----------------------

Medical Info:
${medicalInfo || "None provided"}

----------------------
MEDICINE LABEL / PRESCRIPTION OCR
----------------------

${user_data.ocr_text || user_data.text}

----------------------
SPECIAL SAFETY RULE
----------------------

If any label indicates "FOR VETERINARY USE ONLY" and the patient is human:
- Add a warning in that medicine's contraindications
- Add a warning in that medicine's recommendations
- Mention the issue in confidence.rationale

----------------------
OUTPUT REQUIREMENTS
----------------------

Return ONLY a valid JSON object matching this exact structure:

{
  "input_type": "prescription" | "medicine_label" | "unknown",

  "is_medicine_label": true | false,

  "medicines": [
    {
      "drug_name": "string",

      "indications": ["string"],

      "recommended_dosage": {
        "amount": number | null,
        "unit": "string" | null,
        "notes": "string" | null
      },

      "typical_dosage_range": "string | null",

      "side_effects": ["string"],

      "interactions": [
        {
          "substance": "string",
          "severity": "string",
          "notes": "string | null"
        }
      ],

      "contraindications": ["string"],

      "risks_of_wrong_dosage": ["string"],

      "recommendations": ["string"],

      "confidence": {
        "level": "low | medium | high",
        "rationale": "string | null"
      },

      "references": ["string"]
    }
  ]
}

----------------------
STRICT OUTPUT RULES
----------------------

- Return ONLY JSON
- No markdown
- No explanations
- No comments
- No additional text
- Do not rename fields
- Do not add fields
- Do not omit fields
- Ensure valid JSON syntax

Return the JSON object now.
`;
}
