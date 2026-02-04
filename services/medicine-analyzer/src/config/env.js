import "dotenv/config"

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? Number(process.env.PORT) : 5000,
  EMBEDDING_API_URL: process.env.EMBEDDING_API_URL || "",
  LLM_API_URL: process.env.LLM_API_URL || "",
  INDEX_DB_URL: process.env.INDEX_DB_URL || "",
  PROFILE_SERVICE_URL: process.env.PROFILE_SERVICE_URL || "",
  PROPAGATE_AUTH: process.env.PROPAGATE_AUTH === "true" || false,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  PINECONE_API_KEY: process.env.PINECONE_API_KEY || "",
  PINECONE_INDEX: process.env.PINECONE_INDEX || "",
};


export default env;
