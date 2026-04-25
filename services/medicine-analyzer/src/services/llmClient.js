/**
 * LLM Client Factory
 *
 * Reads `LLM_PROVIDER` from env and delegates to the appropriate provider adapter.
 * Supported values: "gemini" (default), "openai"
 *
 * Every provider exports a single async function:
 *   callStructured(prompt, zodSchema, options, retries) → Promise<object>
 */

import logger from "../config/logger.js";
import env from "../config/env.js";

const MOCK_RESPONSE = {
  drug_name: "Mock Aspirin",
  indications: ["Headache", "Fever"],
  recommended_dosage: { amount: 500, unit: "mg", notes: "Take with water" },
  typical_dosage_range: "325-650mg every 4-6 hours",
  side_effects: [{ name: "Nausea", likelihood: "Common", notes: "" }],
  interactions: [],
  contraindications: [],
  risks_of_wrong_dosage: [],
  recommendations: ["Consult a doctor if symptoms persist"],
  confidence: { level: "high", rationale: "Mock data for testing" },
  references: [],
};

const PROVIDER_MAP = {
  gemini: () => import("./providers/geminiProvider.js"),
  openai: () => import("./providers/openaiProvider.js"),
};

async function getProvider() {
  const name = (env.LLM_PROVIDER || "gemini").toLowerCase();
  const loader = PROVIDER_MAP[name];
  if (!loader) {
    throw new Error(
      `Unknown LLM_PROVIDER "${name}". Supported values: ${Object.keys(PROVIDER_MAP).join(", ")}`
    );
  }
  const module = await loader();
  return module.default;
}

/**
 * Call the configured LLM with a Zod schema for structured output.
 * @param {string} prompt
 * @param {import("zod").ZodTypeAny} zodSchema
 * @param {object|number} [options={}] Options object (can contain image_base64, retries) or legacy retries number.
 * @returns {Promise<object>}
 */
async function callStructured(prompt, zodSchema, options = {}) {
  let retries = 3;
  let providerOptions = {};

  if (typeof options === 'number') {
    retries = options;
  } else if (options && typeof options === 'object') {
    retries = options.retries !== undefined ? options.retries : 3;
    providerOptions = options;
  }
  if (process.env.MOCK_LLM === "true") {
    logger.info("[MOCK] Returning mock LLM response");
    return MOCK_RESPONSE;
  }

  const provider = await getProvider();
  logger.info(`Using LLM provider: ${env.LLM_PROVIDER || "gemini"}`);
  return provider.callStructured(prompt, zodSchema, providerOptions, retries);
}

// Backwards-compatible alias
const callGeminiStructured = callStructured;

export default { callStructured, callGeminiStructured };
