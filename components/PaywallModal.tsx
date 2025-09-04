// components/PaywallModal.tsx - Complete Subscription Paywall
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../app/contexts/AuthContext';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  dreamsNeeded?: number;
  feature?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function PaywallModal({ 
  visible, 
  onClose, 
  dreamsNeeded = 1, 
  feature = "Dream Generation" 
}: PaywallModalProps) {
  const { user, updateSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'basic_pro' | 'premium_pro' | 'annual_pro'>('basic_pro');
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscription plans configuration
  const subscriptionPlans = {
    basic_pro: {
      name: 'Basic Pro',
      price: '$5.99',
      period: '/month',
      dreams: 3,
      description: '3 dreams per month',
      popular: false,
    },
    premium_pro: {
      name: 'Premium Pro', 
      price: '$9.99',
      period: '/month',
      dreams: 5,
      description: '5 dreams per month',
      popular: true,
    },
    annual_pro: {
      name: 'Annual Pro',
      price: '$59.99',
      period: '/year',
      dreams: 30,
      description: '30 dreams per year (2.5/month)',
      popular: false,
    },
  };

  const handleSubscribe = async () => {
    if (!user) return;

    setIsProcessing(true);
    
    try {
      // Simulate subscription process (replace with actual payment processing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const plan = subscriptionPlans[selectedPlan];
      const renewalDate = selectedPlan === 'annual_pro' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);  // 1 month

      // Update subscription
      await updateSubscription({
        plan: selectedPlan,
        dreamsRemaining: plan.dreams,
        totalDreams: plan.dreams,
        renewalDate,
        isActive: true,
        isTrialActive: false,
        trialEndsAt: undefined,
      });

      Alert.alert(
        'Subscription Activated!',
        `Welcome to ${plan.name}! You now have ${plan.dreams} dreams${selectedPlan === 'annual_pro' ? ' per year' : ' per month'}.`,
        [
          {
            text: 'Start Dreaming!',
            onPress: onClose,
          },
        ]
      );

    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert(
        'Subscription Failed',
        'There was an issue processing your subscription. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    Alert.alert(
      'Restore Purchases',
      'This feature connects to your App Store/Google Play purchases. In a real app, this would restore any existing subscriptions.',
      [{ text: 'OK' }]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#7C86FF', '#E3C8FF']}
            style={styles.modalContent}
          >
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerEmoji}>🎬✨</Text>
                <Text style={styles.headerTitle}>Unlock Dream AI Pro</Text>
                <Text style={styles.headerSubtitle}>
                  Create unlimited cinematic dreams with premium features
                </Text>
              </View>

              {/* Feature Highlight */}
              <View style={styles.featureBox}>
                <Text style={styles.featureTitle}>
                  You need {dreamsNeeded} dream{dreamsNeeded > 1 ? 's' : ''} for {feature}
                </Text>
                <Text style={styles.featureDescription}>
                  Choose a plan to continue creating amazing dream videos
                </Text>
              </View>

              {/* Subscription Plans */}
              <View style={styles.plansContainer}>
                {(Object.keys(subscriptionPlans) as Array<keyof typeof subscriptionPlans>).map((planKey) => {
                  const plan = subscriptionPlans[planKey];
                  const isSelected = selectedPlan === planKey;
                  
                  return (
                    <TouchableOpacity
                      key={planKey}
                      style={[
                        styles.planCard,
                        isSelected && styles.planCardSelected,
                        plan.popular && styles.planCardPopular,
                      ]}
                      onPress={() => setSelectedPlan(planKey)}
                    >
                      {plan.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                        </View>
                      )}
                      
                      <View style={styles.planHeader}>
                        <Text style={styles.planName}>{plan.name}</Text>
                      </View>
                      
                      <View style={styles.planPricing}>
                        <Text style={styles.planPrice}>{plan.price}</Text>
                        <Text style={styles.planPeriod}>{plan.period}</Text>
                      </View>
                      
                      <Text style={styles.planDescription}>{plan.description}</Text>
                      
                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Text style={styles.selectedIndicatorText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Features List */}
              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>What you get:</Text>
                {[
                  '🎥 High-quality dream videos',
                  '🤖 Advanced AI generation',
                  '👥 Multiple people in dreams',
                  '📱 Cross-device sync',
                  '💾 Cloud storage',
                  '🚫 No watermarks',
                ].map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {/* Subscribe Button */}
              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  isProcessing && styles.subscribeButtonDisabled,
                ]}
                onPress={handleSubscribe}
                disabled={isProcessing}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  style={styles.subscribeButtonGradient}
                >
                  <Text style={styles.subscribeButtonText}>
                    {isProcessing 
                      ? 'Processing...' 
                      : `Subscribe to ${subscriptionPlans[selectedPlan].name}`
                    }
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Restore Purchases */}
              <TouchableOpacity 
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>

              {/* Terms */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  Subscriptions auto-renew. Cancel anytime in your App Store settings.
                </Text>
                <View style={styles.termsLinks}>
                  <TouchableOpacity>
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </TouchableOpacity>
                  <Text style={styles.termsSeparator}>  •  </Text>
                  <TouchableOpacity>
                    <Text style={styles.termsLink}>Terms of Service</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    height: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  featureBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  
  plansContainer: {
    marginBottom: 30,
  },
  
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  planCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
  },
  
  planCardPopular: {
    borderColor: '#10B981',
  },
  
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  
  savingsBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  
  savingsText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
  
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  
  planPeriod: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  selectedIndicator: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  selectedIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  
  featureItem: {
    marginBottom: 12,
  },
  
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  
  subscribeButton: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  
  subscribeButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  restoreButton: {
    alignItems: 'center',
    marginBottom: 30,
  },
  
  restoreButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  
  termsContainer: {
    alignItems: 'center',
  },
  
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  
  termsLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  termsLink: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
  
  termsSeparator: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});