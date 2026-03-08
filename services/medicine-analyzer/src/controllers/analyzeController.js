import llmClient from "../services/llmClient.js";
import logger from "../config/logger.js";
import env from "../config/env.js";
import ragClient from "../services/ragClient.js";
import { medicineSchema, buildPrompt } from "../prompts/analyzePrompts.js";




export async function analyze(req, res) {
  const { medicine_data } = req.body || {};
  const user_id = req.params.user_id;

  if (!medicine_data) {
    return res.status(400).json({ error: "medicine_data is required" });
  }

  try {
    logger.info("Performing Gemini-based medicine label analysis");

    let medicalInfo = null;
    if (env.PROFILE_SERVICE_URL && user_id) {
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
          const profile = profileBody;
          if (profile && profile.success === true) {
            medicalInfo = profile.data.profile.medicalInfo || null;
            logger.info({ 
              message: "Profile retrieved from profile-service", 
              hasMedicalInfo: !!medicalInfo
            });
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
    }

    // RAG Retrieval
    let ragResults = [];
    try {
        const queryText = medicine_data.ocr_text || medicine_data.text;
        if (queryText) {
            logger.info("Querying RAG for context");
            ragResults = await ragClient.search(queryText);
        }
    } catch (err) {
        logger.warn("RAG retrieval failed, proceeding without it", err);
    }

    const prompt = buildPrompt(medicine_data, medicalInfo, ragResults);

    logger.info("Calling LLM with structured output for medicine analysis");
    const analysis = await llmClient.callStructured(
      prompt,
      medicineSchema,
    );

    return res.json({
      success: true,
      analysis,
    });
  } catch (err) {
    logger.error("Medicine analysis generation error", err);
    return res.status(500).json({ error: err.message });
  }
}

export default { analyze };
