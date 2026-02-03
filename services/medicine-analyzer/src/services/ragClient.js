import { Pinecone } from "@pinecone-database/pinecone";
import env from "../config/env.js";
import embeddingClient from "./embeddingClient.js";
import logger from "../config/logger.js";

let pinecone;
let index;

async function getIndex() {
  if (index) return index;
  if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
    logger.warn("Pinecone API key or index not configured. Skipping search.");
    return null;
  }
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  index = pinecone.index(env.PINECONE_INDEX);
  return index;
}

async function search(query, top_k = 10) {
  const idx = await getIndex();
  if (!idx) return [];

  const vector = await embeddingClient.embedText(query);

  try {
    const results = await idx.query({ vector, top_k, includeMetadata: true });
    return (
      results.matches?.map((match) => ({
        text: match.metadata?.text,
        score: match.score,
      })) || []
    );
  } catch (err) {
    logger.error("Error searching Pinecone index", err);
    return [];
  }
}

export default { search };
