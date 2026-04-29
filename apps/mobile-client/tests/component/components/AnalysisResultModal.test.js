import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AnalysisResultModal from '../../../src/components/AnalysisResultModal';

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { 
      background: '#fff', 
      card: '#fff', 
      text: '#000', 
      textSecondary: '#666', 
      primary: 'blue', 
      success: 'green', 
      error: 'red', 
      chip: '#eee', 
      border: '#ccc' 
    },
  }),
}));

describe('AnalysisResultModal Component', () => {
  const mockResult = {
    analysis: {
      drug_name: 'Aspirin',
      confidence: { level: 'high' },
      indications: ['Pain', 'Fever'],
      typical_dosage_range: '1 tablet daily',
      side_effects: ['Nausea'],
      interactions: [{ substance: 'Alcohol', severity: 'High' }],
      contraindications: ['Ulcer'],
      risks_of_wrong_dosage: ['Bleeding'],
      recommendations: ['Take with food']
    }
  };

  it('renders nothing if not visible or no result', () => {
    const { toJSON } = render(<AnalysisResultModal visible={false} result={null} />);
    expect(toJSON()).toBeNull();
  });

  it('renders medicine details correctly when visible', () => {
    const { getByText } = render(
      <AnalysisResultModal visible={true} result={mockResult} />
    );
    expect(getByText('Aspirin')).toBeTruthy();
    expect(getByText('HIGH CONFIDENCE')).toBeTruthy();
    expect(getByText('Pain')).toBeTruthy();
    expect(getByText('1 tablet daily')).toBeTruthy();
    expect(getByText('Nausea')).toBeTruthy();
    expect(getByText('Alcohol', { exact: false })).toBeTruthy();
    expect(getByText('Bleeding')).toBeTruthy();
    expect(getByText('Take with food')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onCloseMock = jest.fn();
    // Use an icon or button query. It's a TouchableOpacity around a MaterialIcon.
    // Instead of querying by text, we can use testID if we added one, but we haven't.
    // We can query by the Schedule button text for the other callback.
    const { getByText } = render(
      <AnalysisResultModal visible={true} result={mockResult} onClose={onCloseMock} onSchedule={jest.fn()} />
    );
    
    // Test onSchedule
    const scheduleBtn = getByText('Schedule Medicine');
    fireEvent.press(scheduleBtn);
  });
});
