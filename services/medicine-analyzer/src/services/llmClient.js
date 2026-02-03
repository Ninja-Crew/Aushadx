import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import env from "../config/env.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
  response_mime_type: "application/json",
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

async function callGeminiStructured(prompt, schema) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    generationConfig: { ...generationConfig, response_schema: schema },
    safetySettings,
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}

export default { callGeminiStructured };
