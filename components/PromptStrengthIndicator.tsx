// app/components/PromptStrengthIndicator.tsx
import { 
  analyzePromptStrength, 
  getStrengthColor, 
  getStrengthMessage,
  type PromptAnalysis // Use type import
} from '@/app/utils/promptValidator';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  prompt: string;
  onAnalysisChange?: (analysis: PromptAnalysis) => void;
}

export const PromptStrengthIndicator: React.FC<Props> = ({ prompt, onAnalysisChange }) => {
  const analysis = React.useMemo(() => {
    if (!prompt.trim()) {
      return {
        strength: 'WEAK' as const,
        score: 0,
        issues: ['Start typing your dream...'],
        suggestions: ['Describe who, what, where, and how you felt'],
        canGenerate: false,
        hasAdultContent: false
      };
    }
    
    const result = analyzePromptStrength(prompt);
    
    // DEBUG - Log the result
    console.log('📊 Analysis result:', result);
    console.log('📊 Has adult content?', result.hasAdultContent);
    
    return result;
  }, [prompt]);

  React.useEffect(() => {
    onAnalysisChange?.(analysis);
  }, [analysis, onAnalysisChange]);

  const strengthColor = getStrengthColor(analysis);
  const strengthMessage = getStrengthMessage(analysis);

  // DEBUG - Check if we should show the warning
  console.log('🎨 Should show adult warning?', analysis.hasAdultContent);
  console.log('🎨 Can generate?', analysis.canGenerate);

  return (
    <View style={styles.container}>
      {/* Strength Bar */}
      <View style={styles.strengthBarContainer}>
        <Text style={styles.label}>Prompt Strength:</Text>
        <View style={styles.strengthBarBg}>
          <View 
            style={[
              styles.strengthBarFill, 
              { width: `${analysis.score}%`, backgroundColor: strengthColor }
            ]} 
          />
        </View>
        <Text style={[styles.scoreText, { color: strengthColor }]}>
          {analysis.score}/100
        </Text>
      </View>

      <Text style={[styles.strengthMessage, { color: strengthColor }]}>
        {strengthMessage}
      </Text>

      {/* DEBUG: Force show if adult content detected */}
      {analysis.hasAdultContent === true && (
        <View style={styles.comingSoonContainer}>
          <Text style={styles.comingSoonIcon}>✨</Text>
          <View style={styles.comingSoonTextContainer}>
            <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
            <Text style={styles.comingSoonText}>
              This type of content is not currently available, but we're working on it!
            </Text>
            <Text style={styles.comingSoonHint}>
              🔔 Stay tuned for future updates with expanded content options!
            </Text>
          </View>
        </View>
      )}

      {/* Suggestions - Only show if NO adult content */}
      {analysis.issues.length > 0 && !analysis.hasAdultContent && (
        <View style={styles.issuesContainer}>
          <Text style={styles.issuesTitle}>💡 Suggestions for better results:</Text>
          {analysis.suggestions.map((suggestion: string, index: number) => (
            <Text key={index} style={styles.suggestionText}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}

      {/* Generation Blocker - Only show if NO adult content */}
      {!analysis.canGenerate && prompt.trim().length > 0 && !analysis.hasAdultContent && (
        <View style={styles.blockerContainer}>
          <Text style={styles.blockerText}>
            🚫 Prompt too weak - Add more details to generate amazing results
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
    marginRight: 8,
  },
  strengthBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 40,
  },
  strengthMessage: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  issuesContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7278E6',
    marginBottom: 8,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#68707D',
    marginBottom: 4,
    paddingLeft: 8,
  },
  blockerContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF4444',
  },
  blockerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4444',
    textAlign: 'center',
  },
  comingSoonContainer: {
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#7278E6',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  comingSoonIcon: {
    fontSize: 24,
    marginRight: 10,
    marginTop: 2,
  },
  comingSoonTextContainer: {
    flex: 1,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4338CA',
    marginBottom: 6,
  },
  comingSoonText: {
    fontSize: 13,
    color: '#4F46E5',
    lineHeight: 18,
    marginBottom: 8,
  },
  comingSoonHint: {
    fontSize: 12,
    color: '#6366F1',
    fontStyle: 'italic',
  },
});