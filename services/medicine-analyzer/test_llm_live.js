import "dotenv/config";
import llmClient from "./src/services/llmClient.js";
import { medicineSchema, buildPrompt } from "./src/prompts/analyzePrompts.js";

async function run() {
  const prompt = buildPrompt({ 
    ocr_text: "Paracetamol 500mg every 6hrs for 3-5 days.", 
    name: "Paracetamol" 
  });
  
  try {
    const result = await llmClient.callStructured(prompt, medicineSchema);
    console.log("SCHEDULE:");
    console.log(JSON.stringify(result.extracted_schedule, null, 2));
  } catch(e) {
    console.error(e);
  }
}

run();
