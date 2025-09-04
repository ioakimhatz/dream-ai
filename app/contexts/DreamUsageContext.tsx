// app/contexts/DreamUsageContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage
} from 'react-native-purchases';

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

// RevenueCat product IDs (configure these in RevenueCat dashboard)
const PRODUCT_IDS = {
  basic: 'dream_basic_monthly',
  pro: 'dream_pro_monthly', 
  annual: 'dream_annual'
};

const PLAN_DETAILS = {
  [PRODUCT_IDS.basic]: {
    name: 'Basic',
    dreams: 3,
    price: '€7.99/month',
    period: 'monthly' as const
  },
  [PRODUCT_IDS.pro]: {
    name: 'Pro', 
    dreams: 5,
    price: '€12.99/month',
    period: 'monthly' as const
  },
  [PRODUCT_IDS.annual]: {
    name: 'Annual',
    dreams: 60,
    price: '€89.99/year',
    period: 'annual' as const
  }
};

const DreamUsageContext = createContext<DreamUsageContextType | null>(null);

export function DreamUsageProvider({ children }: { children: React.ReactNode }) {
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
    initializeRevenueCat();
    loadDreamUsage();
  }, []);

  const initializeRevenueCat = async () => {
    try {
      // Initialize RevenueCat with your API key
      // Get this from RevenueCat dashboard
      const apiKey = Platform.select({
        ios: 'YOUR_IOS_API_KEY', // Add iOS key when you set up iOS in RevenueCat
        android: 'goog_vqsMJMYUkDARBruIeYkniWJXlYv', 
      });

      if (apiKey) {
        // Set log level for debugging (remove in production)
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        
        await Purchases.configure({ apiKey });
        
        // Get offerings
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
          setOfferings(offerings.current);
        }
        
        // Check subscription status
        await checkSubscriptionStatus();
      }
    } catch (error) {
      console.error('RevenueCat initialization error:', error);
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      
      // Check for active subscriptions
      const activeSubscription = Object.keys(customerInfo.entitlements.active).find(
        key => customerInfo.entitlements.active[key].isActive
      );

      if (activeSubscription) {
        const productId = customerInfo.entitlements.active[activeSubscription].productIdentifier;
        const planDetail = PLAN_DETAILS[productId];
        
        if (planDetail) {
          const newSubscription: Subscription = {
            id: productId,
            name: planDetail.name,
            price: planDetail.price,
            dreams: planDetail.dreams,
            period: planDetail.period,
            isActive: true
          };
          
          setSubscription(newSubscription);
          await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(newSubscription));
          
          // Update dream usage with subscription limits
          await updateDreamLimits(productId, planDetail.dreams, planDetail.period);
        }
      } else {
        // No active subscription
        setSubscription(null);
        await AsyncStorage.removeItem(SUBSCRIPTION_KEY);
        
        // Reset to free tier (0 dreams)
        setDreamUsage({
          used: 0,
          total: 0,
          resetDate: new Date().toISOString(),
          planId: null
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
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
      shouldReset = now.getMonth() !== resetDate.getMonth() || 
                   now.getFullYear() !== resetDate.getFullYear();
    } else {
      // Reset annually
      shouldReset = now.getFullYear() !== resetDate.getFullYear();
    }

    let newUsage: DreamUsage;
    if (shouldReset || currentUsage.planId !== planId) {
      // Reset usage for new period or plan change
      newUsage = {
        used: 0,
        total: dreamCount,
        resetDate: now.toISOString(),
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
      console.error('Error loading dream usage:', error);
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

  const useDream = async (): Promise<boolean> => {
    // Check monthly reset first
    const now = new Date();
    const resetDate = new Date(dreamUsage.resetDate);
    
    let currentUsage = { ...dreamUsage };
    
    // Check if we need to reset monthly counter
    if (subscription?.period === 'monthly' && 
        (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear())) {
      currentUsage = {
        used: 0,
        total: subscription.dreams,
        resetDate: now.toISOString(),
        planId: subscription.id
      };
    }
    
    // Check if user can generate
    if (currentUsage.used >= currentUsage.total) {
      Alert.alert(
        'Dream Limit Reached',
        subscription 
          ? `You've used all ${currentUsage.total} dreams for this period. Upgrade to Pro for more dreams!`
          : 'Subscribe to generate amazing dream videos!',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'View Plans', onPress: () => {/* Navigate to subscription */} }
        ]
      );
      return false;
    }
    
    // Use a dream
    const newUsage = {
      ...currentUsage,
      used: currentUsage.used + 1
    };
    
    setDreamUsage(newUsage);
    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));
    
    return true;
  };

  const purchaseSubscription = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoadingSubscription(true);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      // Check if purchase was successful
      if (customerInfo.entitlements.active[packageToPurchase.product.identifier]) {
        await checkSubscriptionStatus();
        Alert.alert('Success!', 'Your subscription is now active. Enjoy creating dreams!');
        return true;
      }
      
      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message);
      }
      return false;
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoadingSubscription(true);
      const customerInfo = await Purchases.restorePurchases();
      
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        await checkSubscriptionStatus();
        Alert.alert('Success!', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    setIsLoadingSubscription(true);
    await checkSubscriptionStatus();
    setIsLoadingSubscription(false);
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