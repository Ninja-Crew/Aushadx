import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { GoogleGenAI } from "@google/genai";

console.log("Imports successful");
const schema = z.object({ name: z.string() });
console.log("Zod schema created");
const json = zodToJsonSchema(schema);
console.log("JSON Schema:", JSON.stringify(json));
