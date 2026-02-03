import llmClient from "../services/llmClient.js";
import logger from "../config/logger.js";
import env from "../config/env.js";

const medicineSchema = {
  type: "object",
  properties: {
    drug_name: { type: "string" },
    indications: { type: "array", items: { type: "string" } },
    recommended_dosage: {
      type: "object",
      properties: {
        amount: { type: "number" },
        unit: { type: "string" },
        notes: { type: "string" },
      },
    },
    typical_dosage_range: { type: "string" },
    side_effects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          likelihood: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    interactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          substance: { type: "string" },
          severity: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    contraindications: { type: "array", items: { type: "string" } },
    risks_of_wrong_dosage: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["low", "medium", "high"] },
        rationale: { type: "string" },
      },
    },
    references: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          context_index: { type: "number" },
        },
      },
    },
  },
};

function buildPrompt(user_data, medicalHistory) {
  const userDesc = medicalHistory
    ? `Patient medical history:\n${medicalHistory}\n\nOCR text:\n${user_data.ocr_text || user_data.text}`
    : `OCR text:\n${user_data.ocr_text || user_data.text}`;

  const q = `Analyze the medicine information from the OCR text and evaluate side effects, correct dosage, risks of wrong dosage, contraindications, and interactions with the patient's medical history.`;

  // Instruction asks for machine-readable JSON with specific fields
  return [
    `You are a clinical assistant. Use ONLY the provided contexts to answer. Do NOT hallucinate facts outside the contexts unless asked; explicitly state when information is missing or uncertain.`,
    `Patient input:\n${userDesc}\n\n`,
    `Task: ${q}\n\n`,
    `Output format: Provide a single valid JSON object only (no surrounding explanatory text) that conforms to the provided schema.`,
    `If a value is unknown, use null or an empty array.`,
    `Respond now with the JSON object.`,
  ].join("\n");
}

export async function analyze(req, res) {
  const { medicine_data } = req.body || {};
  const user_id = req.params.user_id;

  if (!medicine_data) {
    return res.status(400).json({ error: "medicine_data is required" });
  }

  try {
    logger.info("Performing Gemini-based medicine label analysis");

    const incomingAuth =
      req.headers && (req.headers.authorization || req.headers.Authorization);
    const propagateHeaders =
      incomingAuth && env.PROPAGATE_AUTH
        ? { Authorization: incomingAuth }
        : undefined;

    let medicalHistory = null;
    if (env.PROFILE_SERVICE_URL && user_id) {
      try {
        const profileRes = await fetch(
          `${env.PROFILE_SERVICE_URL.replace(/\/$/, "")}/profile/${user_id}/medical-info`,
          {
            method: "GET",
            headers: Object.assign(
              { "Content-Type": "application/json" },
              propagateHeaders || {},
            ),
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

    const prompt = buildPrompt(medicine_data, medicalHistory);

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
