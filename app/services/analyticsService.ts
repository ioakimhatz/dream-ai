// app/services/analyticsService.ts
// Analytics service for Meta (Facebook) SDK + TikTok Events API
// TikTok tracking via server-side Events API (tiktokTracking.ts)

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { trackTikTokPurchase } from './tiktokTracking';

// ====== SDK Imports (lazy loaded) ======
let AppEventsLogger: any = null;
let Settings: any = null;

// Track initialization state
let isInitialized = false;
let hasTrackingPermission = false;

// Your SDK credentials
const FACEBOOK_APP_ID = '1426912852258576'; // From Meta Events Manager

/**
 * Initialize SDKs - Call this ONCE at app startup after ATT permission
 */
export async function initializeAnalytics(): Promise<void> {
  if (isInitialized) {
    console.log('📊 Analytics already initialized');
    return;
  }

  // Skip on simulator
  if (!Device.isDevice) {
    console.log('📊 Analytics: Skipping on simulator');
    return;
  }

  try {
    // Request App Tracking Transparency permission (iOS 14.5+)
    const { status } = await requestTrackingPermissionsAsync();
    hasTrackingPermission = status === 'granted';

    console.log('📊 Tracking permission status:', status);

    // Initialize Facebook SDK
    await initializeFacebook();

    isInitialized = true;
    console.log('📊 Analytics SDKs initialized successfully');
    console.log('📊 TikTok SDK initialized natively in AppDelegate.swift');
  } catch (error) {
    console.error('📊 Analytics initialization error:', error);
  }
}

/**
 * Initialize Facebook (Meta) SDK
 */
async function initializeFacebook(): Promise<void> {
  try {
    const fbsdk = require('react-native-fbsdk-next');
    AppEventsLogger = fbsdk.AppEventsLogger;
    Settings = fbsdk.Settings;

    // Initialize Facebook SDK
    await Settings.initializeSDK();

    // Set ATT status
    if (hasTrackingPermission) {
      Settings.setAdvertiserTrackingEnabled(true);
    } else {
      Settings.setAdvertiserTrackingEnabled(false);
    }

    // Enable auto-logging
    Settings.setAutoLogAppEventsEnabled(true);

    console.log('✅ Facebook SDK initialized');
  } catch (error) {
    console.error('❌ Facebook SDK init error:', error);
  }
}

// ====== EVENT TRACKING FUNCTIONS ======

/**
 * Track app install - Called once when user first opens the app
 */
export function trackAppInstall(): void {
  if (!Device.isDevice) return;

  try {
    // TikTok: Automatic install tracking via native SDK in AppDelegate
    // No manual call needed - SDK handles InstallApp event automatically

    // Facebook: Log app activate event
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_activate_app');
    }

    console.log('📊 Tracked: App Install/Activate');
  } catch (error) {
    console.error('📊 Track install error:', error);
  }
}

/**
 * Track when user completes registration/sign up
 */
export function trackRegistration(method: 'apple' | 'google' | 'email'): void {
  if (!Device.isDevice) return;

  try {
    // TikTok: Registration tracked via native SDK automatic events

    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_complete_registration', {
        fb_registration_method: method,
      });
    }

    console.log('📊 Tracked: Registration via', method);
  } catch (error) {
    console.error('📊 Track registration error:', error);
  }
}

/**
 * Track first dream video generated (key conversion event)
 */
export function trackFirstDreamGenerated(): void {
  if (!Device.isDevice) return;

  try {
    // Facebook - Achieved Level (represents milestone)
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_level_achieved', {
        fb_level: 'first_dream_generated',
      });
    }

    console.log('📊 Tracked: First Dream Generated');
  } catch (error) {
    console.error('📊 Track first dream error:', error);
  }
}

/**
 * Track any dream video generated
 */
export function trackDreamGenerated(dreamId: string): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('DreamGenerated', {
        dream_id: dreamId,
      });
    }

    console.log('📊 Tracked: Dream Generated', dreamId);
  } catch (error) {
    console.error('📊 Track dream error:', error);
  }
}

/**
 * Track trial started (if you have a trial period)
 */
export function trackTrialStarted(planId: string): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_start_trial', {
        fb_content_id: planId,
      });
    }

    console.log('📊 Tracked: Trial Started for', planId);
  } catch (error) {
    console.error('📊 Track trial error:', error);
  }
}

/**
 * Track subscription purchase - CRITICAL for ROAS optimization
 * Tracks to both TikTok (Events API) and Meta (Facebook SDK)
 */
export async function trackSubscriptionPurchased(
  planId: string,
  planName: string,
  price: number,
  currency: string = 'USD',
  userId?: string
): Promise<void> {
  if (!Device.isDevice) return;

  try {
    // TikTok: Purchase event via server-side Events API
    if (userId) {
      try {
        await trackTikTokPurchase(userId, price, currency, planId);
        console.log('📊 TikTok Purchase event sent');
      } catch (tikTokError) {
        console.error('📊 TikTok purchase tracking error:', tikTokError);
      }
    }

    // Facebook - Purchase event with value
    if (AppEventsLogger) {
      AppEventsLogger.logPurchase(price, currency, {
        fb_content_type: 'subscription',
        fb_content_id: planId,
        fb_content: JSON.stringify([{ id: planId, quantity: 1 }]),
      });
    }

    console.log('📊 Tracked: Subscription Purchase', planName, '$' + price);
  } catch (error) {
    console.error('📊 Track subscription error:', error);
  }
}

/**
 * Track one-time purchase (dream credits)
 * Tracks to both TikTok (Events API) and Meta (Facebook SDK)
 */
export async function trackCreditsPurchased(
  productId: string,
  credits: number,
  price: number,
  currency: string = 'USD',
  userId?: string
): Promise<void> {
  if (!Device.isDevice) return;

  try {
    // TikTok: Purchase event via server-side Events API
    if (userId) {
      try {
        await trackTikTokPurchase(userId, price, currency, productId);
        console.log('📊 TikTok Credits Purchase event sent');
      } catch (tikTokError) {
        console.error('📊 TikTok credits tracking error:', tikTokError);
      }
    }

    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logPurchase(price, currency, {
        fb_content_type: 'credits',
        fb_content_id: productId,
        fb_num_items: credits,
      });
    }

    console.log('📊 Tracked: Credits Purchase', credits, 'credits for $' + price);
  } catch (error) {
    console.error('📊 Track credits purchase error:', error);
  }
}

/**
 * Track subscription renewal (for LTV tracking)
 */
export function trackSubscriptionRenewed(
  planId: string,
  price: number,
  currency: string = 'USD'
): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_subscription', {
        fb_content_id: planId,
        _valueToSum: price,
        fb_currency: currency,
      });
    }

    console.log('📊 Tracked: Subscription Renewed', planId, '$' + price);
  } catch (error) {
    console.error('📊 Track renewal error:', error);
  }
}

/**
 * Track view of subscription/paywall screen
 */
export function trackViewedPaywall(): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_content_view', {
        fb_content_type: 'paywall',
        fb_content_id: 'subscription_screen',
      });
    }

    console.log('📊 Tracked: Viewed Paywall');
  } catch (error) {
    console.error('📊 Track paywall view error:', error);
  }
}

/**
 * Track add to cart (when user selects a plan)
 */
export function trackAddToCart(
  planId: string,
  price: number,
  currency: string = 'USD'
): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_add_to_cart', {
        fb_content_id: planId,
        _valueToSum: price,
        fb_currency: currency,
      });
    }

    console.log('📊 Tracked: Add to Cart', planId, '$' + price);
  } catch (error) {
    console.error('📊 Track add to cart error:', error);
  }
}

/**
 * Track initiate checkout (when purchase flow begins)
 */
export function trackInitiateCheckout(
  planId: string,
  price: number,
  currency: string = 'USD'
): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.logEvent('fb_mobile_initiated_checkout', {
        fb_content_id: planId,
        _valueToSum: price,
        fb_currency: currency,
      });
    }

    console.log('📊 Tracked: Initiate Checkout', planId, '$' + price);
  } catch (error) {
    console.error('📊 Track checkout error:', error);
  }
}

/**
 * Set user properties for better targeting
 */
export function setUserProperties(userId: string, email?: string): void {
  if (!Device.isDevice) return;

  try {
    // Facebook - Set user ID
    if (AppEventsLogger) {
      AppEventsLogger.setUserID(userId);
      if (email) {
        AppEventsLogger.setUserData({ email });
      }
    }

    console.log('📊 Set user properties for:', userId);
  } catch (error) {
    console.error('📊 Set user properties error:', error);
  }
}

/**
 * Clear user data on logout
 */
export function clearUserData(): void {
  if (!Device.isDevice) return;

  try {
    // Facebook
    if (AppEventsLogger) {
      AppEventsLogger.clearUserID();
      AppEventsLogger.clearUserData();
    }

    console.log('📊 Cleared user data');
  } catch (error) {
    console.error('📊 Clear user data error:', error);
  }
}

// Export helper to check tracking status
export function isTrackingEnabled(): boolean {
  return hasTrackingPermission;
}

export function isAnalyticsInitialized(): boolean {
  return isInitialized;
}
