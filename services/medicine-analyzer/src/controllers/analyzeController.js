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

    // ── Fetch patient medical info ────────────────────────────────────────
    let medicalInfo = null;
    if (env.PROFILE_SERVICE_URL && user_id) {
      try {
        const profileRes = await fetch(
          `${env.PROFILE_SERVICE_URL.replace(/\/$/, "")}/profile/medical-info/${user_id}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        if (profileRes.ok) {
          const profileBody = await profileRes.json();
          if (profileBody?.success === true) {
            medicalInfo = profileBody.data?.profile?.medicalInfo || null;
            logger.info({ message: "Profile retrieved", hasMedicalInfo: !!medicalInfo });
          } else {
            logger.warn("Unsuccessful profile response", profileBody);
          }
        } else {
          logger.warn(`Profile service returned status: ${profileRes.status}`);
        }
      } catch (err) {
        logger.warn("Error fetching profile", err.message || err);
      }
    }

    // ── RAG retrieval ────────────────────────────────────────────────────
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

    // ── LLM call ─────────────────────────────────────────────────────────
    const prompt = buildPrompt(medicine_data, medicalInfo, ragResults);
    logger.info("Calling LLM with structured output for medicine analysis");

    const result = await llmClient.callStructured(prompt, medicineSchema);

    // ── Validate: must be a recognisable medicine input ──────────────────
    if (!result.is_medicine_label || result.medicines.length === 0) {
      return res.status(422).json({
        error: "NOT_MEDICINE_LABEL",
        message:
          "The image does not appear to contain a medicine label or prescription. Please try again with a clearer photo.",
      });
    }

    logger.info(
      `Analysis complete — input_type: ${result.input_type}, medicines found: ${result.medicines.length}`
    );

    // ── Return: preserve backward-compat shape for single-medicine clients
    // ── while exposing the full multi-medicine array ──────────────────────
    return res.json({
      success: true,
      input_type: result.input_type,
      // Legacy single-analysis field (first medicine) for backward compat
      analysis: result.medicines[0],
      // Full list for multi-medicine prescriptions
      medicines: result.medicines,
      count: result.medicines.length,
    });
  } catch (err) {
    logger.error("Medicine analysis generation error", err);
    return res.status(500).json({ error: err.message });
  }
}

export default { analyze };
