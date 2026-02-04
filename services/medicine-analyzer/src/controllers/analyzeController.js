import llmClient from "../services/llmClient.js";
import logger from "../config/logger.js";
import env from "../config/env.js";
import ragClient from "../services/ragClient.js";

import { z } from "zod";

const medicineSchema = z.object({
  drug_name: z.string().describe("Name of the medicine"),
  indications: z.array(z.string()).describe("Symptoms or conditions this medicine treats"),
  recommended_dosage: z.object({
    amount: z.number().nullable().describe("Numerical amount"),
    unit: z.string().nullable().describe("Unit (mg, ml, etc)"),
    notes: z.string().describe("Dosage instructions")
  }).describe("Recommended dosage information"),
  typical_dosage_range: z.string().describe("Typical dosage range string"),
  side_effects: z.array(z.object({
    name: z.string(),
    likelihood: z.string(),
    notes: z.string()
  })).describe("Potential side effects"),
  interactions: z.array(z.object({
    substance: z.string(),
    severity: z.string(),
    notes: z.string()
  })).describe("Interactions within food or other drugs"),
  contraindications: z.array(z.string()).describe("Conditions where this medicine should not be used"),
  risks_of_wrong_dosage: z.array(z.string()).describe("Risks associated with incorrect dosage"),
  recommendations: z.array(z.string()).describe("General recommendations or warnings"),
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    rationale: z.string()
  }).describe("Confidence in the analysis"),
  references: z.array(z.object({
    source: z.string(),
    context_index: z.number()
  })).describe("References to RAG context used")
});

function buildPrompt(user_data, medicalHistory, ragContext) {
  let contextSection = "";

  if (ragContext && ragContext.length > 0) {
    contextSection = `
Retrieved Medical Knowledge (RAG Details):
${ragContext.map(r => `- ${r.text}`).join("\n")}
`;
  }

  const userDesc = medicalHistory
    ? `Patient medical history:
${medicalHistory}

OCR text:
${user_data.ocr_text || user_data.text}`
    : `OCR text:
${user_data.ocr_text || user_data.text}`;

  return `
You are a clinical assistant.

Use retrieved medical knowledge when it is relevant and reliable.

If the retrieved context is irrelevant, incomplete, or insufficient,
you may rely on general medical knowledge.

Do NOT fabricate facts.
If information cannot be determined:
- Return empty arrays for array fields
- Return null for nullable fields
- Return empty strings where appropriate

Clearly reflect uncertainty in the "confidence" field.

${contextSection}

Patient Input:
${userDesc}

TASK:
Extract structured information about the medicine strictly using the following schema field names:

- drug_name
- indications
- recommended_dosage (object with amount, unit, notes)
- typical_dosage_range
- side_effects
- interactions
- contraindications
- risks_of_wrong_dosage
- recommendations
- confidence (object with level and rationale)
- references

If the OCR text indicates "FOR VETERINARY USE ONLY" and the patient is human,
reflect this appropriately in:
- contraindications
- recommendations
- confidence rationale

IMPORTANT OUTPUT RULES:

You must return ONLY valid JSON.
The JSON keys MUST exactly match the schema field names above.
Do not rename fields.
Do not add new fields.
Do not omit required fields.

Return nothing except the JSON object.
`;
}


export async function analyze(req, res) {
  const { medicine_data } = req.body || {};
  const user_id = req.params.user_id;

  if (!medicine_data) {
    return res.status(400).json({ error: "medicine_data is required" });
  }

  try {
    logger.info("Performing Gemini-based medicine label analysis");

    let medicalHistory = null;
    if (env.PROFILE_SERVICE_URL && user_id) {
      try {
        const profileRes = await fetch(
          `${env.PROFILE_SERVICE_URL.replace(/\/$/, "")}/profile/${user_id}/medical-info`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (profileRes.ok) {
          const profileBody = await profileRes.json();
          const profile = profileBody;
          if (profile && profile.status === true) {
            medicalHistory = profile.data.medical_info.medical_history;
          } else {
            throw new Error("Unsuccessful response from profile service");
          }
        }
      } catch (err) {
        logger.debug(
          "Failed to fetch profile from profile-service",
          err.message || err,
        );
        res.status(500).json({ status: false, message: err.message });
      }
    }

    // RAG Retrieval
    let ragResults = [];
    try {
        const queryText = medicine_data.ocr_text || medicine_data.text;
        if (queryText) {
            logger.info("Querying RAG for context");
            ragResults = await ragClient.search(queryText);
        }
    } catch (err) {
        logger.warn("RAG retrieval failed, proceeding without it", err);
    }

    const prompt = buildPrompt(medicine_data, medicalHistory, ragResults);

    logger.info("Calling Gemini with structured output for medicine analysis");
    const analysis = await llmClient.callGeminiStructured(
      prompt,
      medicineSchema,
    );

    return res.json({
      success: true,
      analysis,
    });
  } catch (err) {
    logger.error("Medicine analysis generation error", err);
    return res.status(500).json({ error: err.message });
  }
}

export default { analyze };
