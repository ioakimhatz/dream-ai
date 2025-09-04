// app/(tabs)/index.tsx - HOME SCREEN WITH SUBSCRIPTION INTEGRATION
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

// Import your utilities
import { useAuth } from '../contexts/AuthContext';
import { useDreamUsage } from '../contexts/DreamUsageContext';
import { removeBackground } from '../utils/backgroundRemoval';
import { generateDreamVideo } from '../utils/generateDreamVideo';
import { analyzePromptStrength } from '../utils/promptValidator';
import { saveDream } from '../utils/storage';
import { transcribeAudio } from '../utils/transcribe';

// Local interfaces
interface PromptAnalysis {
  strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  score: number;
  issues: string[];
  suggestions: string[];
  canGenerate: boolean;
}

// Helper functions
function getStrengthColor(analysis: PromptAnalysis): string {
  switch (analysis.strength) {
    case 'WEAK': return '#ff4444';
    case 'FAIR': return '#ff9500';
    case 'GOOD': return '#00aa00';
    case 'EXCELLENT': return '#7278E6';
    default: return '#999999';
  }
}

function getStrengthMessage(analysis: PromptAnalysis): string {
  switch (analysis.strength) {
    case 'WEAK': return 'Add more details for better results';
    case 'FAIR': return 'Good start - add one more detail';
    case 'GOOD': return 'Great prompt - ready to generate!';
    case 'EXCELLENT': return 'Perfect! Cinema-quality incoming!';
    default: return '';
  }
}

// Prompt Strength Indicator Component
const PromptStrengthIndicator = ({ prompt, onAnalysisChange }: {
  prompt: string;
  onAnalysisChange?: (analysis: PromptAnalysis) => void;
}) => {
  const analysis = React.useMemo(() => {
    if (!prompt.trim()) {
      return {
        strength: 'WEAK' as const,
        score: 0,
        issues: ['Start typing your dream...'],
        suggestions: ['Describe who, what, where, and how you felt'],
        canGenerate: false
      };
    }
    return analyzePromptStrength(prompt);
  }, [prompt]);

  React.useEffect(() => {
    onAnalysisChange?.(analysis);
  }, [analysis, onAnalysisChange]);

  if (!prompt.trim()) {
    return (
      <View style={strengthStyles.container}>
        <Text style={strengthStyles.emptyMessage}>
          Start describing your dream to see strength analysis...
        </Text>
      </View>
    );
  }

  const strengthColor = getStrengthColor(analysis);
  const strengthMessage = getStrengthMessage(analysis);

  return (
    <View style={strengthStyles.container}>
      {/* Progress Bar */}
      <View style={strengthStyles.progressContainer}>
        <View style={strengthStyles.progressBackground}>
          <View
            style={[
              strengthStyles.progressFill,
              { 
                width: `${analysis.score}%`,
                backgroundColor: strengthColor
              }
            ]}
          />
        </View>
        <Text style={strengthStyles.scoreText}>{analysis.score}/100</Text>
      </View>

      {/* Strength Message */}
      <Text style={[strengthStyles.strengthText, { color: strengthColor }]}>
        {strengthMessage}
      </Text>

      {/* Issues and Suggestions */}
      {analysis.issues.length > 0 && (
        <View style={strengthStyles.feedbackContainer}>
          {analysis.issues.map((issue, index) => (
            <Text key={index} style={strengthStyles.issueText}>
              • {issue}
            </Text>
          ))}
        </View>
      )}

      {analysis.suggestions.length > 0 && (
        <View style={strengthStyles.feedbackContainer}>
          <Text style={strengthStyles.suggestionsTitle}>Suggestions:</Text>
          {analysis.suggestions.slice(0, 2).map((suggestion, index) => (
            <Text key={index} style={strengthStyles.suggestionText}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

export default function HomeScreen() {
  const { user } = useAuth();
  
  // SUBSCRIPTION HOOKS
  const { 
    dreamUsage, 
    subscription,
    canGenerateDream,
    useDream 
  } = useDreamUsage();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Image upload states
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [processedImages, setProcessedImages] = useState<Map<string, boolean>>(new Map());
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Single 18-second video display
  const [finalVideoUri, setFinalVideoUri] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Enhanced prompt analysis state
  const [promptAnalysis, setPromptAnalysis] = useState<PromptAnalysis | null>(null);

  // Generation progress states
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');

  // For video preview replay
  const [videoKey, setVideoKey] = useState(0);

  // Wave animations for recording
  const waveAnimations = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
  ]).current;

  useEffect(() => {
    if (recording) {
      // Start wave animations when recording
      const animations = waveAnimations.map((anim) => 
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + Math.random() * 200,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ])
        )
      );
      
      animations.forEach(animation => animation.start());
      
      return () => {
        animations.forEach(animation => animation.stop());
      };
    } else {
      // Reset waves when not recording
      waveAnimations.forEach(anim => anim.setValue(0.3));
    }
  }, [recording, waveAnimations]);

  // Audio recording functions
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsTranscribing(true);
    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    try {
      const savedLanguage = await AsyncStorage.getItem('language');
      const language = savedLanguage || 'en';
      
      const result = await transcribeAudio(uri!, language);
      setTranscript(result);
    } catch (err) {
      console.error('Failed to transcribe audio:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Image selection with background removal
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add people to your dreams.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const originalImage = result.assets[0].uri;
        
        setIsProcessingImage(true);
        
        try {
          console.log('Processing image with background removal...');
          const processedImage = await removeBackground(originalImage, {
            size: 'preview',
            type: 'person',
          });
          
          setSelectedImages(prev => [...prev, processedImage]);
          
          const newProcessedMap = new Map(processedImages);
          newProcessedMap.set(processedImage, processedImage !== originalImage);
          setProcessedImages(newProcessedMap);
          
          if (processedImage !== originalImage) {
            Alert.alert(
              'Background Removed!', 
              'Your face will blend naturally into the dream video.',
              [{ text: 'Great!', style: 'default' }]
            );
          }
        } catch (error) {
          console.error('Error processing image:', error);
          setSelectedImages(prev => [...prev, originalImage]);
        } finally {
          setIsProcessingImage(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setIsProcessingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // UPDATED GENERATE FUNCTION WITH SUBSCRIPTION CHECK
  const handleGenerateDream = async () => {
    try {
      // CHECK SUBSCRIPTION FIRST
      if (!subscription) {
        Alert.alert(
          'Subscription Required',
          'Subscribe to start creating amazing dream videos!',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'View Plans', 
              onPress: () => router.push('/(tabs)/settings')
            }
          ]
        );
        return;
      }

      // CHECK DREAM USAGE
      const canProceed = await useDream();
      if (!canProceed) {
        // User has reached their limit - useDream shows the alert
        return;
      }

      // Check prompt quality
      if (!promptAnalysis?.canGenerate) {
        Alert.alert(
          'Dream Needs More Details', 
          `Your dream description needs to be richer for premium quality results. Current strength: ${promptAnalysis?.strength}\n\nSuggestions:\n${promptAnalysis?.suggestions?.slice(0, 2).join('\n') || 'Add more details about emotions, setting, and actions'}`,
          [{ text: 'Keep Writing', style: 'default' }]
        );
        return;
      }

      if (!transcript) return;

      setIsGenerating(true);
      setFinalVideoUri(null);
      setCoverImage(null);
      setGenerationProgress(0);
      setGenerationStep('');

      console.log('🎭 [DREAM AI] Starting dream cinema generation...');
      
      // Generate dream cinema
      const { videoUrls, coverUrl } = await generateDreamVideo(
        transcript, 
        selectedImages,
        (step: string, progress: number) => {
          setGenerationStep(step);
          setGenerationProgress(progress);
        }
      );
      
      // videoUrls[0] is the stitched 18-second video
      const stitchedVideoUrl = videoUrls[0];
      
      console.log('✅ [DREAM AI] Received stitched 18-second video:', stitchedVideoUrl);
      
      // Set final results
      setFinalVideoUri(stitchedVideoUrl);
      setCoverImage(coverUrl ?? null);
      setVideoKey(prev => prev + 1);

      // Save dream to library
      await saveDream({
        id: uuid(),
        createdAt: Date.now(),
        prompt: transcript,
        coverUrl: coverUrl ?? null,
        videoUrl: stitchedVideoUrl,
        clips: undefined,
        duration: 18,
      });

      console.log('✅ [DREAM AI] 18-second dream cinema saved to library!');
      Alert.alert(
        'Dream Created!', 
        'Your 18-second dream cinema is ready!',
        [{ text: 'Awesome!', style: 'default' }]
      );
      
    } catch (err: any) {
      console.error('❌ [DREAM AI] Error generating dream cinema:', err);
      
      let errorMessage = 'Failed to generate dream cinema. Please try again.';
      
      if (err.message?.includes('credits')) {
        errorMessage = 'Insufficient credits. Please add credits to your account.';
      } else if (err.message?.includes('API key')) {
        errorMessage = 'API configuration error. Please check your settings.';
      } else if (err.message?.includes('Cloudinary')) {
        errorMessage = 'Video stitching failed. Check your Cloudinary configuration.';
      }
      
      Alert.alert('Generation Failed', errorMessage);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStep('');
    }
  };

  // Usage indicator component
  const renderUsageIndicator = () => {
    if (!subscription) return null;
    
    return (
      <View style={styles.usageIndicator}>
        <Text style={styles.usageText}>
          Dreams: {dreamUsage.used}/{dreamUsage.total}
        </Text>
        {dreamUsage.used >= dreamUsage.total && (
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.upgradeHint}
          >
            <Text style={styles.upgradeHintText}>Upgrade for more</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // UPDATED canGenerate logic with subscription check
  const canGenerate = transcript && promptAnalysis?.canGenerate && !isGenerating && canGenerateDream;

  // UPDATED button text with subscription status
  const getButtonText = () => {
    if (isGenerating) return 'Creating your dream cinema...';
    if (!subscription) return 'Subscribe to Generate Dreams';
    if (!transcript) return 'Enter your dream first';
    if (!promptAnalysis?.canGenerate) return 'Add more details to generate';
    if (!canGenerateDream) return 'Dream limit reached - Upgrade';
    return 'Generate Dream Cinema';
  };

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo row */}
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImg}
          />
          <Text style={styles.logoWord}>Dream AI</Text>
        </View>

        {/* MIC WITH CLEAN REC INDICATOR */}
        <View style={styles.micContainer}>
          <TouchableOpacity
            style={styles.micButton}
            onPress={recording ? stopRecording : startRecording}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../assets/images/mic.png')}
              style={styles.micIcon}
            />
            
            {recording && (
              <View style={styles.recIndicatorInside}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>REC</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Wave Animation below the mic when recording */}
          {recording && (
            <View style={styles.waveContainer}>
              {waveAnimations.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveLine,
                    {
                      height: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 40],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <Text style={styles.prompt}>What did you dream?</Text>

        <View style={styles.card}>
          <TextInput
            style={styles.transcriptTextInput}
            multiline
            placeholder={
              isTranscribing
                ? 'Transcribing your voice...'
                : 'Describe your dream...'
            }
            placeholderTextColor="#ccc"
            value={transcript}
            onChangeText={setTranscript}
            editable
          />

          {/* Prompt Strength Indicator */}
          <PromptStrengthIndicator 
            prompt={transcript}
            onAnalysisChange={setPromptAnalysis}
          />

          {/* Image Upload Section with Background Removal */}
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionTitle}>Who was in your dream?</Text>
            <Text style={styles.imageSectionSubtitle}>
              Add photos to see them in your dream video
              {processedImages.size > 0 && ' • Background removed'}
            </Text>
            
            {/* Processing Indicator */}
            {isProcessingImage && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#7278E6" />
                <Text style={styles.processingText}>Removing background...</Text>
              </View>
            )}
            
            {/* Selected Images Grid */}
            <View style={styles.imageGrid}>
              {selectedImages.map((imageUri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.selectedImage} />
                  {processedImages.get(imageUri) && (
                    <View style={styles.processedBadge}>
                      <Text style={styles.processedBadgeText}>✨</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Add Image Button */}
              {selectedImages.length < 3 && !isProcessingImage && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <Text style={styles.addImageIcon}>+</Text>
                  <Text style={styles.addImageText}>Add person</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* USAGE INDICATOR - NEW */}
          {renderUsageIndicator()}

          {/* Generate Button - UPDATED WITH SUBSCRIPTION CHECK */}
          <TouchableOpacity
            onPress={handleGenerateDream}
            style={[
              styles.generateBtn,
              !canGenerate && styles.generateBtnDisabled
            ]}
            disabled={!canGenerate}
          >
            <Text style={[
              styles.generateBtnText,
              !canGenerate && styles.generateBtnTextDisabled
            ]}>
              {getButtonText()}
            </Text>
          </TouchableOpacity>

          {/* Single 18-Second Video Preview */}
          <View>
            <Text style={styles.generatedPreview}>Generated video preview</Text>

            {isGenerating ? (
              <View style={styles.previewWrapper}>
                <Image
                  source={require('../../assets/images/dream-preview.png')}
                  style={[styles.previewImage, { opacity: 0.5 }]}
                  blurRadius={8}
                />
                <ActivityIndicator
                  size="large"
                  color="#7278E6"
                  style={styles.spinner}
                />
                <Text style={styles.loadingText}>
                  {generationStep || 'Creating your dream cinema...'}
                </Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${generationProgress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(generationProgress)}%
                  </Text>
                </View>
              </View>
            ) : finalVideoUri ? (
              // Single 18-second video player
              <View style={styles.previewVideoContainer}>
                <Video
                  key={videoKey}
                  source={{ uri: finalVideoUri }}
                  style={styles.videoPlayer}
                  useNativeControls={false}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={true}
                  isLooping={true}
                  onPlaybackStatusUpdate={(status) => {
                    if (status.isLoaded && status.durationMillis) {
                      console.log('📹 Video duration:', Math.round(status.durationMillis / 1000), 'seconds');
                    }
                  }}
                />
                <TouchableOpacity 
                  style={styles.replayButton}
                  onPress={() => setVideoKey(prev => prev + 1)}
                >
                  <Text style={styles.replayButtonText}>↻ Replay</Text>
                </TouchableOpacity>
              </View>
            ) : coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.previewImage} />
            ) : (
              <Image
                source={require('../../assets/images/dream-preview.png')}
                style={styles.previewImage}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// CLEAN STYLES WITH SUBSCRIPTION ADDITIONS
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Logo row
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    transform: [{ translateX: -22 }],
  },

  logoImg: {
    width: 72,
    height: 64,
    resizeMode: 'contain',
    marginRight: 3,
  },

  logoWord: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 0,
  },

  // Mic styles
  micContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },

  micButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
  },

  micIcon: { 
    width: 74, 
    height: 74,
    tintColor: '#ffffff',
  },

  recIndicatorInside: {
    position: 'absolute',
    bottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    marginRight: 6,
  },

  recText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 20,
    height: 50,
  },

  waveLine: {
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1.5,
    opacity: 0.9,
  },

  prompt: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 18,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    minHeight: 600,
  },

  transcriptTextInput: {
    fontSize: 22,
    color: '#0A2540',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
    minHeight: 100,
  },

  // Image Upload Styles
  imageSection: {
    marginBottom: 20,
  },

  imageSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },

  imageSectionSubtitle: {
    fontSize: 14,
    color: '#68707D',
    marginBottom: 12,
  },

  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#7278E6',
    fontWeight: '600',
  },

  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  imageContainer: {
    position: 'relative',
  },

  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#7278E6',
  },

  processedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7278E6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  processedBadgeText: {
    fontSize: 12,
  },

  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },

  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },

  addImageIcon: {
    fontSize: 24,
    color: '#7278E6',
    fontWeight: 'bold',
    marginBottom: 2,
  },

  addImageText: {
    fontSize: 10,
    color: '#7278E6',
    fontWeight: '600',
    textAlign: 'center',
  },

  // SUBSCRIPTION USAGE INDICATOR - NEW
  usageIndicator: {
    backgroundColor: 'rgba(114, 120, 230, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(114, 120, 230, 0.3)',
  },

  usageText: {
    color: '#7278E6',
    fontSize: 14,
    fontWeight: '600',
  },

  upgradeHint: {
    backgroundColor: '#7278E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  upgradeHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  generateBtn: {
    backgroundColor: '#7278E6',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  
  generateBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  
  generateBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 18 
  },
  
  generateBtnTextDisabled: {
    color: '#9CA3AF',
  },

  // Preview styles
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    resizeMode: 'cover',
    marginBottom: 12,
  },

  generatedPreview: {
    color: '#7278E6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  previewWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 220,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },

  spinner: { 
    position: 'absolute', 
    top: '35%' 
  },

  loadingText: {
    position: 'absolute',
    top: '50%',
    color: '#7278E6',
    fontSize: 16,
    fontWeight: 'bold',
  },

  previewVideoContainer: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },

  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  
  replayButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(114, 120, 230, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  
  replayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  progressContainer: {
    position: 'absolute',
    top: '65%',
    width: '80%',
    alignItems: 'center',
  },

  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(114, 120, 230, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#7278E6',
    borderRadius: 4,
  },

  progressText: {
    color: '#7278E6',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});

// Prompt Strength Indicator Styles
const strengthStyles = StyleSheet.create({
  container: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  
  emptyMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    minWidth: 45,
    textAlign: 'right',
  },
  
  strengthText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  feedbackContainer: {
    marginTop: 8,
  },
  
  issueText: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 4,
    lineHeight: 18,
  },
  
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  
  suggestionText: {
    fontSize: 14,
    color: '#28a745',
    marginBottom: 4,
    lineHeight: 18,
  },
});