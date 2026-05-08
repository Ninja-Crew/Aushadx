export const analyzeInput = {
  medicine_data: {
    text: "Aspirin 100mg",
  },
};

export const multimodalInput = {
  medicine_data: {
    text: "Aspirin 100mg",
    image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  },
};

export const successfulExtraction = {
  is_medicine_related: true,
  medicines: [
    {
      medicine_name: "Mock Drug",
      context_text: "Aspirin 100mg"
    }
  ]
};

export const multiMedicineExtraction = {
  is_medicine_related: true,
  medicines: [
    { medicine_name: "Drug A", context_text: "Drug A 10mg" },
    { medicine_name: "Drug B", context_text: "Drug B 20mg" },
    { medicine_name: "Drug C", context_text: "Drug C 30mg" },
    { medicine_name: "Drug D", context_text: "Drug D 40mg" },
  ]
};

export const successfulAnalysis = {
  is_medicine_label: true,
  drug_name: "Mock Drug",
  recommendations: ["Take with water"],
  extracted_schedule: {
    dosage: "100mg",
    frequency: "DAILY",
    frequencyValue: null,
    duration: "CONTINUOUS",
    durationValue: null
  }
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
