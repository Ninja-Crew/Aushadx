import logger from "../config/logger.js";
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import env from "../config/env.js";

if(!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
}

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });


const generationConfig = {
  temperature: 0.3,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
  responseMimeType: "application/json",
};



const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

async function callGeminiStructured(prompt, zodSchema,retries=3) {
  if (process.env.MOCK_LLM === 'true') {
    logger.info("[MOCK] Returning mock LLM response");
    return {
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
      references: []
    };
  }

  const jsonSchema = zodToJsonSchema(zodSchema);
  // console.log("DEBUG: Generated JSON Schema:", JSON.stringify(jsonSchema, null, 2));
  try {
    const fs = await import('fs');
    fs.writeFileSync('schema_debug.json', JSON.stringify(jsonSchema, null, 2));
  } catch (e) {
    logger.error("Failed to write schema debug file", e);
  }

  // const models = await client.models.list();
  // console.log(JSON.stringify(models, null, 2));
  let response;
  let error;
  for(let i=0;i<retries;i++){ 
    try{
      response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          ...generationConfig,
          responseSchema: jsonSchema
        }
    });

      /* console.log("DEBUG: Full Response keys:", Object.keys(response)); */
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
          logger.error("DEBUG: Unexpected response structure:", JSON.stringify(response, null, 2));
          throw new Error("No text found in LLM response");
      }
      const result=JSON.parse(text);
      return result;
    }catch(e){
      logger.error("Error calling Gemini", e);
      error=e;  
    }
  }
  throw error;
}

export default { callGeminiStructured };
