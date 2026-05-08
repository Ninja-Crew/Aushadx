import React, { useState, useRef } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';

const Tag = ({ label, color, bgColor }) => (
  <View style={[styles.tag, { backgroundColor: bgColor }]}>
    <Text style={[styles.tagText, { color }]}>{label}</Text>
  </View>
);

const Section = ({ icon, title, children, colors, helpText }) => {
  const [showHelp, setShowHelp] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ y: 0 });
  const iconRef = useRef(null);

  const handlePress = () => {
    if (iconRef.current) {
      iconRef.current.measure((x, y, width, height, pageX, pageY) => {
        setPopoverPos({ y: pageY + height });
        setShowHelp(true);
      });
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.chip, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialIcons name={icon} size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {helpText && (
          <TouchableOpacity ref={iconRef} onPress={handlePress} style={{ padding: 4 }}>
            <MaterialIcons name="help-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {showHelp && helpText && (
        <Modal transparent={true} animationType="fade" visible={showHelp} onRequestClose={() => setShowHelp(false)}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowHelp(false)} activeOpacity={1}>
            <View style={{ 
              position: 'absolute', 
              top: popoverPos.y + 4, 
              right: 28, 
              width: 250,
              backgroundColor: colors.card, 
              padding: 12, 
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>{helpText}</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      {children}
    </View>
  );
};

const AnalysisResultModal = ({ visible, result, onClose, onSchedule }) => {
  const { colors } = useTheme();

  if (!result || (!result.analysis && !result.analyses)) return null;
  const analysesList = result.analyses || (result.analysis ? [result.analysis] : []);

  const handleSchedulePress = () => {
    if (onSchedule) {
      const payload = analysesList.map(a => {
        const schedule = a.extracted_schedule || {};
        return {
          medicineName: a.drug_name || '',
          dosage: schedule.dosage || a.typical_dosage_range || '',
          frequency: schedule.frequency && schedule.frequency !== 'UNKNOWN' ? schedule.frequency : 'DAILY',
          frequencyValue: schedule.frequencyValue || '',
          duration: schedule.duration && schedule.duration !== 'UNKNOWN' ? schedule.duration : 'SINGLE_DAY',
          durationValue: schedule.durationValue || ''
        };
      });
      onSchedule(payload);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.drugName, { color: colors.text }]}>
              {analysesList.length > 1 ? `${analysesList.length} Medicines Found` : (analysesList[0].drug_name || 'Unknown')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.chip }]}>
            <MaterialIcons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {analysesList.map((a, index) => {
            const confidenceColor = a.confidence?.level === 'high' ? colors.success
              : a.confidence?.level === 'medium' ? '#FF9500' : colors.error;

            return (
              <View key={index} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary, flex: 1 }}>{a.drug_name || 'Unknown'}</Text>
                  {a.confidence?.level && (
                    <View style={styles.confidenceRow}>
                      <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
                      <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                        {a.confidence.level.toUpperCase()} CONFIDENCE
                      </Text>
                    </View>
                  )}
                </View>

          {/* Indications */}
          {a.indications?.length > 0 && (
            <Section icon="healing" title="Indications" colors={colors} helpText="Symptoms or conditions this medicine is designed to treat.">
              <View style={styles.tagRow}>
                {a.indications.map((item, i) => (
                  <Tag key={i} label={item} color={colors.primary} bgColor={colors.primary + '20'} />
                ))}
              </View>
            </Section>
          )}

          {/* Dosage */}
          {(a.typical_dosage_range || a.recommended_dosage?.notes) && (
            <Section icon="schedule" title="Dosage" colors={colors} helpText="Recommended amount and frequency for taking this medicine.">
              {a.typical_dosage_range && (
                <Text style={[styles.bodyText, { color: colors.text }]}>{a.typical_dosage_range}</Text>
              )}
              {a.recommended_dosage?.notes && (
                <Text style={[styles.noteText, { color: colors.textSecondary }]}>{a.recommended_dosage.notes}</Text>
              )}
            </Section>
          )}

          {/* Side Effects */}
          {a.side_effects?.length > 0 && (
            <Section icon="warning" title="Side Effects" colors={colors} helpText="Potential unintended effects that may occur while taking this medicine.">
              <View style={styles.tagRow}>
                {a.side_effects.map((item, i) => (
                  <Tag key={i} label={item} color={colors.error} bgColor={colors.error + '20'} />
                ))}
              </View>
            </Section>
          )}

          {/* Interactions */}
          {a.interactions?.length > 0 && (
            <Section icon="device-hub" title="Interactions" colors={colors} helpText="Other substances, such as food or different drugs, that may affect how this medicine works or cause adverse reactions.">
              {a.interactions.map((ix, i) => (
                <View key={i} style={styles.listItem}>
                  <MaterialIcons name="fiber-manual-record" size={8} color="#FF9500" style={{ marginTop: 6, marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bodyText, { color: colors.text }]}>{ix.substance}
                      <Text style={[styles.noteText, { color: colors.textSecondary }]}> — {ix.severity}</Text>
                    </Text>
                    {ix.notes && <Text style={[styles.noteText, { color: colors.textSecondary }]}>{ix.notes}</Text>}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* Contraindications */}
          {a.contraindications?.length > 0 && (
            <Section icon="block" title="Contraindications" colors={colors} helpText="Specific situations or medical conditions where this medicine should NOT be used because it may be harmful.">
              <View style={styles.tagRow}>
                {a.contraindications.map((item, i) => (
                  <Tag key={i} label={item} color={colors.error} bgColor={colors.error + '20'} />
                ))}
              </View>
            </Section>
          )}

          {/* Risks */}
          {a.risks_of_wrong_dosage?.length > 0 && (
            <Section icon="error-outline" title="Risks of Wrong Dosage" colors={colors} helpText="Potential health risks associated with taking an incorrect amount of this medicine.">
              {a.risks_of_wrong_dosage.map((r, i) => (
                <View key={i} style={styles.listItem}>
                  <MaterialIcons name="fiber-manual-record" size={8} color={colors.error} style={{ marginTop: 6, marginRight: 6 }} />
                  <Text style={[styles.bodyText, { flex: 1, color: colors.text }]}>{r}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Recommendations */}
          {a.recommendations?.length > 0 && (
            <Section icon="info-outline" title="Recommendations" colors={colors} helpText="General advice, warnings, or instructions on how to store and use this medicine correctly.">
              {a.recommendations.map((rec, i) => (
                <View key={i} style={styles.listItem}>
                  <MaterialIcons name="fiber-manual-record" size={8} color={colors.success} style={{ marginTop: 6, marginRight: 6 }} />
                  <Text style={[styles.bodyText, { flex: 1, color: colors.text }]}>{rec}</Text>
                </View>
              ))}
            </Section>
          )}

              </View>
            );
          })}

          {onSchedule && (
            <TouchableOpacity 
              style={[styles.scheduleBtn, { backgroundColor: colors.primary }]} 
              onPress={handleSchedulePress}
            >
              <MaterialIcons name="alarm-add" size={20} color="#fff" />
              <Text style={styles.scheduleBtnText}>
                {analysesList.length > 1 ? 'Schedule All Medicines' : 'Schedule Medicine'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 52,
    borderBottomWidth: 1,
  },
  drugName: { fontSize: 24, fontWeight: '800' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  confidenceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  confidenceText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  closeBtn: { padding: 10, borderRadius: 20 },
  content: { padding: 16 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  noteText: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  listItem: { flexDirection: 'row', marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: { fontSize: 13, fontWeight: '600' },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  scheduleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  }
});

export default AnalysisResultModal;
