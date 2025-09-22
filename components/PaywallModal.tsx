// components/PaywallModal.tsx - Fixed for 3 Subscription Tiers
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import Purchases, { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
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
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('PaywallModal visibility changed:', visible);
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading RevenueCat offerings...');
      
      const offerings = await Purchases.getOfferings();
      console.log('📦 All offerings received:', offerings);
      
      if (offerings.current) {
        console.log('✅ Current offering found:', offerings.current.identifier);
        console.log('📋 Available packages:', offerings.current.availablePackages.map(pkg => ({
          id: pkg.identifier,
          type: pkg.packageType,
          product: pkg.product.identifier,
          price: pkg.product.priceString
        })));
        
        setOfferings(offerings.current);
        
        // Set default selection to Pro Monthly (best value for most users)
        const proMonthlyPackage = offerings.current.availablePackages.find(
          pkg => pkg.identifier === 'Monthly' // Your custom Pro Monthly identifier
        );
        
        if (proMonthlyPackage) {
          setSelectedPackage(proMonthlyPackage);
          console.log('📌 Default package selected: Pro Monthly');
        } else {
          // Fallback to basic monthly if pro not found
          const basicMonthly = offerings.current.availablePackages.find(
            pkg => pkg.identifier === '$rc_monthly'
          );
          if (basicMonthly) {
            setSelectedPackage(basicMonthly);
          } else if (offerings.current.availablePackages.length > 0) {
            setSelectedPackage(offerings.current.availablePackages[0]);
          }
        }
      } else {
        console.log('❌ No current offerings found');
      }
    } catch (error) {
      console.error('❌ Error loading offerings:', error);
    } finally {
      setIsLoading(false);
      console.log('✅ Loading complete');
    }
  };

  const handlePurchase = async () => {
    console.log('🛒 Subscribe button pressed!');
    console.log('📦 Currently selected package:', selectedPackage ? {
      id: selectedPackage.identifier,
      product: selectedPackage.product.identifier,
      price: selectedPackage.product.priceString
    } : 'None');
    
    if (!selectedPackage) {
      console.log('⚠️ No package selected');
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    setIsProcessing(true);
    console.log('💳 Starting purchase for:', selectedPackage.identifier);
    
    try {
      console.log('🔄 Calling Purchases.purchasePackage...');
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      console.log('✅ Purchase response received:', customerInfo);
      
      // Check if user has premium entitlement
      if (customerInfo.entitlements.active["premium"]) {
        console.log('✅ Premium entitlement active!');
        
        // Update local subscription state
        const expirationDate = customerInfo.entitlements.active["premium"].expirationDate;
        console.log('📅 Expiration date:', expirationDate);
        
        await updateSubscription({
          plan: selectedPackage.identifier,
          isActive: true,
          renewalDate: expirationDate ? new Date(expirationDate) : undefined,
          dreamsRemaining: getDreamsForPackage(selectedPackage),
          totalDreams: getDreamsForPackage(selectedPackage),
        });

        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy creating amazing dreams!',
          [{ text: 'Start Creating', onPress: onClose }]
        );
      } else {
        console.log('⚠️ No premium entitlement found after purchase');
      }
    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        userCancelled: error.userCancelled
      });
      
      if (error.userCancelled) {
        console.log('👤 User cancelled the purchase');
      } else {
        Alert.alert(
          'Purchase Failed',
          `Unable to complete your purchase: ${error.message || 'Unknown error'}`,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsProcessing(false);
      console.log('✅ Purchase process complete');
    }
  };

  const handleRestorePurchases = async () => {
    console.log('🔄 Restore purchases pressed');
    setIsProcessing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ Restore response:', customerInfo);
      
      if (customerInfo.entitlements.active["premium"]) {
        Alert.alert(
          'Purchases Restored!',
          'Your subscription has been restored successfully.',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases found to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Restore error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getDreamsForPackage = (pkg: PurchasesPackage): number => {
    // Map package identifiers to dream counts based on your RevenueCat setup
    if (pkg.identifier === '$rc_monthly') return 3; // Basic Monthly - 3 dreams
    if (pkg.identifier === 'Monthly') return 5; // Pro Monthly - 5 dreams
    if (pkg.identifier === '$rc_annual') return 60; // Annual - 5 dreams x 12 months
    
    // Fallback based on product identifier
    if (pkg.product.identifier.includes('basic')) return 3;
    if (pkg.product.identifier.includes('pro')) return 5;
    if (pkg.product.identifier.includes('annual')) return 60;
    
    return 3; // Default to basic
  };

  const getPackageDetails = (pkg: PurchasesPackage) => {
    // Determine package details based on identifier
    if (pkg.identifier === '$rc_monthly') {
      return {
        name: 'Basic',
        dreams: '3 dreams',
        features: ['3 AI-generated dreams per month', 'Basic video quality', 'Standard processing'],
        isPopular: false,
        badge: null
      };
    }
    
    if (pkg.identifier === 'Monthly') {
      return {
        name: 'Pro',
        dreams: '5 dreams',
        features: ['5 AI-generated dreams per month', 'HD video quality', 'Priority processing', 'Advanced AI models'],
        isPopular: true,
        badge: 'MOST POPULAR'
      };
    }
    
    if (pkg.identifier === '$rc_annual') {
      const monthlyPrice = pkg.product.price / 12;
      const savings = Math.round(((12.99 - monthlyPrice) / 12.99) * 100);
      return {
        name: 'Annual',
        dreams: '60 dreams/year',
        features: ['5 dreams per month (60/year)', 'HD video quality', 'Priority processing', 'Advanced AI models', `Save ${savings}% vs monthly`],
        isPopular: false,
        badge: 'BEST VALUE'
      };
    }
    
    // Fallback
    return {
      name: pkg.product.title.split('(')[0].trim(),
      dreams: pkg.product.description,
      features: [pkg.product.description],
      isPopular: false,
      badge: null
    };
  };

  const renderPackage = (pkg: PurchasesPackage) => {
    const isSelected = selectedPackage?.identifier === pkg.identifier;
    const details = getPackageDetails(pkg);
    
    console.log('📦 Rendering package:', pkg.identifier, 'Selected:', isSelected);
    
    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          details.isPopular && styles.planCardPopular,
        ]}
        onPress={() => {
          console.log('📋 Package selected:', pkg.identifier);
          setSelectedPackage(pkg);
        }}
      >
        {details.badge && (
          <View style={[
            styles.badge,
            details.badge === 'BEST VALUE' && styles.badgeValue
          ]}>
            <Text style={styles.badgeText}>{details.badge}</Text>
          </View>
        )}
        
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{details.name}</Text>
          <Text style={styles.planDreams}>{details.dreams}</Text>
        </View>
        
        <View style={styles.planPricing}>
          <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
          <Text style={styles.planPeriod}>
            {pkg.identifier === '$rc_annual' ? '/year' : '/month'}
          </Text>
        </View>
        
        <View style={styles.featuresContainer}>
          {details.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.featureCheckmark}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Sort packages for display order: Basic, Pro (popular), Annual
  const sortPackages = (packages: PurchasesPackage[]) => {
    return packages.sort((a, b) => {
      const order: Record<string, number> = {
        '$rc_monthly': 1,  // Basic
        'Monthly': 2,       // Pro
        '$rc_annual': 3     // Annual
      };
      return (order[a.identifier] || 99) - (order[b.identifier] || 99);
    });
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
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => {
                console.log('❌ Close button pressed');
                onClose();
              }}
            >
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
                  {dreamsNeeded > 1 
                    ? `You need ${dreamsNeeded} dreams for this ${feature}. Choose a plan to continue.`
                    : `Create unlimited cinematic dreams with premium features`
                  }
                </Text>
              </View>

              {/* Subscription Plans */}
              <View style={styles.plansContainer}>
                {isLoading ? (
                  <Text style={styles.loadingText}>Loading subscription options...</Text>
                ) : offerings ? (
                  sortPackages(offerings.availablePackages).map(pkg => renderPackage(pkg))
                ) : (
                  <Text style={styles.errorText}>Unable to load subscription options</Text>
                )}
              </View>

              {/* Subscribe Button */}
              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  (isProcessing || !selectedPackage) && styles.subscribeButtonDisabled,
                ]}
                onPress={handlePurchase}
                disabled={isProcessing || !selectedPackage}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  style={styles.subscribeButtonGradient}
                >
                  <Text style={styles.subscribeButtonText}>
                    {isProcessing ? 'Processing...' : 'Subscribe Now'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Restore Purchases */}
              <TouchableOpacity 
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
                disabled={isProcessing}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>

              {/* Terms */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  Subscriptions auto-renew. Cancel anytime in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} settings.
                </Text>
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
    paddingHorizontal: 20,
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
  
  badge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  
  badgeValue: {
    backgroundColor: '#F59E0B',
  },
  
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  
  planHeader: {
    marginBottom: 8,
  },
  
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  
  planDreams: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
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
  
  featuresContainer: {
    marginTop: 8,
  },
  
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  
  featureCheckmark: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 18,
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
  
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});