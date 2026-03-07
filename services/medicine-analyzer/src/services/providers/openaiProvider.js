import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import env from "../../config/env.js";
import logger from "../../config/logger.js";

const MAX_RETRIES = 3;

/**
 * Calls OpenAI with Structured Outputs based on a Zod schema.
 * @param {string} prompt - The prompt for the LLM.
 * @param {z.ZodSchema} zodSchema - The expected output schema.
 * @param {number} retries - Number of retries left.
 * @returns {Promise<any>} - The parsed JSON object matching the schema.
 */
export async function callStructured(prompt, zodSchema, retries = MAX_RETRIES) {
  if (!env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set in environment");
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const modelName = env.LLM_MODEL || "gpt-4o-mini";

  for (let i = 0; i < retries; i++) {
    try {
      const response = await openai.responses.parse({
      model: "gpt-4o-2024-08-06",
      input: [
        {
          role: "system",
          content: "Extract structured medicine information."
        },
        {
          role: "user",
          content: buildPrompt(user_data, medicalInfo, ragContext)
        }
      ],
      text: {
        format: zodTextFormat(medicineSchema, "medicine")
      }
    });

    const medicine = response.output_parsed;
    return medicine;
    } catch (e) {
      logger.error(`OpenAI attempt ${i + 1} failed`, e.message);
      if (i === retries - 1) {
        throw e;
      }
      // Optional: Add small delay before retry
      await new Promise(res => setTimeout(res, 1000));
    }
  }
}

export default { callStructured };
