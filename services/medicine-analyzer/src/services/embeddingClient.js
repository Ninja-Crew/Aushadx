import { GoogleGenAI } from "@google/genai";
import env from "../config/env.js";

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

async function embedText(text) {
  const result = await client.models.embedContent({
    model: "text-embedding-004",
    contents: [text],   // ✅ MUST be array
  });

  return result.embeddings[0].values;
}

export default { embedText };
