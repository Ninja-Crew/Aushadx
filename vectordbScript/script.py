import os
import time
import logging
import pandas as pd
from dotenv import load_dotenv
from tqdm import tqdm
import kagglehub
from kagglehub import KaggleDatasetAdapter
from pinecone import Pinecone, ServerlessSpec
from google import genai
from google.genai import types


# =========================================================
# CONFIG
# =========================================================

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX") or "medicine-knowledgebase"

if not GOOGLE_API_KEY or not PINECONE_API_KEY:
    raise ValueError("Missing API keys in .env file")

client = genai.Client(api_key=GOOGLE_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)

EMBEDDING_MODEL = "text-embedding-004"
OUTPUT_DIMENSION = 768 
BATCH_SIZE = 100
SLEEP_INTERVAL = 0.1

logging.basicConfig(level=logging.INFO)


# =========================================================
# DATA LOADING
# =========================================================

def load_dataset():
    import kagglehub
    import os
    import pandas as pd
    import csv

    path_usage = kagglehub.dataset_download(
        "shudhanshusingh/250k-medicines-usage-side-effects-and-substitutes"
    )


    usage_file = os.path.join(path_usage, "medicine_dataset.csv")


    df_usage = pd.read_csv(
        usage_file,
        encoding="latin1",
        engine="python",
        on_bad_lines="skip",
        quoting=csv.QUOTE_NONE
    )



    return df_usage




def normalize(df):
    df = df.copy()
    df["id"] = df["id"].astype(str).str.strip().str.lower()
    df["name"] = df["name"].astype(str).str.strip().str.lower()
    return df


def load_and_prepare():
    logging.info("Loading datasets...")

    df = load_dataset()
    df = normalize(df)  # Only use the 250k usage dataset

    print(f"Records before deduplication: {len(df)}")
    
    df.drop_duplicates(subset=["id"], inplace=True)
    print(f"Records after deduplication: {len(df)}")
    
    df.reset_index(drop=True, inplace=True)

    logging.info(f"Final dataset size: {len(df)}")
    return df


# =========================================================
# TEXT CLEANING + REPRESENTATION
# =========================================================

def clean(value):
    if pd.isna(value):
        return None
    value = str(value).strip()
    if value == "" or value.lower() == "none":
        return None
    return value


def create_text(row):
    parts = []

    # Fields with custom labels
    field_map = {
        "name": "Medicine Name",
        "type": "Type",
        "price(₹)": "Price",
        "pack_size_label": "Pack Size",
        "manufacturer_name": "Manufacturer",
        "Chemical Class": "Chemical Class",
        "Therapeutic Class": "Therapeutic Class",
        "Action Class": "Action Class",
        "Habit Forming": "Habit Forming",
    }

    # Add simple mapped fields
    for col, label in field_map.items():
        value = clean(row.get(col))
        if value:
            if col == "price(₹)":
                value = f"₹{value}"
            parts.append(f"{label}: {value}")

    # Active ingredients (explicit list)
    compositions = [
        clean(row.get("short_composition1")),
        clean(row.get("short_composition2"))
    ]
    compositions = [c for c in compositions if c]
    if compositions:
        parts.append("Active Ingredients: " + ", ".join(compositions))

    # Dynamic grouped columns
    prefix_groups = {
        "use": "Uses",
        "substitute": "Substitutes",
        "sideEffect": "Known Side Effects"
    }

    for prefix, label in prefix_groups.items():
        values = []
        for col in row.index:
            if col.startswith(prefix):
                val = clean(row[col])
                if val:
                    values.append(val)

        if values:
            parts.append(f"{label}: " + ", ".join(values))

    return "\n".join(parts)



# =========================================================
# PINECONE SETUP
# =========================================================

def setup_index():
    while not pc.describe_index(INDEX_NAME).status["ready"]:
        time.sleep(0.1)

    return pc.Index(INDEX_NAME)


# =========================================================
# EMBEDDING
# =========================================================

def generate_embeddings(texts):
    result = client.models.embed_content(
        model="text-embedding-004",   # or gemini-embedding-001
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=OUTPUT_DIMENSION
        )
    )

    return [embedding.values for embedding in result.embeddings]


# =========================================================
# MAIN PIPELINE
# =========================================================

def main():
    df = load_and_prepare()

    logging.info("Generating text representation...")
    df["embedding_text"] = df.apply(create_text, axis=1)

    index = setup_index()

    ids = df["id"].tolist()
    texts = df["embedding_text"].tolist()
    names = df["name"].tolist()

    logging.info("Starting embedding + upsert...")

    for i in tqdm(range(0, len(ids), BATCH_SIZE)):
        batch_ids = ids[i:i + BATCH_SIZE]
        batch_texts = texts[i:i + BATCH_SIZE]
        batch_names = names[i:i + BATCH_SIZE]

        try:
            embeddings = generate_embeddings(batch_texts)

            vectors = [
                {
                    "id": doc_id,
                    "values": vector,
                    "metadata": {"name": name, "text": text}
                }
                for doc_id, vector, name, text in zip(batch_ids, embeddings, batch_names, batch_texts)
            ]

            index.upsert(vectors=vectors)
            time.sleep(SLEEP_INTERVAL)

        except Exception as e:
            logging.error(f"Batch {i} failed: {e}")

    logging.info("Ingestion completed successfully.")


if __name__ == "__main__":
    main()
