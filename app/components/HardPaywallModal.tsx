// app/components/HardPaywallModal.tsx - CalAI-Style Minimal Hard Paywall
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import React from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useDreamUsage } from '../contexts/DreamUsageContext';

const { width } = Dimensions.get('window');

interface HardPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPlan: (planType: 'weekly' | 'monthly' | 'custom', quantity?: number) => void;
}

export default function HardPaywallModal({ visible, onClose, onSelectPlan }: HardPaywallModalProps) {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isPurchasing, setIsPurchasing] = React.useState(false);
  const { user } = useAuth();
  const { offerings, purchaseSubscription, restorePurchases } = useDreamUsage();

  if (!fontsLoaded) return null;

  const handleRestore = async () => {
    try {
      // ✅ Use restorePurchases from context - handles all sync logic
      await restorePurchases();
      onClose();
    } catch (error) {
      console.error('Restore failed:', error);
      // Context already shows alerts, so we don't need to show another one here
    }
  };

  const handleContinue = async () => {
    // Prevent spam clicks
    if (isPurchasing) {
      console.log('⚠️ Purchase already in progress, ignoring click');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsPurchasing(true);

    try {
      // Find weekly package from offerings (already loaded by DreamUsageContext)
      const weeklyPackage = offerings?.availablePackages.find(
        pkg => pkg.identifier === '$rc_weekly' || pkg.product.identifier.includes('weekly')
      );

      if (!weeklyPackage) {
        Alert.alert('Error', 'Weekly subscription not available.');
        return;
      }

      console.log('💳 Purchasing weekly plan...');

      // ✅ Use purchaseSubscription from context - handles all RevenueCat sync logic
      const success = await purchaseSubscription(weeklyPackage);

      if (success) {
        console.log('✅ Purchase successful!');
        onClose();
        // Trigger video generation after successful purchase
        onSelectPlan('weekly');
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('❌ Purchase error:', error);
        Alert.alert('Purchase Failed', error.message || 'Please try again');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Restore Button */}
        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Headline */}
          <Text style={styles.headline}>
            Unlock Dream AI to bring{'\n'}your dreams to life.
          </Text>

          {/* Phone Mockup with Video */}
          <View style={styles.mockupContainer}>
            <Video
              source={{ uri: 'https://res.cloudinary.com/dsfqvxje5/video/upload/v1768482394/vwu1dpviabbo4cosgdfa.mp4' }}
              style={styles.videoInPhone}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Cancel Anytime */}
          <View style={styles.checkmarkContainer}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.checkmarkText}>Cancel anytime</Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, isPurchasing && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={isPurchasing}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>
              {isPurchasing ? 'Processing...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Pricing */}
          <Text style={styles.pricingText}>
            Just $2.49 per week
          </Text>

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  restoreButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  restoreText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },

  // Main Content
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 45,
    marginBottom: 5,
    zIndex: 10,  // Bring text in front of video
  },

  // Phone Mockup
  mockupContainer: {
    alignItems: 'center',
    marginTop: -26,          // Moved higher
    marginBottom: 35,
    width: '100%',
    paddingHorizontal: 24,   // Slightly smaller
    marginLeft: 16,
  },
  videoInPhone: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 32,
    overflow: 'hidden',
  },

  // Checkmark
  checkmarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 20,
    marginRight: 8,
  },
  checkmarkText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  continueButton: {
    backgroundColor: '#7E78EA',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  pricingText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
  },
  finePrint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: '90%',
    paddingHorizontal: 20,
  },
});
