// app/contexts/DreamUsageContext.tsx - DREAM BANK: Simple rollover system (dreams accumulate up to 12)
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage
} from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc, updateDoc, Timestamp, onSnapshot, increment, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

// ✅ FIX: Reliable simulator detection (works on iPhone 16 Pro Max)
// TRUE on simulator/emulator, FALSE on physical device
const isSimulator = !Constants.isDevice;

interface DreamUsage {
  used: number;
  total: number;
  resetDate: string;
  planId: string | null;
  rollover: number;  // 🔥 NEW: Accumulated unused dreams (max 12)
}

interface Subscription {
  id: string;
  name: string;
  price: string;
  dreams: number;
  period: 'weekly' | 'monthly';
  isActive: boolean;
}

interface UpgradeDowngradeInfo {
  currentPlan: string;
  newPlan: string;
  isUpgrade: boolean;
}

interface DreamUsageContextType {
  dreamUsage: DreamUsage;
  subscription: Subscription | null;
  offerings: PurchasesOffering | null;
  isLoadingSubscription: boolean;
  canGenerateDream: boolean;
  useDream: () => Promise<boolean>;
  refundDream: () => Promise<void>;
  purchaseSubscription: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  upgradeOrDowngradePlan: (newPackage: PurchasesPackage) => Promise<boolean>;
  getUpgradeDowngradeInfo: (newPlanId: string) => UpgradeDowngradeInfo | null;
}

const DREAM_USAGE_KEY = '@dream_usage';
const SUBSCRIPTION_KEY = '@subscription_info';
const MAX_ROLLOVER_DREAMS = 12; // 🔥 NEW: Maximum dreams that can accumulate

const PRODUCT_IDS = {
  weekly: 'dream_weekly',
  basic: 'dream_basic_monthly',
  pro: 'dream_pro_monthly'
};

const PLAN_DETAILS = {
  [PRODUCT_IDS.weekly]: {
    name: 'Weekly',
    dreams: 1,
    price: '$3.49/week',
    period: 'weekly' as const
  },
  [PRODUCT_IDS.basic]: {
    name: 'Basic',
    dreams: 3,
    price: '$9.49/month',
    period: 'monthly' as const
  },
  [PRODUCT_IDS.pro]: {
    name: 'Pro',
    dreams: 5,
    price: '$12.49/month',
    period: 'monthly' as const
  }
};

const DreamUsageContext = createContext<DreamUsageContextType | null>(null);

// 🔥 Firestore sync helpers
async function loadUsageFromFirestore(userId: string): Promise<DreamUsage | null> {
  try {
    console.log('📥 Loading dream usage from Firestore for user:', userId);
    const usageRef = doc(db, 'dreamUsage', userId);
    const usageSnap = await getDoc(usageRef);

    if (usageSnap.exists()) {
      const data = usageSnap.data();
      const usage: DreamUsage = {
        used: data.used || 0,
        total: data.total || 0,
        resetDate: data.resetDate?.toDate?.()?.toISOString() || new Date().toISOString(),
        planId: data.planId || null,
        rollover: data.rollover || 0,  // 🔥 NEW: Load rollover
      };
      console.log('✅ Loaded from Firestore:', usage);
      return usage;
    }

    console.log('ℹ️ No Firestore usage found for user');
    return null;
  } catch (error) {
    console.error('❌ Error loading from Firestore:', error);
    return null;
  }
}

async function syncUsageToFirestore(userId: string, usage: DreamUsage): Promise<void> {
  try {
    console.log('💾 Syncing dream usage to Firestore:', usage);
    const usageRef = doc(db, 'dreamUsage', userId);

    await setDoc(usageRef, {
      used: usage.used,
      total: usage.total,
      resetDate: Timestamp.fromDate(new Date(usage.resetDate)),
      planId: usage.planId,
      rollover: usage.rollover,  // 🔥 NEW: Save rollover
      updatedAt: Timestamp.now(),
      subscription: {
        period: usage.planId?.includes('weekly') ? 'weekly' :
          usage.planId?.includes('monthly') ? 'monthly' : null,
        dreams: usage.total,
        isActive: usage.total > 0,
      },
    }, { merge: true });

    console.log('✅ Synced to Firestore successfully');
  } catch (error) {
    console.error('❌ Error syncing to Firestore:', error);
    // Don't throw - fallback to AsyncStorage
  }
}

export function DreamUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [dreamUsage, setDreamUsage] = useState<DreamUsage>({
    used: 0,
    total: 0,
    resetDate: new Date().toISOString(),
    planId: null,
    rollover: 0  // 🔥 NEW: Initialize rollover
  });

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    const initializeUser = async () => {
      if (user) {
        console.log('👤 User logged in:', user.id);

        await clearSubscriptionCache();

        await loginToRevenueCat(user.id);
        // ℹ️ Note: loadDreamUsage is now replaced by real-time listener below
        await checkSubscriptionStatus();
      } else {
        console.log('👤 No user - logging out and clearing data');
        await logoutFromRevenueCat();
        await resetUsage();
        await clearSubscriptionCache();
      }
    };

    initializeUser();
  }, [user]);

  // ✅ NEW: Real-time listener for dream usage - Auto-updates when Firestore changes!
  useEffect(() => {
    if (!user) {
      setDreamUsage({
        used: 0,
        total: 0,
        resetDate: new Date().toISOString(),
        planId: null,
        rollover: 0
      });
      return;
    }

    console.log('👂 Setting up real-time listener for dream usage...');
    const usageRef = doc(db, 'dreamUsage', user.id);

    // ✅ REAL-TIME LISTENER - Auto-updates when Firestore changes!
    const unsubscribe = onSnapshot(
      usageRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const usage: DreamUsage = {
            used: data.used || 0,
            total: data.total || 0,
            resetDate: data.resetDate?.toDate?.()?.toISOString() || new Date().toISOString(),
            planId: data.planId || null,
            rollover: data.rollover || 0,
          };
          console.log('🔄 Real-time update from Firestore:', usage);
          setDreamUsage(usage);

          // Also save to AsyncStorage for offline access
          await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(usage));
        } else {
          // Document doesn't exist, use defaults
          console.log('📝 No usage doc found, using defaults');
          const defaultUsage: DreamUsage = {
            used: 0,
            total: 0,
            resetDate: new Date().toISOString(),
            planId: null,
            rollover: 0
          };
          setDreamUsage(defaultUsage);
        }
      },
      (error) => {
        console.error('❌ Error in real-time listener:', error);
        // Fallback to AsyncStorage on error
        loadDreamUsage().catch(console.error);
      }
    );

    // Cleanup listener on unmount or user change
    return () => {
      console.log('👋 Cleaning up dream usage listener');
      unsubscribe();
    };
  }, [user]);

  const clearSubscriptionCache = async () => {
    try {
      console.log('🗑️ Clearing subscription cache...');
      await AsyncStorage.multiRemove([DREAM_USAGE_KEY, SUBSCRIPTION_KEY]);
      setSubscription(null);
      setDreamUsage({
        used: 0,
        total: 0,
        resetDate: new Date().toISOString(),
        planId: null,
        rollover: 0  // 🔥 NEW
      });
      console.log('✅ Subscription cache cleared');
    } catch (error) {
      console.error('❌ Error clearing subscription cache:', error);
    }
  };

  const loadOfferings = async () => {
    if (isSimulator) {
      console.log('📱 Skipping RevenueCat offerings on simulator');
      setIsLoadingSubscription(false);
      return;
    }

    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
        console.log('📦 RevenueCat offerings loaded:', offerings.current.identifier);
      }
    } catch (error) {
      console.error('❌ Error loading offerings:', error);
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const loginToRevenueCat = async (userId: string) => {
    if (isSimulator) {
      console.log('📱 Skipping RevenueCat login on simulator');
      return;
    }

    try {
      console.log('🔐 Logging in to RevenueCat with user:', userId);

      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log('🗑️ Cache invalidated before login');
      } catch (e) {
        console.warn('⚠️ Cache invalidation warning:', e);
      }

      await Purchases.logIn(userId);
      console.log('✅ Logged in to RevenueCat with user:', userId);
    } catch (error: any) {
      if (!error.message?.includes('already')) {
        console.error('❌ RevenueCat login error:', error);
      }
    }
  };

  const logoutFromRevenueCat = async () => {
    if (isSimulator) {
      console.log('📱 Skipping RevenueCat logout on simulator');
      return;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (!customerInfo.originalAppUserId.startsWith('$RCAnonymousID')) {
        console.log('🔓 Logging out from RevenueCat...');
        await Purchases.logOut();
        console.log('✅ Logged out from RevenueCat');

        try {
          await Purchases.invalidateCustomerInfoCache();
          console.log('🗑️ Cache cleared after logout');
        } catch (e) {
          console.warn('⚠️ Cache clear warning:', e);
        }
      }
    } catch (error: any) {
      if (!error.message?.includes('anonymous')) {
        console.error('❌ RevenueCat logout error:', error);
      }
    }
  };

  const checkSubscriptionStatus = async () => {
    if (isSimulator) {
      console.log('📱 Skipping subscription check on simulator - setting FREE plan');
      const freeUsage = {
        used: 0,
        total: 0,
        resetDate: new Date().toISOString(),
        planId: null,
        rollover: 0
      };
      setDreamUsage(freeUsage);
      setSubscription(null);
      setIsLoadingSubscription(false);
      return;
    }

    try {
      setIsLoadingSubscription(true);

      console.log('🔍 Checking subscription status for user:', user?.id);
      console.log('🗑️ Clearing RevenueCat cache...');

      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log('🗑️ Cache cleared');
      } catch (cacheError) {
        console.warn('⚠️ Cache invalidation failed:', cacheError);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔄 Syncing purchases with Apple...');
      try {
        await Purchases.syncPurchases();
      } catch (syncError) {
        console.warn('⚠️ Sync failed, continuing with cached data:', syncError);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('📥 Fetching fresh customer info...');
      const customerInfo = await Purchases.getCustomerInfo();

      const activeEntitlements = Object.keys(customerInfo.entitlements.active);

      console.log('🔍 [checkSubscriptionStatus] Active entitlements:', activeEntitlements);
      console.log('🔍 [checkSubscriptionStatus] App User ID:', customerInfo.originalAppUserId);
      console.log('🔍 [checkSubscriptionStatus] Current logged-in user:', user?.id);

      if (customerInfo.originalAppUserId !== user?.id) {
        console.warn('⚠️ RevenueCat user ID mismatch!');
        console.warn(`   RevenueCat user: ${customerInfo.originalAppUserId}`);
        console.warn(`   Logged-in user: ${user?.id}`);
        console.warn('   Treating as no subscription (FREE plan)');

        setSubscription(null);
        await AsyncStorage.removeItem(SUBSCRIPTION_KEY);

        const freeUsage = {
          used: 0,
          total: 0,
          resetDate: new Date().toISOString(),
          planId: null,
          rollover: 0  // 🔥 NEW
        };
        setDreamUsage(freeUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(freeUsage));

        await syncUsageToFirestore(user.id, freeUsage);

        return;
      }

      if (activeEntitlements.length > 0) {
        const entitlementKey = activeEntitlements[0];
        const entitlement = customerInfo.entitlements.active[entitlementKey];

        const allActiveProducts = activeEntitlements.map(key =>
          customerInfo.entitlements.active[key].productIdentifier
        );

        console.log('📦 All active products:', allActiveProducts);

        const subscriptionRanks: Record<string, number> = {
          'dream_weekly': 1,
          'dream_basic_monthly': 2,
          'dream_pro_monthly': 3
        };

        let highestProduct = allActiveProducts[0];
        let highestRank = subscriptionRanks[highestProduct] || 0;

        for (const product of allActiveProducts) {
          const rank = subscriptionRanks[product] || 0;
          console.log(`  Checking ${product}: rank ${rank}`);
          if (rank > highestRank) {
            highestRank = rank;
            highestProduct = product;
          }
        }

        console.log(`🏆 Highest subscription found: ${highestProduct} (rank ${highestRank})`);

        const productId = highestProduct || entitlement.productIdentifier;

        if (highestProduct && highestProduct !== entitlement.productIdentifier) {
          console.log(`⚠️ Multiple subscriptions active! Using ${highestProduct} instead of ${entitlement.productIdentifier}`);
        }

        console.log('✅ Active entitlement found:', entitlementKey);
        console.log('🆔 Product ID to use:', productId);

        console.log('🔍 Looking for plan details for product:', productId);
        console.log('🔍 Available PLAN_DETAILS keys:', Object.keys(PLAN_DETAILS));

        const planDetail = Object.entries(PLAN_DETAILS).find(
          ([key, details]) => {
            const matches = key === productId;
            console.log(`   Comparing: "${productId}" === "${key}" => ${matches ? '✅' : '❌'}`);
            return matches;
          }
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
          await updateDreamLimits(planId, details.dreams, details.period);

          console.log('✅ Active subscription:', details.name, `(${details.dreams} dreams)`);
        } else {
          console.error('❌ No matching plan found for product ID:', productId);
          console.error('   Available plan keys:', Object.keys(PLAN_DETAILS));
          console.error('   PLAN_DETAILS:', JSON.stringify(PLAN_DETAILS, null, 2));

          setSubscription(null);
          await AsyncStorage.removeItem(SUBSCRIPTION_KEY);
        }
      } else {
        console.log('💤 No active subscription found - User is on FREE PLAN');
        setSubscription(null);
        await AsyncStorage.removeItem(SUBSCRIPTION_KEY);

        const freeUsage = {
          used: 0,
          total: 0,
          resetDate: new Date().toISOString(),
          planId: null,
          rollover: 0  // 🔥 NEW
        };
        setDreamUsage(freeUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(freeUsage));

        if (user) {
          await syncUsageToFirestore(user.id, freeUsage);
        }

        console.log('✅ Set to FREE plan: 0 dreams available');
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);

      console.log('⚠️ Error occurred, defaulting to FREE plan');
      setSubscription(null);
      await AsyncStorage.removeItem(SUBSCRIPTION_KEY);

      const freeUsage = {
        used: 0,
        total: 0,
        resetDate: new Date().toISOString(),
        planId: null,
        rollover: 0  // 🔥 NEW
      };
      setDreamUsage(freeUsage);
      await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(freeUsage));

      if (user) {
        await syncUsageToFirestore(user.id, freeUsage);
      }
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  // 🔥 NEW: Updated to handle rollover (dreams accumulate up to 12 max)
  const updateDreamLimits = async (planId: string, dreamCount: number, period: 'weekly' | 'monthly') => {
    const currentUsage = await loadDreamUsage();
    const now = new Date();
    const resetDate = new Date(currentUsage.resetDate);

    let shouldReset = false;
    if (period === 'weekly') {
      const daysDiff = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      shouldReset = daysDiff >= 7;
    } else if (period === 'monthly') {
      const monthsDiff = (now.getFullYear() - resetDate.getFullYear()) * 12 +
        (now.getMonth() - resetDate.getMonth());
      shouldReset = monthsDiff >= 1;
    }

    const isPlanChange = currentUsage.planId !== planId && currentUsage.planId !== null;

    let newUsage: DreamUsage;
    if (shouldReset || isPlanChange || currentUsage.planId === null) {
      const nextResetDate = new Date();
      if (period === 'weekly') {
        nextResetDate.setDate(nextResetDate.getDate() + 7);
      } else {
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      }

      // 🔥 NEW: Calculate rollover from unused dreams
      let newRollover = currentUsage.rollover || 0;

      if (shouldReset && !isPlanChange) {
        // Add unused dreams to rollover
        const unusedDreams = Math.max(0, currentUsage.total - currentUsage.used);
        newRollover = Math.min(newRollover + unusedDreams, MAX_ROLLOVER_DREAMS);
        console.log(`💎 Rollover: ${unusedDreams} unused dreams added. New rollover: ${newRollover}`);
      }

      // Calculate new total (plan dreams + rollover, capped at 12)
      const newTotal = Math.min(dreamCount + newRollover, MAX_ROLLOVER_DREAMS);

      newUsage = {
        used: 0,
        total: newTotal,
        resetDate: nextResetDate.toISOString(),
        planId,
        rollover: newRollover
      };

      if (isPlanChange) {
        console.log(`🔄 Plan changed from ${currentUsage.planId} to ${planId}! Dreams reset to 0/${newTotal} (rollover: ${newRollover})`);
      } else {
        console.log(`🔄 Dreams reset! New: 0/${newTotal} (plan: ${dreamCount}, rollover: ${newRollover})`);
      }
    } else {
      newUsage = {
        ...currentUsage,
        total: Math.min(dreamCount + (currentUsage.rollover || 0), MAX_ROLLOVER_DREAMS),
        planId
      };
      console.log('📊 Dreams updated (no reset needed):', newUsage);
    }

    setDreamUsage(newUsage);
    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));

    if (user) {
      await syncUsageToFirestore(user.id, newUsage);
    }

    return newUsage;
  };

  const loadDreamUsage = async (): Promise<DreamUsage> => {
    try {
      if (user) {
        const firestoreUsage = await loadUsageFromFirestore(user.id);
        if (firestoreUsage) {
          await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(firestoreUsage));
          setDreamUsage(firestoreUsage);
          return firestoreUsage;
        }
      }

      const stored = await AsyncStorage.getItem(DREAM_USAGE_KEY);
      if (stored) {
        const usage = JSON.parse(stored);
        console.log('⚠️ Using cached AsyncStorage (Firestore unavailable)');
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
      planId: null,
      rollover: 0  // 🔥 NEW
    };
    setDreamUsage(defaultUsage);
    return defaultUsage;
  };

  const resetUsage = async () => {
    const defaultUsage = {
      used: 0,
      total: 0,
      resetDate: new Date().toISOString(),
      planId: null,
      rollover: 0  // 🔥 NEW
    };
    setDreamUsage(defaultUsage);
    setSubscription(null);
    await AsyncStorage.removeItem(DREAM_USAGE_KEY);
    await AsyncStorage.removeItem(SUBSCRIPTION_KEY);

    if (user) {
      await syncUsageToFirestore(user.id, defaultUsage);
    }

    console.log('✅ Usage reset to FREE plan');
  };

  const useDream = async (): Promise<boolean> => {
    const currentUsage = await loadDreamUsage();

    console.log('🎬 Attempting to use dream. Current:', currentUsage);

    let usageToCheck = currentUsage;

    if (subscription?.period === 'weekly') {
      const now = new Date();
      const resetDate = new Date(currentUsage.resetDate);

      if (now >= resetDate) {
        const newResetDate = new Date();
        newResetDate.setDate(newResetDate.getDate() + 7);

        // 🔥 NEW: Calculate rollover
        const unusedDreams = Math.max(0, currentUsage.total - currentUsage.used);
        const newRollover = Math.min((currentUsage.rollover || 0) + unusedDreams, MAX_ROLLOVER_DREAMS);
        const newTotal = Math.min(subscription.dreams + newRollover, MAX_ROLLOVER_DREAMS);

        const resetUsage = {
          used: 0,
          total: newTotal,
          resetDate: newResetDate.toISOString(),
          planId: subscription.id,
          rollover: newRollover
        };

        usageToCheck = resetUsage;

        setDreamUsage(resetUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(resetUsage));
        console.log(`✅ Weekly dreams reset! New usage: 0/${newTotal} (rollover: ${newRollover})`);
      }
    }
    else if (subscription?.period === 'monthly') {
      const now = new Date();
      const resetDate = new Date(currentUsage.resetDate);

      if (now >= resetDate) {
        const newResetDate = new Date();
        newResetDate.setMonth(newResetDate.getMonth() + 1);

        // 🔥 NEW: Calculate rollover
        const unusedDreams = Math.max(0, currentUsage.total - currentUsage.used);
        const newRollover = Math.min((currentUsage.rollover || 0) + unusedDreams, MAX_ROLLOVER_DREAMS);
        const newTotal = Math.min(subscription.dreams + newRollover, MAX_ROLLOVER_DREAMS);

        const resetUsage = {
          used: 0,
          total: newTotal,
          resetDate: newResetDate.toISOString(),
          planId: subscription.id,
          rollover: newRollover
        };

        usageToCheck = resetUsage;

        setDreamUsage(resetUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(resetUsage));
        console.log(`✅ Monthly dreams reset! New usage: 0/${newTotal} (rollover: ${newRollover})`);
      }
    }

    if (usageToCheck.used >= usageToCheck.total) {
      console.log(`❌ Dream limit reached: ${usageToCheck.used}/${usageToCheck.total}`);
      Alert.alert(
        'Dream Limit Reached',
        subscription
          ? `You've used all ${usageToCheck.total} dreams for this period. Next reset: ${new Date(usageToCheck.resetDate).toLocaleDateString()}`
          : 'Subscribe to generate amazing dream videos!',
        [{ text: 'OK', style: 'cancel' }]
      );
      return false;
    }

    const newUsage = {
      ...usageToCheck,
      used: usageToCheck.used + 1
    };

    setDreamUsage(newUsage);
    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));

    if (user) {
      await syncUsageToFirestore(user.id, newUsage);
    }

    console.log(`✅ Dream used: ${newUsage.used}/${newUsage.total} (rollover: ${newUsage.rollover})`);
    return true;
  };

  const refundDream = async (): Promise<void> => {
    try {
      const currentUsage = await loadDreamUsage();

      if (currentUsage.used > 0) {
        const refundedUsage = {
          ...currentUsage,
          used: currentUsage.used - 1
        };

        setDreamUsage(refundedUsage);
        await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(refundedUsage));

        if (user) {
          await syncUsageToFirestore(user.id, refundedUsage);
        }

        console.log(`✅ Dream refunded: ${refundedUsage.used}/${refundedUsage.total}`);
      } else {
        console.log('⚠️ No dreams to refund (usage is already 0)');
      }
    } catch (error) {
      console.error('❌ Error refunding dream:', error);
    }
  };

  const purchaseSubscription = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
    try {
      if (isLoadingSubscription) {
        console.log('⚠️ Purchase already in progress, ignoring duplicate request');
        return false;
      }

      console.log('💳 Attempting to purchase:', packageToPurchase.identifier);
      console.log('💳 Package product ID:', packageToPurchase.product.identifier);

      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      setIsLoadingSubscription(true);

      console.log('🔄 Purchase completed, syncing with Apple...');

      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log('🗑️ Cache cleared');
      } catch (e) {
        console.warn('⚠️ Cache clear failed:', e);
      }
      await new Promise(resolve => setTimeout(resolve, 500));

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Sync attempt ${attempt}/3...`);

          await Purchases.syncPurchases();

          await new Promise(resolve => setTimeout(resolve, 3000));

          const freshCustomerInfo = await Purchases.getCustomerInfo();
          const activeEntitlements = Object.keys(freshCustomerInfo.entitlements.active);

          console.log(`🔍 Active entitlements (attempt ${attempt}):`, activeEntitlements);

          if (activeEntitlements.length > 0) {
            const entitlementKey = activeEntitlements[0];
            const entitlement = freshCustomerInfo.entitlements.active[entitlementKey];

            const allActiveProducts = activeEntitlements.map(key =>
              freshCustomerInfo.entitlements.active[key].productIdentifier
            );

            console.log('📦 All active products:', allActiveProducts);

            const subscriptionRanks: Record<string, number> = {
              'dream_weekly': 1,
              'dream_basic_monthly': 2,
              'dream_pro_monthly': 3
            };

            let highestProduct = allActiveProducts[0];
            let highestRank = subscriptionRanks[highestProduct] || 0;

            for (const product of allActiveProducts) {
              const rank = subscriptionRanks[product] || 0;
              console.log(`  Checking ${product}: rank ${rank}`);
              if (rank > highestRank) {
                highestRank = rank;
                highestProduct = product;
              }
            }

            console.log(`🏆 Highest subscription found: ${highestProduct} (rank ${highestRank})`);

            const productId = highestProduct || entitlement.productIdentifier;

            if (highestProduct && highestProduct !== entitlement.productIdentifier) {
              console.log(`⚠️ Multiple subscriptions active! Using ${highestProduct} instead of ${entitlement.productIdentifier}`);
            }

            console.log('🆔 Product ID from RevenueCat:', productId);

            console.log('🔍 Looking for plan details for product:', productId);
            console.log('🔍 Available PLAN_DETAILS keys:', Object.keys(PLAN_DETAILS));

            const planDetail = Object.entries(PLAN_DETAILS).find(
              ([key, details]) => {
                const matches = key === productId;
                console.log(`   Comparing: "${productId}" === "${key}" => ${matches ? '✅' : '❌'}`);
                return matches;
              }
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
              await updateDreamLimits(planId, details.dreams, details.period);

              console.log('✅ Subscription activated:', details.name, `(${details.dreams} dreams)`);

              // 🔥 REFERRAL TRACKING - Track subscription attribution
              try {
                const referralCode = await AsyncStorage.getItem('referralCode');

                if (referralCode) {
                  // Get subscription amount based on tier
                  const subscriptionPrices: { [key: string]: number } = {
                    'dream_weekly': 3.49,
                    'dream_basic_monthly': 9.49,
                    'dream_pro_monthly': 12.49
                  };
                  const amount = subscriptionPrices[planId] || 3.49;

                  // Update referral stats
                  await setDoc(
                    doc(db, 'referrals', referralCode),
                    {
                      subscriptions: increment(1),
                      revenue: increment(amount),
                      lastSubscription: serverTimestamp()
                    },
                    { merge: true }
                  );

                  // Log individual conversion
                  await addDoc(collection(db, 'conversions'), {
                    referralCode,
                    userId: user?.id || auth.currentUser?.uid,
                    planId,
                    amount,
                    timestamp: serverTimestamp()
                  });

                  console.log('✅ Subscription tracked for referral:', referralCode, `($${amount})`);
                }
              } catch (referralError) {
                // Don't block purchase success if referral tracking fails
                console.error('⚠️ Referral tracking error (non-blocking):', referralError);
              }

              return true;
            }
          }
        } catch (syncError) {
          console.error(`❌ Sync attempt ${attempt} failed:`, syncError);
          if (attempt === 3) throw syncError;
        }
      }

      console.warn('⚠️ Purchase completed but no active entitlements found after 3 attempts');
      Alert.alert(
        'Purchase Processed',
        'Your purchase was completed. Please wait a moment and tap "Restore Purchases" to activate your subscription.',
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('ℹ️ User cancelled purchase');
      } else {
        console.error('❌ Purchase error:', error);

        let errorMessage = 'Unable to complete purchase. Please try again.';

        if (error.message?.includes('App Store')) {
          errorMessage = 'Connection to App Store failed. Please check your internet and try again.';
        } else if (error.message?.includes('already in progress')) {
          errorMessage = 'A purchase is already in progress. Please wait a moment.';
        }

        Alert.alert('Purchase Failed', errorMessage);
      }
      return false;
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const getUpgradeDowngradeInfo = useCallback((newPlanId: string): UpgradeDowngradeInfo | null => {
    if (!subscription) return null;

    const PLAN_RANKS: Record<string, number> = {
      'dream_weekly': 1,
      'dream_basic_monthly': 2,
      'dream_pro_monthly': 3,
    };

    const currentRank = PLAN_RANKS[subscription.id] || 0;
    const newRank = PLAN_RANKS[newPlanId] || 0;

    return {
      currentPlan: subscription.name,
      newPlan: PLAN_DETAILS[newPlanId]?.name || newPlanId,
      isUpgrade: newRank > currentRank,
    };
  }, [subscription]);

  const upgradeOrDowngradePlan = useCallback(async (newPackage: PurchasesPackage): Promise<boolean> => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to manage subscriptions');
      return false;
    }

    try {
      const newPlanId = newPackage.product.identifier;
      const changeInfo = getUpgradeDowngradeInfo(newPlanId);

      if (!changeInfo) {
        return await purchaseSubscription(newPackage);
      }

      const action = changeInfo.isUpgrade ? 'upgrade to' : 'downgrade to';

      return new Promise((resolve) => {
        Alert.alert(
          `${changeInfo.isUpgrade ? 'Upgrade' : 'Downgrade'} Plan?`,
          `You'll ${action} ${changeInfo.newPlan}.\n\n${changeInfo.isUpgrade
            ? '✨ Your new plan will start immediately and you\'ll be charged the prorated difference.'
            : '⏰ Your new plan will start at the end of your current billing period.'
          }`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: changeInfo.isUpgrade ? 'Upgrade Now' : 'Downgrade',
              style: 'default',
              onPress: async () => {
                try {
                  console.log(`🔄 Changing plan from ${changeInfo.currentPlan} to ${changeInfo.newPlan}...`);

                  const { customerInfo } = await Purchases.purchasePackage(newPackage);

                  console.log('✅ Plan change successful');

                  const newPlanDetails = PLAN_DETAILS[newPlanId];
                  if (newPlanDetails) {
                    const now = new Date();
                    const resetDate = new Date(now);

                    if (newPlanId === 'dream_weekly') {
                      resetDate.setDate(resetDate.getDate() + 7);
                    } else {
                      resetDate.setMonth(resetDate.getMonth() + 1);
                    }

                    // 🔥 NEW: Add CURRENT unused dreams to rollover when changing plans
                    const currentUsage = await loadDreamUsage();
                    const currentUnused = Math.max(0, currentUsage.total - currentUsage.used);

                    // Add current unused + existing rollover (cap at 12)
                    const newRollover = Math.min(
                      (currentUsage.rollover || 0) + currentUnused,
                      MAX_ROLLOVER_DREAMS
                    );

                    // New total = plan dreams + rollover (cap at 12)
                    const newTotal = Math.min(
                      newPlanDetails.dreams + newRollover,
                      MAX_ROLLOVER_DREAMS
                    );

                    const newUsage = {
                      planId: newPlanId,
                      total: newTotal,
                      used: 0,
                      resetDate: resetDate.toISOString(),
                      rollover: newRollover,
                    };

                    const newSub: Subscription = {
                      id: newPlanId,
                      name: newPlanDetails.name,
                      price: newPlanDetails.price,
                      dreams: newPlanDetails.dreams,
                      period: newPlanDetails.period,
                      isActive: true,
                    };

                    setDreamUsage(newUsage);
                    setSubscription(newSub);

                    await AsyncStorage.setItem(DREAM_USAGE_KEY, JSON.stringify(newUsage));
                    await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(newSub));

                    if (user) {
                      await syncUsageToFirestore(user.id, newUsage);
                    }

                    console.log(`✅ Plan changed: ${currentUnused} unused dreams added to rollover (${newRollover} total)`);
                    console.log(`💎 New total: ${newTotal} dreams (${newPlanDetails.dreams} plan + ${newRollover} rollover)`);

                    Alert.alert(
                      'Success!',
                      `You've ${action} ${changeInfo.newPlan}! ${currentUnused > 0 ? `Your ${currentUnused} unused dream${currentUnused > 1 ? 's have' : ' has'} been added to your rollover.` : ''}\n\nYou now have ${newTotal} dream${newTotal > 1 ? 's' : ''} available!`,
                      [{ text: 'Great!', style: 'default' }]
                    );
                  }

                  resolve(true);
                } catch (error: any) {
                  console.error('❌ Plan change error:', error);

                  if (error.userCancelled) {
                    console.log('ℹ️ User cancelled plan change');
                  } else {
                    Alert.alert(
                      'Plan Change Failed',
                      error.message || 'Failed to change plan. Please try again.',
                      [{ text: 'OK' }]
                    );
                  }

                  resolve(false);
                }
              },
            },
          ]
        );
      });

    } catch (error) {
      console.error('❌ Error in upgradeOrDowngradePlan:', error);
      return false;
    }
  }, [user, subscription, purchaseSubscription, getUpgradeDowngradeInfo]);

  const restorePurchases = async () => {
    try {
      setIsLoadingSubscription(true);
      console.log('🔄 Restoring purchases...');

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Restore attempt ${attempt}/3...`);

          await Purchases.restorePurchases();
          await Purchases.syncPurchases();

          await new Promise(resolve => setTimeout(resolve, 2000));

          const freshCustomerInfo = await Purchases.getCustomerInfo();
          const activeEntitlements = Object.keys(freshCustomerInfo.entitlements.active);

          console.log(`🔍 Active entitlements after restore (attempt ${attempt}):`, activeEntitlements);

          if (activeEntitlements.length > 0) {
            await checkSubscriptionStatus();

            Alert.alert('Success! 🎉', 'Your purchases have been restored.');
            return;
          }
        } catch (restoreError) {
          console.error(`❌ Restore attempt ${attempt} failed:`, restoreError);
          if (attempt === 3) throw restoreError;
        }
      }

      Alert.alert(
        'No Purchases Found',
        'No previous purchases were found for this account.\n\nIf you just made a purchase, please wait a minute and try again.'
      );
    } catch (error) {
      console.error('❌ Restore error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    console.log('🔄 Manually refreshing subscription status...');
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
        refundDream,
        purchaseSubscription,
        restorePurchases,
        refreshSubscriptionStatus,
        upgradeOrDowngradePlan,
        getUpgradeDowngradeInfo,
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
