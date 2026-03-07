import { Pinecone } from "@pinecone-database/pinecone";
import env from "../config/env.js";
import logger from "../config/logger.js";

let pinecone;
let index;
let namespace;

async function getIndex() {
  if (index) return index;
  if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX || !env.PINECONE_INDEX_HOST   || !env.PINECONE_NAMESPACE ) {
    logger.warn("Pinecone API key or index or host or namespace not configured. Skipping search.");
    return null;
  }
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  index = pinecone.index(env.PINECONE_INDEX, env.PINECONE_INDEX_HOST  );
  namespace = index.namespace(env.PINECONE_NAMESPACE);
  logger.info("Pinecone index and namespace configured.");
  return index;
}

async function search(query, top_k = 10) {
  try {
    const idx = await getIndex();
    if (!idx) return [];
  
    const results = await namespace.searchRecords({
      query:{
        topK: Number(top_k),
        inputs:{
          text: query
        }
      }
    });

    return (
      results.result.hits?.map((match) => ({
        text: match.fields?.text,
        score: match._score,
      })) || []
    );
  } catch (err) {
    logger.error("Error searching Pinecone index or embedding", err);
    return [];
  }
}

export default { search };
