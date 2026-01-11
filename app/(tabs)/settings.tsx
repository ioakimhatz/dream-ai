// app/(tabs)/settings.tsx - FIXED: Proper account deletion with Firebase Auth + Firestore

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

// ✅ FIX: Reliable simulator detection (works on iPhone 16 Pro Max)
// TRUE on simulator/emulator, FALSE on physical device
const isSimulator = !Constants.isDevice;

let Notifications: any = null;
if (!isSimulator) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('📱 Notifications not available on simulator');
  }
}
import { useDreamUsage } from '../contexts/DreamUsageContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { registerForPushNotifications, saveFCMToken, sendTestNotification } from '../utils/notificationService';

// 🔥 NEW: Import Firebase functions for account deletion
import { deleteUser } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { getFirestore, doc, deleteDoc, collection, getDocs, query, where, getDoc, setDoc } from 'firebase/firestore';
import Purchases from 'react-native-purchases';

const firestore = getFirestore();

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const { language, setLanguage } = useLanguage();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [wakeTime, setWakeTime] = useState<string>('07:00');
  const [wakeTimeSource, setWakeTimeSource] = useState<string>('manual');

  const [isPurchasing, setIsPurchasing] = useState(false);

  const { user, signOut, updateUserName } = useAuth();
  const {
    dreamUsage,
    subscription,
    offerings,
    isLoadingSubscription,
    purchaseSubscription,
    restorePurchases,
    upgradeOrDowngradePlan,
    purchaseCustomDreams,
  } = useDreamUsage();

  useEffect(() => {
    loadNotificationState();
    loadWakeTime();
  }, [user]);

  const loadWakeTime = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(firestore, 'users', user.id));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.wakeTime) {
          setWakeTime(userData.wakeTime);
        }
        if (userData.wakeTimeSource) {
          setWakeTimeSource(userData.wakeTimeSource);
        }
      }
    } catch (error) {
      console.error('Failed to load wake time:', error);
    }
  };

  const loadNotificationState = async () => {
    if (isSimulator || !Notifications) {
      console.log('📱 Skipping notification state on simulator');
      setNotificationsEnabled(false);
      setNotificationPermissionStatus('denied');
      return;
    }

    try {
      // Check OS permissions
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationPermissionStatus(status);

      // Check user preference
      const preference = await AsyncStorage.getItem('notifications_enabled');

      // Only enable if BOTH permission granted AND user hasn't explicitly disabled it
      const enabled = status === 'granted' && preference !== 'false';
      setNotificationsEnabled(enabled);

      console.log('📱 Notification state loaded:', { status, preference, enabled });
    } catch (e) {
      console.error('Failed to load notification settings:', e);
    }
  };

  useEffect(() => {
    if (user?.photo) setUserAvatar(user.photo);
  }, [user]);

  const handleTestNotification = async () => {
    if (isSimulator || !Notifications) {
      Alert.alert('Simulator', 'Notifications are not available on iOS simulator. Please test on a real device.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to test notifications.');
      return;
    }

    try {
      console.log('📱 Sending test notification...');
      const success = await sendTestNotification(user.id);

      if (success) {
        Alert.alert(
          '✅ Test Sent',
          'Check your notifications! The test notification should appear shortly.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Failed to Send',
          'Could not send test notification. Make sure notifications are enabled.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        'Failed to send test notification. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleWakeTimeChange = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to set your wake time.');
      return;
    }

    Alert.prompt(
      '⏰ Wake Up Time',
      'What time do you usually wake up? (Format: HH:MM)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newWakeTime?: string) => {
            if (newWakeTime) {
              // Validate time format
              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(newWakeTime)) {
                Alert.alert('Invalid Format', 'Please use HH:MM format (e.g., 07:00)');
                return;
              }

              try {
                await setDoc(
                  doc(firestore, 'users', user.id),
                  {
                    wakeTime: newWakeTime,
                    wakeTimeSource: 'manual',
                  },
                  { merge: true }
                );
                setWakeTime(newWakeTime);
                setWakeTimeSource('manual');
                Alert.alert('✅ Saved', `Wake time set to ${newWakeTime}`);
              } catch (error) {
                console.error('Failed to save wake time:', error);
                Alert.alert('Error', 'Failed to save wake time. Please try again.');
              }
            }
          }
        }
      ],
      'plain-text',
      wakeTime
    );
  };

  const handleConnectHealthKit = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in first.');
      return;
    }

    try {
      const { requestHealthKitPermission, getSleepSchedule } = await import('../services/healthKitService');
      const granted = await requestHealthKitPermission();

      if (granted) {
        const schedule = await getSleepSchedule();
        if (schedule) {
          await setDoc(
            doc(firestore, 'users', user.id),
            {
              wakeTime: schedule.weekday.wakeup,
              wakeTimeSource: 'healthkit',
              sleepSchedule: schedule,
            },
            { merge: true }
          );
          setWakeTime(schedule.weekday.wakeup);
          setWakeTimeSource('healthkit');
          Alert.alert('✅ Connected', `Wake time set to ${schedule.weekday.wakeup} from Health app`);
        } else {
          Alert.alert('No Data', 'No sleep data found in Health app. Please use manual entry.');
        }
      }
    } catch (error) {
      console.error('Failed to connect HealthKit:', error);
      Alert.alert('Error', 'Failed to connect to Health app. Please try again.');
    }
  };

  const handleDisconnectHealthKit = async () => {
    if (!user) return;

    Alert.alert(
      'Disconnect Health App?',
      'Your wake time will switch to manual entry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const { disconnectHealthKit } = await import('../utils/healthKitSync');
              await disconnectHealthKit(user.id);
              setWakeTimeSource('manual');
              Alert.alert('✅ Disconnected', 'Switched to manual wake time entry');
            } catch (error) {
              console.error('Failed to disconnect HealthKit:', error);
              Alert.alert('Error', 'Failed to disconnect. Please try again.');
            }
          }
        }
      ]
    );
  };

  const updateNotifications = async (value: boolean) => {
    if (isSimulator || !Notifications) {
      Alert.alert('Simulator', 'Notifications are not available on iOS simulator. Please test on a real device.');
      return;
    }

    try {
      if (value) {
        // User wants to enable notifications
        console.log('📱 Enabling notifications...');

        // Register for push notifications (handles permission request)
        const token = await registerForPushNotifications();

        if (token) {
          // Successfully registered - save token if user is signed in
          if (user?.id) {
            try {
              await saveFCMToken(user.id, token);
              console.log('✅ Push token saved for user');
            } catch (error) {
              console.warn('⚠️ Failed to save push token, continuing anyway');
            }
          }

          // Save preference
          await AsyncStorage.setItem('notifications_enabled', 'true');
          setNotificationsEnabled(true);
          setNotificationPermissionStatus('granted');

          Alert.alert(
            '✅ Notifications Enabled',
            'You will now receive notifications when your dream videos are ready!'
          );
          console.log('✅ Notifications enabled successfully');
        } else {
          // Permission denied
          setNotificationsEnabled(false);
          Alert.alert(
            'Permission Denied',
            'Please enable notifications in your device settings to receive dream updates.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          console.log('❌ Notification permission denied');
        }
      } else {
        // User wants to disable notifications
        console.log('📱 Disabling notifications...');
        await AsyncStorage.setItem('notifications_enabled', 'false');
        setNotificationsEnabled(false);

        Alert.alert(
          'Notifications Disabled',
          'You will no longer receive notifications. You can re-enable them anytime in Settings.'
        );
        console.log('✅ Notifications disabled');
      }
    } catch (e) {
      console.error('❌ Failed to update notifications:', e);
      Alert.alert(
        'Error',
        'Failed to update notification settings. Please try again.'
      );
    }
  };

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      await setLanguage(languageCode);
      setShowLanguageModal(false);
      console.log('✅ Language updated to:', languageCode);
    } catch (e) {
      console.error('Failed to save language:', e);
      Alert.alert('Error', 'Failed to update language');
    }
  };

  const handleLanguagePress = () => {
    setShowLanguageModal(true);
  };

  const handlePrivacyPress = () => router.push('/privacy-policy');

  const handleTermsPress = () => router.push('/terms-of-service');

  const handleEditAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUserAvatar(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error selecting avatar:', e);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleEditName = () => {
    setTempName(user?.name || '');
    setShowEditNameModal(true);
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    await updateUserName(tempName.trim());
    setShowEditNameModal(false);
  };

  const handleSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);

  // 🔥 COMPLETELY REWRITTEN: Proper account deletion with Firebase + Firestore
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. You won\'t be able to sign in again.\n\nSubscriptions will stay active until canceled in App Store settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user || !auth.currentUser) {
                Alert.alert('Error', 'Please sign in first');
                return;
              }

              console.log('🗑️ Starting account deletion...');

              // Step 1: Try to delete Firestore user data (optional)
              try {
                const userDocRef = doc(firestore, 'users', user.id);
                await deleteDoc(userDocRef);
                console.log('✅ Firestore deleted');

                try {
                  const dreamsRef = collection(firestore, 'users', user.id, 'dreams');
                  const dreamsSnapshot = await getDocs(dreamsRef);
                  for (const dreamDoc of dreamsSnapshot.docs) {
                    await deleteDoc(dreamDoc.ref);
                  }
                  console.log('✅ Subcollections deleted');
                } catch (subError) {
                  console.warn('⚠️ Subcollections skip:', subError);
                }
              } catch (firestoreError) {
                console.warn('⚠️ Firestore skip:', firestoreError);
              }

              // Step 2: Clear local data
              console.log('💾 Clearing local data...');
              const keysToRemove = [
                'user',
                'hasCompletedOnboarding',
                'notifications',
                'language',
                'temp_otp',
                'temp_otp_email',
                'temp_otp_expires',
                '@dream_usage',
                '@subscription_info',
              ];
              await AsyncStorage.multiRemove(keysToRemove);
              console.log('✅ Local data cleared');

              // Step 3: Sign out from services
              try {
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                if (await GoogleSignin.isSignedIn()) {
                  await GoogleSignin.signOut();
                }
              } catch (e) {
                console.log('⚠️ Google skip');
              }

              try {
                const customerInfo = await Purchases.getCustomerInfo();
                if (!customerInfo.originalAppUserId.startsWith('$RCAnonymousID')) {
                  await Purchases.logOut();
                }
              } catch (e) {
                console.warn('⚠️ RevenueCat skip');
              }

              // Step 4: Delete account (CRITICAL)
              console.log('🔥 Deleting account...');
              try {
                await deleteUser(auth.currentUser);
                console.log('✅ ✅ ✅ Account DELETED');
              } catch (authError: any) {
                console.error('❌ Delete error:', authError);

                if (authError.code === 'auth/requires-recent-login') {
                  Alert.alert(
                    'Security Check',
                    'For security, please sign out and sign in again, then try deleting immediately.',
                    [{ text: 'OK', onPress: () => signOut() }]
                  );
                  return;
                }

                throw authError;
              }

              // Success - navigate away
              router.replace('/welcome');

              setTimeout(() => {
                Alert.alert(
                  'Account Deleted',
                  'Your account has been permanently deleted.',
                  [{ text: 'OK' }]
                );
              }, 500);

              console.log('✅ Complete!');
            } catch (error: any) {
              console.error('❌ Failed:', error);

              let errorMessage = 'Something went wrong. Please try again.';

              if (error.code === 'auth/requires-recent-login') {
                errorMessage = 'Please sign in again and try immediately.';
              } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Check your internet connection.';
              }

              Alert.alert('Delete Failed', errorMessage, [{ text: 'OK' }]);
            }
          }
        },
      ]
    );
  };

  const handleSignIn = () => router.push('/(auth)/signin');

  const handleSelectPlan = async (planType: 'weekly' | 'basic' | 'custom', quantity?: number) => {
    if (isPurchasing) {
      console.log('⚠️ Purchase already in progress, ignoring tap');
      return;
    }

    // Handle custom plan purchase
    if (planType === 'custom' && quantity) {
      console.log('💳 Purchasing custom dreams from settings:', quantity);

      setIsPurchasing(true);

      try {
        const success = await purchaseCustomDreams(quantity);

        if (success) {
          setShowSubscriptionModal(false);
        }
      } catch (error) {
        console.error('❌ Purchase error in settings:', error);
      } finally {
        setIsPurchasing(false);
      }

      return;
    }

    const productMap: Record<string, string> = {
      weekly: 'dream_weekly',
      basic: 'dream_basic_monthly',
    };

    const productId = productMap[planType];

    if (subscription?.id === productId) {
      Alert.alert('Already Subscribed', `You're already on the ${subscription.name} plan!`);
      return;
    }

    if (!offerings?.availablePackages) {
      Alert.alert('Error', 'Subscription plans are not available. Please try again later.');
      return;
    }

    console.log('💳 [Settings] Looking for product ID:', productId);

    const packageToPurchase = offerings.availablePackages.find(
      (p) => p.product.identifier === productId
    );

    if (!packageToPurchase) {
      Alert.alert('Error', 'Selected plan is not available. Please try again.');
      return;
    }

    console.log('✅ [Settings] Found package:', packageToPurchase.identifier);

    setIsPurchasing(true);

    try {
      let success = false;

      if (subscription) {
        console.log('🔄 User has subscription, using upgrade/downgrade flow');
        success = await upgradeOrDowngradePlan(packageToPurchase);
      } else {
        console.log('💳 New subscriber, using regular purchase flow');
        success = await purchaseSubscription(packageToPurchase);
      }

      if (success) {
        setShowSubscriptionModal(false);
        console.log('✅ Modal closed. Subscription is now:', subscription?.name);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const getDaysUntilReset = () => {
    const resetDate = new Date(dreamUsage.resetDate);
    const now = new Date();

    const days = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const getCurrentLanguageName = () => {
    return SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English';
  };

  const getDisplayName = () => {
    if (!user) return 'Tap to set name';

    if (
      !user.name ||
      user.name === 'User' ||
      user.name === 'Apple User' ||
      user.name.length > 30 ||
      user.name.includes('.eba') ||
      user.name.includes('.403')
    ) {
      return 'Tap to set name';
    }

    return user.name;
  };

  const getDisplayEmail = () => {
    if (!user) return 'and username';

    if (user.email.includes('privaterelay.appleid.com') || user.email.length > 50) {
      return 'and username';
    }

    return user.email;
  };

  return (
    <>
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 28
          }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === 'ios'}
          alwaysBounceVertical={Platform.OS === 'ios'}
          overScrollMode={Platform.OS === 'android' ? 'never' : 'always'}
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 'normal'}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Make Dream AI feel like yours</Text>

          {user ? (
            <View style={styles.card}>
              <Text style={styles.section}>Profile</Text>

              <TouchableOpacity onPress={handleEditName} style={styles.profileSection} activeOpacity={0.7}>
                <View style={styles.avatarContainer}>
                  {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditAvatar();
                    }}
                    style={styles.editBadge}
                  >
                    <Text style={styles.editBadgeText}>✎</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.nameContainer}>
                  <Text style={styles.tapToSetText}>{getDisplayName()}</Text>
                  <Text style={styles.tapToSetSubtext}>{getDisplayEmail()}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.row}>
                <Text style={styles.rowTitle}>Notifications</Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={updateNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#7278E6' }}
                  thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#E5E7EB"
                />
              </View>

              {/* Test Notification Button */}
              {notificationsEnabled && (
                <TouchableOpacity
                  style={[styles.row, { marginTop: 8 }]}
                  onPress={handleTestNotification}
                >
                  <Text style={styles.rowTitle}>Send Test Notification</Text>
                  <Ionicons name="notifications-outline" size={22} color="#7278E6" />
                </TouchableOpacity>
              )}

              {/* Wake Time Setting */}
              {notificationsEnabled && (
                <>
                  <TouchableOpacity
                    style={[styles.row, { marginTop: 8 }]}
                    onPress={handleWakeTimeChange}
                  >
                    <Text style={styles.rowTitle}>Wake Up Time: {wakeTime}</Text>
                    <Ionicons name="time-outline" size={22} color="#7278E6" />
                  </TouchableOpacity>

                  {/* Wake Time Source */}
                  <View style={[styles.row, { marginTop: 8, opacity: 0.7 }]}>
                    <Text style={styles.rowTitle}>
                      Source: {wakeTimeSource === 'healthkit' ? 'Health App' : 'Manual'}
                    </Text>
                    {wakeTimeSource === 'healthkit' ? (
                      <Ionicons name="fitness-outline" size={22} color="#7278E6" />
                    ) : (
                      <Ionicons name="create-outline" size={22} color="#7278E6" />
                    )}
                  </View>

                  {/* Connect/Disconnect HealthKit */}
                  {wakeTimeSource === 'manual' ? (
                    <TouchableOpacity
                      style={[styles.row, { marginTop: 8 }]}
                      onPress={handleConnectHealthKit}
                    >
                      <Text style={styles.rowTitle}>Connect Health App</Text>
                      <Ionicons name="add-circle-outline" size={22} color="#7278E6" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.row, { marginTop: 8 }]}
                      onPress={handleDisconnectHealthKit}
                    >
                      <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>Disconnect Health App</Text>
                      <Ionicons name="close-circle-outline" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity onPress={handleSignIn} style={styles.card}>
              <View style={styles.signInPrompt}>
                <View style={styles.signInAvatar}>
                  <Text style={styles.signInAvatarText}>+</Text>
                </View>
                <View style={styles.signInTextContainer}>
                  <Text style={styles.signInTitle}>Sign in to see your profile</Text>
                  <Text style={styles.signInSubtext}>Save settings & track dreams</Text>
                </View>
                <Text style={styles.signInArrow}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={[styles.card, styles.subscriptionCard]}>
            <Text style={styles.section}>Subscription</Text>

            {isLoadingSubscription ? (
              <ActivityIndicator size="small" color="#7278E6" />
            ) : user && subscription ? (
              <>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{subscription.name}</Text>
                </View>

                <View style={styles.usageContainer}>
                  <View style={styles.dreamsRemainingContainer}>
                    <Text style={styles.dreamsRemainingBig}>
                      {dreamUsage.total - dreamUsage.used}
                    </Text>
                    <Text style={styles.dreamsRemainingLabel}>
                      dream{(dreamUsage.total - dreamUsage.used) !== 1 ? 's' : ''} remaining
                    </Text>
                  </View>

                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(dreamUsage.used / dreamUsage.total) * 100}%` },
                      ]}
                    />
                  </View>

                  {getDaysUntilReset() > 0 && (
                    <Text style={styles.resetText}>
                      Resets in {getDaysUntilReset()} day{getDaysUntilReset() !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => setShowSubscriptionModal(true)}
                >
                  <Text style={styles.manageButtonText}>Change Plan</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.freeAccountInfo}>
                  <Text style={styles.freeAccountTitle}>
                    {user ? 'Free Plan' : 'Sign in to Subscribe'}
                  </Text>
                  <Text style={styles.freeAccountSubtext}>
                    {user
                      ? 'Subscribe to start creating amazing dream videos!'
                      : 'Sign in first to view subscription plans'}
                  </Text>
                </View>

                {user ? (
                  <>
                    <TouchableOpacity
                      style={styles.subscribeButton}
                      onPress={() => setShowSubscriptionModal(true)}
                    >
                      <LinearGradient
                        colors={['#7278E6', '#9F7AEA']}
                        style={styles.subscribeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.subscribeButtonText}>View Plans</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
                      <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.subscribeButton} onPress={handleSignIn}>
                    <LinearGradient
                      colors={['#7278E6', '#9F7AEA']}
                      style={styles.subscribeGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.subscribeButtonText}>Sign In First</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>General</Text>

            <TouchableOpacity style={styles.row} onPress={handleLanguagePress}>
              <Text style={styles.rowTitle}>Language</Text>
              <View style={styles.languageDisplay}>
                <Text style={styles.currentLanguage}>{getCurrentLanguageName()}</Text>
                <Text style={styles.chev}>›</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.row, { marginTop: 8 }]} onPress={handlePrivacyPress}>
              <Text style={styles.rowTitle}>Privacy Policy</Text>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.row, { marginTop: 8 }]} onPress={handleTermsPress}>
              <Text style={styles.rowTitle}>Terms of Service</Text>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          </View>

          {user && (
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} onPress={handleSignOut}>
                <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Sign Out</Text>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.row, { marginTop: 8 }]} onPress={handleDeleteAccount}>
                <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Delete Account</Text>
                <Ionicons name="trash-outline" size={22} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.footer}>v1.0 • Made with Dream AI</Text>
        </ScrollView>
      </LinearGradient>

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onRestore={restorePurchases}
        onSelectPlan={handleSelectPlan}
        currentId={subscription?.id}
        isPurchasing={isPurchasing}
      />

      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.editNameModalContainer}>
          <View style={styles.editNameModalContent}>
            <Text style={styles.editNameTitle}>Edit Name</Text>

            <TextInput
              style={styles.editNameInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              maxLength={50}
            />

            <View style={styles.editNameButtons}>
              <TouchableOpacity
                style={[styles.editNameButton, styles.editNameCancelButton]}
                onPress={() => setShowEditNameModal(false)}
              >
                <Text style={styles.editNameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editNameButton, styles.editNameSaveButton]}
                onPress={handleSaveName}
              >
                <Text style={styles.editNameSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.languageModalContainer}>
          <View style={styles.languageModalContent}>
            <View style={styles.languageModalHeader}>
              <Text style={styles.languageModalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.languageModalSubtitle}>
              Choose the language for voice transcription
            </Text>

            <ScrollView
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageItem,
                    language === lang.code && styles.languageItemSelected
                  ]}
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <View style={styles.languageItemLeft}>
                    <Text style={styles.languageFlag}>{lang.nativeName.charAt(0)}</Text>
                    <Text style={[
                      styles.languageItemText,
                      language === lang.code && styles.languageItemTextSelected
                    ]}>
                      {lang.name}
                    </Text>
                  </View>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#7278E6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: 45,
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    marginBottom: 4,
    ...(Platform.OS === 'android' && { includeFontPadding: false, letterSpacing: -0.5 }),
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 24,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
  section: {
    color: '#0A2540',
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    fontSize: 16,
    opacity: 0.6,
    marginBottom: 16,
    paddingHorizontal: 4,
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  },
  signInPrompt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  signInAvatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  signInAvatarText: { fontSize: 28, color: '#9CA3AF', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light', fontWeight: Platform.OS === 'ios' ? '300' : 'normal' },
  signInTextContainer: { flex: 1 },
  signInTitle: { fontSize: 18, fontWeight: Platform.OS === 'ios' ? '700' : 'bold', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', color: '#0A2540', marginBottom: 4 },
  signInSubtext: { fontSize: 14, color: '#68707D' },
  signInArrow: { fontSize: 24, color: '#9CA3AF' },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7278E6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontSize: 24,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: 'bold'
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#7278E6',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff'
  },
  editBadgeText: {
    fontSize: 10,
    color: '#fff'
  },
  nameContainer: {
    flex: 1
  },
  tapToSetText: {
    fontSize: 18,
    color: '#0A2540',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: '600',
    marginBottom: 2,
  },
  tapToSetSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  editNameModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  editNameModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  editNameTitle: {
    fontSize: 22,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    color: '#0A2540',
    marginBottom: 20,
    textAlign: 'center',
  },
  editNameInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: '#0A2540',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  editNameButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editNameButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editNameCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  editNameSaveButton: {
    backgroundColor: '#7278E6',
  },
  editNameCancelText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    color: '#6B7280',
  },
  editNameSaveText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    color: '#fff',
  },
  languageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  languageModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  languageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  languageModalTitle: {
    fontSize: 24,
    color: '#0A2540',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: 'bold',
  },
  languageModalSubtitle: {
    fontSize: 14,
    color: '#68707D',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  languageList: {
    paddingHorizontal: 20,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#F9FAFB',
  },
  languageItemSelected: {
    backgroundColor: '#F0F0FF',
    borderWidth: 2,
    borderColor: '#7278E6',
  },
  languageItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageItemText: {
    fontSize: 16,
    color: '#0A2540',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: '600',
  },
  languageItemTextSelected: {
    color: '#7278E6',
    fontWeight: 'bold',
  },
  subscriptionCard: { minHeight: 140 },
  planBadge: {
    backgroundColor: '#7278E6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 10,
  },
  planBadgeText: { color: '#fff', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  subscriptionPrice: { fontSize: 18, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  dreamsRemainingContainer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  dreamsRemainingBig: {
    fontSize: 60,
    color: '#7278E6',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: 'bold',
    lineHeight: 68,
  },
  dreamsRemainingLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    marginTop: 4,
  },
  usageContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 10
  },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usageTitle: { fontSize: 14, color: '#6B7280' },
  usageCount: { fontSize: 16, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#7278E6', borderRadius: 4 },
  resetText: { fontSize: 12, color: '#9CA3AF' },
  manageButton: { borderWidth: 1, borderColor: '#7278E6', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginHorizontal: 10 },
  manageButtonText: { color: '#7278E6', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  freeAccountInfo: { paddingHorizontal: 10, marginBottom: 16 },
  freeAccountTitle: { fontSize: 18, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  freeAccountSubtext: { fontSize: 14, color: '#68707D' },
  subscribeButton: { marginHorizontal: 10, marginBottom: 12 },
  subscribeGradient: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  subscribeButtonText: { color: '#fff', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  restoreButton: { alignItems: 'center', paddingVertical: 8 },
  restoreButtonText: { color: '#7278E6', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10 },
  rowTitle: { fontSize: 18, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black', fontWeight: '800' },
  chev: { fontSize: 22, color: '#9CA3AF' },
  languageDisplay: { flexDirection: 'row', alignItems: 'center' },
  currentLanguage: { fontSize: 16, color: '#7278E6', marginRight: 8, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: '600' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.85)', marginTop: 10 },
});