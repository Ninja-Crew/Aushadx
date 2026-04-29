export const analyzeInput = {
  medicine_data: {
    text: "Aspirin 100mg",
    ocr_text: "Aspirin 100mg"
  },
};

export const successfulAnalysis = {
  input_type: "medicine_label",
  is_medicine_label: true,
  medicines: [
    {
      drug_name: "Mock Drug",
      indications: ["Pain relief"],
      recommended_dosage: {
        amount: 1,
        unit: "tablet",
        notes: "Take with water"
      },
      typical_dosage_range: "1-2 tablets every 4-6 hours",
      side_effects: ["Nausea"],
      interactions: [],
      contraindications: [],
      risks_of_wrong_dosage: [],
      recommendations: ["Consult a doctor"],
      confidence: {
        level: "high",
        rationale: "Clear text"
      },
      references: []
    }
  ]
};

export const profileResponse = {
  success: true,
  data: {
    profile: {
      medicalInfo: {
        allergies: ["penicillin"],
      },
    },
  },
};
