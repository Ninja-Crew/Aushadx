import { z } from "zod";

export const medicineSchema = z.object({
  drug_name: z.string().nullable(),
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

Your job is to extract structured medicine information from OCR text.

Follow these rules strictly.

----------------------
GENERAL RULES
----------------------

1. Use retrieved medical knowledge if it is relevant.
2. If RAG context is insufficient, rely on general pharmacology knowledge.
3. Never fabricate unknown facts.
4. If a value cannot be determined:
   - Use empty array [] for arrays
   - Use null for nullable fields
   - Use "" for strings if unknown
5. Numbers must be real numbers (not strings).
6. Only include references that correspond to provided RAG context indices.

${contextSection}

----------------------
PATIENT INFORMATION
----------------------

Medical Info:
${medicalInfo || "None provided"}

----------------------
MEDICINE LABEL OCR
----------------------

${user_data.ocr_text || user_data.text}

----------------------
SPECIAL SAFETY RULE
----------------------

If the label indicates **"FOR VETERINARY USE ONLY"** and the patient is human:

- Add this warning in contraindications
- Add clear warning in recommendations
- Mention the issue in confidence.rationale

----------------------
OUTPUT REQUIREMENTS
----------------------

Return ONLY a valid JSON object.

The JSON MUST strictly match this structure:

{
  "drug_name": "string",

  "indications": ["string"],

  "recommended_dosage": {
    "amount": number | null,
    "unit": "string" | null,
    "notes": "string"
  },

  "typical_dosage_range": "string",

  "side_effects": [
    "string"
  ],

  "interactions": [
    {
      "substance": "string",
      "severity": "string",
      "notes": "string"
    }
  ],

  "contraindications": ["string"],

  "risks_of_wrong_dosage": ["string"],

  "recommendations": ["string"],

  "confidence": {
    "level": "low | medium | high",
    "rationale": "string"
  },

  "references": [
    {
      "source": "string",
      "context_index": number
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
