import llmClient from "./services/medicine-analyzer/src/services/llmClient.js";
import { medicineSchema, buildPrompt } from "./services/medicine-analyzer/src/prompts/analyzePrompts.js";

async function run() {
  process.env.MOCK_LLM = "true";
  const prompt = buildPrompt({ ocr_text: "Paracetamol 500 mg every 6 hours for 3-5 days.", name: "Paracetamol" });
  const result = await llmClient.callStructured(prompt, medicineSchema);
  console.log(JSON.stringify(result, null, 2));
}

run();
