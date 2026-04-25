import { z } from "zod";

export const medicineListSchema = z.object({
  is_medicine_related: z.boolean(),
  medicines: z.array(z.record(z.any())).default([])
});

export const medicineSchema = z.object({
  is_medicine_label: z.boolean(),
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
  references: z.array(z.string()).default([]),
  extracted_schedule: z.object({
    dosage: z.string().nullable(),
    frequency: z.enum([
      'ONCE',
      'DAILY',
      'X_TIMES_DAILY',
      'EVERY_X_HOURS',
      'EVERY_X_MINUTES',
      'SPECIFIC_WEEK_DAYS',
      'SPECIFIC_DAYS_OF_MONTH',
      'UNKNOWN'
    ]).nullable(),
    frequencyValue: z.number().nullable(),
    duration: z.enum([
      'SINGLE_DAY',
      'FOR_X_DAYS',
      'FOR_X_WEEKS',
      'FOR_X_MONTHS',
      'UNTIL_DATE',
      'CONTINUOUS',
      'UNKNOWN'
    ]).nullable(),
    durationValue: z.number().nullable()
  }).nullable()
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

1. First, determine if the provided text looks like it came from a real medicine label, package insert, or pharmaceutical product. Set \`is_medicine_label\` to \`true\` if so, otherwise \`false\`.
2. If \`is_medicine_label\` is \`false\`, you may return empty/null values for all other fields — do not attempt to extract medicine information from non-medicine text.
3. Use retrieved medical knowledge if it is relevant.
4. If RAG context is insufficient, rely on general pharmacology knowledge.
5. Never fabricate unknown facts.
6. If a value cannot be determined:
   - Use empty array [] for arrays
   - Use null for nullable fields
   - Use "" for strings if unknown
7. Numbers must be real numbers (not strings).
8. Only include references that correspond to provided RAG context indices.

${contextSection}

----------------------
PATIENT INFORMATION
----------------------

Medical Info:
${medicalInfo || "None provided"}

----------------------
MEDICINE SPECIFIC DATA (From OCR/Image)
----------------------

${JSON.stringify(user_data, null, 2)}

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
  "is_medicine_label": true | false,

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
  ],

  "extracted_schedule": {
    "dosage": "string (e.g. '1 tablet', '5ml') or null",
    "frequency": "enum value from [ONCE, DAILY, X_TIMES_DAILY, EVERY_X_HOURS, EVERY_X_MINUTES, SPECIFIC_WEEK_DAYS, SPECIFIC_DAYS_OF_MONTH, UNKNOWN] or null",
    "frequencyValue": "number or null",
    "duration": "enum value from [SINGLE_DAY, FOR_X_DAYS, FOR_X_WEEKS, FOR_X_MONTHS, UNTIL_DATE, CONTINUOUS, UNKNOWN] or null",
    "durationValue": "number or null"
  }
}

----------------------
SCHEDULING EXTRACTION RULES
----------------------
1. If the OCR or Image provides dosing instructions (e.g., "Take 1 pill every 6 hours for 5 days"):
   - Set "dosage" to the exact amount to take at one time (e.g., "1 pill"). Do NOT include the frequency or duration text here.
   - If it says "every X hours", MUST set frequency to "EVERY_X_HOURS" and frequencyValue to X (e.g. 6). Do NOT use "DAILY" or "X_TIMES_DAILY" for this.
   - If it says "X times a day", set frequency to "X_TIMES_DAILY" and frequencyValue to X.
   - If it says "once a day", set frequency to "DAILY".
   - Set "duration" appropriately (e.g., "FOR_X_DAYS") and "durationValue" to the max number (e.g., if "3-5 days", use 5).
2. Do NOT invent or include specific times of day.
3. If instructions are vague, use "UNKNOWN" or null where appropriate, but try to provide useful defaults.

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

export function buildMedicineExtractionPrompt(ocr_text) {
  return `
You are a clinical medicine extraction assistant.

Your job is to identify and extract a list of distinct medicines from the provided OCR text and the uploaded image (prescription or medicine label).

Follow these rules strictly.

----------------------
GENERAL RULES
----------------------
1. Determine if the provided text or image contains any references to medicines, drugs, or pharmaceutical products. If so, set \`is_medicine_related\` to \`true\`. If not, set it to \`false\`.
2. CRITICAL: The OCR text may be incomplete or contain errors, especially with handwritten doctor prescriptions. You must CAREFULLY EXAMINE the uploaded image alongside the OCR text.
3. If \`is_medicine_related\` is \`true\`, extract EVERY distinct medicine mentioned in both the OCR text and the image. If you spot a medicine in the image (like doctor handwriting) that the OCR missed, YOU MUST INCLUDE IT.
4. For each medicine, provide its \`medicine_name\` and a \`context_text\`.
5. The \`context_text\` should include the specific sentences, bullet points, handwritten notes, or sections from the original OCR text/image that refer to this medicine, including dosage, side effects, or instructions. This will be used in a later step to analyze the medicine in detail.

----------------------
MEDICINE LABEL OCR / IMAGE CONTEXT
----------------------

${ocr_text}

----------------------
OUTPUT REQUIREMENTS
----------------------

Return ONLY a valid JSON object.

The JSON MUST strictly match this structure:

{
  "is_medicine_related": true | false,
  "medicines": [
    {
      "medicine_name": "string",
      "context_text": "string"
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
- Ensure valid JSON syntax

Return the JSON object now.
`;
}
