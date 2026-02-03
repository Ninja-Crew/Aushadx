import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import env from "../config/env.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

async function embedText(text) {
  const model = genAI.getGenerativeModel({
    model: "gemini-embedding-001",
  });

  const result = await model.embedContent(text);
  const embedding = result.embedding;
  return embedding.values;
}

export default { embedText };
