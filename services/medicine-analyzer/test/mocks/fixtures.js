export const analyzeInput = {
  medicine_data: {
    text: "Aspirin 100mg",
  },
};

export const successfulAnalysis = {
  is_medicine_label: true,
  drug_name: "Mock Drug",
  recommendations: ["Take with water"],
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
