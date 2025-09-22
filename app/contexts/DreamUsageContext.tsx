// app/contexts/DreamUsageContext.tsx - FIXED WITH CORRECT DREAM COUNTS
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage
} from 'react-native-purchases';
import { useAuth } from './AuthContext';

interface DreamUsage {
  used: number;
  total: number;
  resetDate: string;
  planId: string | null;
}

interface Subscription {
  id: string;
  name: string;
  price: string;
  dreams: number;
  period: 'monthly' | 'annual';
  isActive: boolean;
}

interface DreamUsageContextType {
  dreamUsage: DreamUsage;
  subscription: Subscription | null;
  offerings: PurchasesOffering | null;
  isLoadingSubscription: boolean;
  canGenerateDream: boolean;
  useDream: () => Promise<boolean>;
  purchaseSubscription: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const DREAM_USAGE_KEY = '@dream_usage';
const SUBSCRIPTION_KEY = '@subscription_info';

// RevenueCat product IDs (matching your Google Play Console)
const PRODUCT_IDS = {
  basic: 'dream_basic_monthly',
  pro: 'dream_pro_monthly', 
  annual: 'dream_annual'
};

// FIXED: Corrected dream counts to match your RevenueCat setup
const PLAN_DETAILS = {
  [PRODUCT_IDS.basic]: {
    name: 'Basic',
    dreams: 3, // 3 dreams per month
    price: '€7.99/month',
    period: 'monthly' as const
  },
  [PRODUCT_IDS.pro]: {
    name: 'Pro', 
    dreams: 5, // 5 dreams per month
    price: '€12.99/month',
    period: 'monthly' as const
  },
  [PRODUCT_IDS.annual]: {
    name: 'Annual',
    dreams: 60, // 5 dreams × 12 months = 60 dreams per year
    price: '€89.99/year',
    period: 'annual' as const
  }
};

const DreamUsageContext = createContext<DreamUsageContextType | null>(null);

export function DreamUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [dreamUsage, setDreamUsage] = useState<DreamUsage>({
    used: 0,
    total: 0,
    resetDate: new Date().toISOString(),
    planId: null
  });
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  useEffect(() => {
    // RevenueCat is already initialized in _layout.tsx, just load offerings
    loadOfferings();
  }, []);

  useEffect(() => {
    if (user) {
      // Login to RevenueCat with user ID
      loginToRevenueCat(user.id);
      loadDreamUsage();
      checkSubscriptionStatus();
    } else {
      // Logout from RevenueCat
      logoutFromRevenueCat();
      resetUsage();
    }
  }, [user]);

  const loadOfferings = async () => {
    try {
      // Don't initialize again - already done in _layout.tsx
      // Just get the offerings
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
        console.log('📦 RevenueCat offerings loaded:', offerings.current.identifier);
        console.log('📋 Available packages:', offerings.current.availablePackages.map(pkg => ({
          id: pkg.identifier,
          product: pkg.product.identifier,
          price: pkg.product.priceString
        })));
      }
    } catch (error) {
      console.error('❌ Error loading offerings:', error);
      // This is expected on emulator
      if (__DEV__) {
        console.log('⚠️ Offerings not available (expected on emulator)');
      }
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const loginToRevenueCat = async (userId: string) => {
    try {
      await Purchases.logIn(userId);
      console.log('✅ Logged in to RevenueCat with user:', userId);
    } catch (error: any) {
      // Ignore "already logged in" errors
      if (!error.message?.includes('already')) {
        console.error('❌ RevenueCat login error:', error);
      }
    }
  };

  const logoutFromRevenueCat = async () => {
    try {
      // Check if user is anonymous before logging out
      const customerInfo = await Purchases.getCustomerInfo();
      if (!customerInfo.originalAppUserId.startsWith('$RCAnonymousID')) {
        await Purchases.logOut();
        console.log('✅ Logged out from RevenueCat');
      }
    } catch (error: any) {
      // Ignore "user is anonymous" errors
      if (!error.message?.includes('anonymous')) {
        console.error('❌ RevenueCat logout error:', error);
      }
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      setIsLoadingSubscription(true);
      const customerInfo = await Purchases.getCustomerInfo();
      
      console.log('🔍 Checking subscription status...');
      
      // Check for active entitlements
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      
      if (activeEntitlements.length > 0) {
        // Get the first active entitlement (should be "premium")
        const entitlementKey = activeEntitlements[0];
        const entitlement = customerInfo.entitlements.active[entitlementKey];
        const productId = entitlement.productIdentifier;
        
        console.log('✅ Active entitlement found:', entitlementKey, productId);
        
        // Find matching plan details
        const planDetail = Object.entries(PLAN_DETAILS).find(
          ([key]) => productId.includes(key)
        );
        
        if (planDetail) {
          const [planId, details] = planDetail;
          
          const newSubscription: Subscription = {
            id: planId,
            name: details.name,
            price: details.price,
            dreams: details.dreams,
            period: details.period,
            isActive: true
          };
          
          setSubscription(newSubscription);
          await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(newSubscription));
          
          // Update dream usage with subscription limits
          await updateDreamLimits(planId, details.dreams, details.period);
          
          console.log('✅ Active subscription:', details.name, `(${details.dreams} dreams)`);
        }
      } else {
        // No active subscription
        console.log('❌ No active subscription found');
        setSubscription(null);
        await AsyncStorage.removeItem(SUBSCRIPTION_KEY);
        
        // Reset to free tier (0 dreams)
        const freeUsage = {
          used: 0,
          total: 0,
          resetDate: new Date().toISOString(),
          planId: null
        };
        setDreamUsage(freeUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(freeUsage));
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      // Load from cache if RevenueCat fails (expected on emulator)
      const cached = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
      if (cached) {
        setSubscription(JSON.parse(cached));
      }
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const updateDreamLimits = async (planId: string, dreamCount: number, period: 'monthly' | 'annual') => {
    const currentUsage = await loadDreamUsage();
    const now = new Date();
    const resetDate = new Date(currentUsage.resetDate);
    
    // Check if we need to reset the counter
    let shouldReset = false;
    if (period === 'monthly') {
      // Reset monthly
      const monthsDiff = (now.getFullYear() - resetDate.getFullYear()) * 12 + 
                        (now.getMonth() - resetDate.getMonth());
      shouldReset = monthsDiff >= 1;
    } else {
      // Reset annually
      shouldReset = now.getFullYear() > resetDate.getFullYear();
    }

    let newUsage: DreamUsage;
    if (shouldReset || currentUsage.planId !== planId) {
      // Reset usage for new period or plan change
      const nextResetDate = new Date();
      if (period === 'monthly') {
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      } else {
        nextResetDate.setFullYear(nextResetDate.getFullYear() + 1);
      }
      
      newUsage = {
        used: 0,
        total: dreamCount,
        resetDate: nextResetDate.toISOString(),
        planId
      };
    } else {
      // Keep existing usage, just update total
      newUsage = {
        ...currentUsage,
        total: dreamCount,
        planId
      };
    }

    setDreamUsage(newUsage);
    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));
    return newUsage;
  };

  const loadDreamUsage = async (): Promise<DreamUsage> => {
    try {
      const stored = await AsyncStorage.getItem(DREAM_USAGE_KEY);
      if (stored) {
        const usage = JSON.parse(stored);
        setDreamUsage(usage);
        return usage;
      }
    } catch (error) {
      console.error('❌ Error loading dream usage:', error);
    }
    
    const defaultUsage = {
      used: 0,
      total: 0,
      resetDate: new Date().toISOString(),
      planId: null
    };
    setDreamUsage(defaultUsage);
    return defaultUsage;
  };

  const resetUsage = async () => {
    const defaultUsage = {
      used: 0,
      total: 0,
      resetDate: new Date().toISOString(),
      planId: null
    };
    setDreamUsage(defaultUsage);
    setSubscription(null);
    await AsyncStorage.removeItem(DREAM_USAGE_KEY);
    await AsyncStorage.removeItem(SUBSCRIPTION_KEY);
  };

  const useDream = async (): Promise<boolean> => {
    // First check and update if monthly reset is needed
    if (subscription?.period === 'monthly') {
      const now = new Date();
      const resetDate = new Date(dreamUsage.resetDate);
      
      if (now >= resetDate) {
        // Time to reset
        const newResetDate = new Date();
        newResetDate.setMonth(newResetDate.getMonth() + 1);
        
        const resetUsage = {
          used: 0,
          total: subscription.dreams,
          resetDate: newResetDate.toISOString(),
          planId: subscription.id
        };
        
        setDreamUsage(resetUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(resetUsage));
        
        console.log('✅ Monthly dreams reset!');
      }
    }
    
    // Check if user can generate
    if (dreamUsage.used >= dreamUsage.total) {
      Alert.alert(
        'Dream Limit Reached',
        subscription 
          ? `You've used all ${dreamUsage.total} dreams for this period. ${
              subscription.name === 'Basic' ? 'Upgrade to Pro for more dreams!' : 'Your dreams will reset next period.'
            }`
          : 'Subscribe to generate amazing dream videos!',
        [
          { text: 'OK', style: 'cancel' },
          ...(subscription?.name === 'Basic' ? [{ 
            text: 'Upgrade', 
            onPress: () => {/* Navigate to subscription */} 
          }] : [])
        ]
      );
      return false;
    }
    
    // Use a dream
    const newUsage = {
      ...dreamUsage,
      used: dreamUsage.used + 1
    };
    
    setDreamUsage(newUsage);
    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));
    
    console.log(`🎬 Dream used: ${newUsage.used}/${newUsage.total}`);
    return true;
  };

  const purchaseSubscription = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoadingSubscription(true);
      
      console.log('💳 Attempting to purchase:', packageToPurchase.identifier, packageToPurchase.product.priceString);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      console.log('✅ Purchase response received');
      
      // Check if purchase was successful
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasActiveEntitlement) {
        console.log('✅ Purchase successful! Entitlement active');
        await checkSubscriptionStatus();
        Alert.alert(
          'Success!', 
          'Your subscription is now active. Enjoy creating amazing dreams!'
        );
        return true;
      } else {
        console.log('⚠️ Purchase completed but no active entitlement');
      }
      
      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('❌ Purchase error:', error);
        Alert.alert(
          'Purchase Failed', 
          error.message || 'Unable to complete purchase. Please try again.'
        );
      } else {
        console.log('👤 Purchase cancelled by user');
      }
      return false;
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoadingSubscription(true);
      console.log('🔄 Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        await checkSubscriptionStatus();
        Alert.alert('Success!', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error) {
      console.error('❌ Restore error:', error);
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    await checkSubscriptionStatus();
  };

  const canGenerateDream = dreamUsage.used < dreamUsage.total;

  return (
    <DreamUsageContext.Provider
      value={{
        dreamUsage,
        subscription,
        offerings,
        isLoadingSubscription,
        canGenerateDream,
        useDream,
        purchaseSubscription,
        restorePurchases,
        refreshSubscriptionStatus
      }}
    >
      {children}
    </DreamUsageContext.Provider>
  );
}

export function useDreamUsage() {
  const context = useContext(DreamUsageContext);
  if (!context) {
    throw new Error('useDreamUsage must be used within DreamUsageProvider');
  }
  return context;
}