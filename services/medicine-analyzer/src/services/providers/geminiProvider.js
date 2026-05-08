import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import env from "../../config/env.js";
import logger from "../../config/logger.js";

const MAX_RETRIES = 3;

/**
 * Calls Gemini with Structured Outputs based on a Zod schema.
 * @param {string} prompt - The prompt for the LLM.
 * @param {z.ZodSchema} zodSchema - The expected output schema.
 * @param {object} options - Options including image.
 * @param {number} retries - Number of retries left.
 * @returns {Promise<any>} - The parsed JSON object matching the schema.
 */
export async function callStructured(prompt, zodSchema, options = {}, retries = MAX_RETRIES) {
  let ai;
  if (env.GEMINI_PROVIDER === "vertexai") {
    if (!env.VERTEX_PROJECT || !env.VERTEX_LOCATION) {
      logger.error("VERTEX_PROJECT or VERTEX_LOCATION is missing for vertexai provider");
      throw new Error("Missing Vertex AI config");
    }
    ai = new GoogleGenAI({
      vertexai: true,
      project: env.VERTEX_PROJECT,
      location: env.VERTEX_LOCATION,
      // Explicitly load the mounted service-account key so ADC doesn't need
      // to fall back to env-var discovery (which can fail in Node.js containers)
      ...(env.GOOGLE_APPLICATION_CREDENTIALS && {
        googleAuthOptions: { keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS },
      }),
    });
  } else {
    if (!env.GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY is not set in environment");
      throw new Error("Missing GEMINI_API_KEY");
    }
    ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  const modelName = env.LLM_MODEL || "gemini-2.5-flash";

  const jsonSchema = zodToJsonSchema(zodSchema, "MySchema");
  let schemaToPass = jsonSchema.definitions?.MySchema || jsonSchema;
  delete schemaToPass.additionalProperties;
  delete schemaToPass.$schema;

  const parts = [{ text: prompt }];
  if (options.image) {
    parts.push({
      inlineData: {
        data: options.image,
        mimeType: "image/jpeg",
      },
    });
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: parts,
          },
        ],
        config: {
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schemaToPass,
            temperature: 0.2, // Lower temp for more deterministic structured output
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });

      // console.log("Raw Gemini response:", JSON.stringify(response, null, 2));

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No text found in LLM response");
      }
      // Vertex AI sometimes wraps the response in markdown code fences — strip them.
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (e) {
      logger.error(`Gemini attempt ${i + 1} failed`, e);
      if (i === retries - 1) {
        throw e;
      }
      // Optional: Add small delay before retry
      await new Promise(res => setTimeout(res, 1000));
    }
  }
}

export default { callStructured };
