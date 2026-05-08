import llmClient from "../services/llmClient.js";
import logger from "../config/logger.js";
import env from "../config/env.js";
import ragClient from "../services/ragClient.js";
import { medicineSchema, buildPrompt, medicineListSchema, buildMedicineExtractionPrompt } from "../prompts/analyzePrompts.js";




export async function analyze(req, res) {
  const { medicine_data } = req.body || {};
  const user_id = req.params.user_id;

  if (!medicine_data) {
    return res.status(400).json({ error: "medicine_data is required" });
  }

  try {
    logger.info("Performing Gemini-based medicine label analysis");

    let profilePromise = Promise.resolve(null);
    if (env.PROFILE_SERVICE_URL && user_id) {
      profilePromise = (async () => {
        try {
          const profileRes = await fetch(
            `${env.PROFILE_SERVICE_URL.replace(/\/$/, "")}/profile/medical-info/${user_id}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            },
          );
          if (profileRes.ok) {
            const profileBody = await profileRes.json();
            if (profileBody && profileBody.success === true) {
              const info = profileBody.data.profile.medicalInfo || null;
              logger.info({ 
                message: "Profile retrieved from profile-service", 
                hasMedicalInfo: !!info
              });
              return info;
            } else {
              logger.warn("Unsuccessful response body from profile service", profileBody);
            }
          } else {
            logger.warn(`Profile service returned non-OK status: ${profileRes.status}`);
          }
        } catch (err) {
          logger.warn(
            "Error while fetching profile from profile-service",
            err.message || err,
          );
        }
        return null;
      })();
    }

    // Stage 1: Extract list of medicines
    const rawText = medicine_data.ocr_text || medicine_data.text;
    const imageBase64 = medicine_data.image || null;

    if (!rawText && !imageBase64) {
      return res.status(400).json({ error: "No text or image provided in medicine_data" });
    }

    logger.info("Stage 1: Extracting medicine list from OCR text/image");
    const extractionPrompt = buildMedicineExtractionPrompt(rawText || "No text provided.");
    const extractionResult = await llmClient.callStructured(
      extractionPrompt,
      medicineListSchema,
      { image: imageBase64 }
    );


    if (extractionResult.category === -1 || !extractionResult.medicines || extractionResult.medicines.length === 0) {
      return res.status(422).json({
        error: "NOT_MEDICINE_LABEL",
        message: "The image does not appear to be of a prescription or a medicine label. Please try again with a clearer photo.",
      });
    }

    if (extractionResult.category === 1 && extractionResult.medicines.length > 0) {
      // Medicine label: only keep the first medicine identified
      extractionResult.medicines = [extractionResult.medicines[0]];
    }

    // Stage 2: Analyze each extracted medicine in parallel pipelines
    logger.info(`Stage 2: Analyzing ${extractionResult.medicines.length} extracted medicines`);
    
    const medicalInfo = await profilePromise;

    const pipelinePromises = extractionResult.medicines.map(async (medicine) => {
      // 1. RAG Context obtaining
      let ragResults = [];
      try {
          logger.info(`Analyzing ${medicine.medicine_name}`);
          const queryText = `${medicine.medicine_name} ${medicine.context_text}`;
          logger.info(`Querying RAG for context: ${medicine.medicine_name}`);
          ragResults = await ragClient.search(queryText);
      } catch (err) {
          logger.warn(`RAG retrieval failed for ${medicine.medicine_name}, proceeding without it`, err);
      }

      // 2. Prompt Ingestion
      const specificMedicineData = {
        ...medicine,
        ocr_text: medicine.context_text,
        name: medicine.medicine_name
      };
      const prompt = buildPrompt(specificMedicineData, medicalInfo, ragResults);

      // 3. Gemini calling and medicine object creation
      logger.info(`Calling LLM for detailed analysis of: ${medicine.medicine_name}`);
      const analysis = await llmClient.callStructured(
        prompt,
        medicineSchema,
        { image: imageBase64 }
      );
      
      // 4. Refinement
      if (!analysis.drug_name) {
        analysis.drug_name = medicine.medicine_name;
      }
      
      return analysis;
    });

    const analyses = await Promise.all(pipelinePromises);
    
    // Filter out any analyses that the second stage deemed completely non-medicine
    const validAnalyses = analyses.filter(a => a.category !== -1).map(a => ({
      ...a,
      is_medicine_label: true
    }));

    if (validAnalyses.length === 0) {
      return res.status(422).json({
        error: "NOT_MEDICINE_LABEL",
        message: "After detailed analysis, the text does not appear to contain valid medicine labels.",
      });
    }

    return res.json({
      success: true,
      analyses: validAnalyses,
    });
  } catch (err) {
    logger.error("Medicine analysis generation error", err);
    return res.status(500).json({ error: err.message });
  }
}

export default { analyze };
