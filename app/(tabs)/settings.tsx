// app/(tabs)/settings.tsx - UPDATED WITH LANGUAGE CONTEXT

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
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { useDreamUsage } from '../contexts/DreamUsageContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext'; // ✅ NEW

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  
  // ✅ NEW: Use language from context instead of local state
  const { language, setLanguage } = useLanguage();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [tempName, setTempName] = useState('');

  const { user, signOut, updateUserName } = useAuth();
  const {
    dreamUsage,
    subscription,
    offerings,
    isLoadingSubscription,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
  } = useDreamUsage();

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationPermissionStatus(status);
        
        const saved = await AsyncStorage.getItem('notifications');
        if (saved !== null) {
          setNotificationsEnabled(JSON.parse(saved));
        }
        
        // ✅ REMOVED: No need to load language from AsyncStorage, LanguageContext handles it
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (user?.photo) setUserAvatar(user.photo);
  }, [user]);

  const updateNotifications = async (value: boolean) => {
    try {
      if (value) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive dream reminders.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }
        
        setNotificationPermissionStatus(finalStatus);
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('notifications', JSON.stringify(true));
        
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldSetBadge: true,
          }),
        });
      } else {
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notifications', JSON.stringify(false));
      }
    } catch (e) {
      console.error('Failed to update notifications:', e);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  // ✅ UPDATED: Use context's setLanguage which handles AsyncStorage automatically
  const handleLanguageSelect = async (languageCode: string) => {
    try {
      await setLanguage(languageCode); // ✅ This saves to AsyncStorage automatically
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              console.log('🗑️ Starting account deletion...');
              
              const keysToRemove = [
                'user',
                'hasCompletedOnboarding',
                'notifications',
                'language',
                'temp_otp',
                'temp_otp_email',
                'temp_otp_expires',
              ];
              
              await AsyncStorage.multiRemove(keysToRemove);
              console.log('✅ All user data removed from storage');
              
              try {
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                if (await GoogleSignin.isSignedIn()) {
                  await GoogleSignin.signOut();
                  console.log('✅ Signed out from Google');
                }
              } catch (e) {
                console.log('No Google sign-in to clear');
              }
              
              router.replace('/welcome');
              
              Alert.alert(
                'Account Deleted',
                'Your account and all associated data have been permanently deleted. We\'re sad to see you go!',
                [{ text: 'OK' }]
              );
              
              console.log('✅ Account deletion complete');
            } catch (error) {
              console.error('❌ Account deletion error:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.',
                [{ text: 'OK' }]
              );
            }
          }
        },
      ]
    );
  };

  const handleSignIn = () => router.push('/(auth)/signin');

  const handleSelectPlan = async (planType: 'weekly' | 'basic' | 'pro') => {
    const productMap: Record<string, string> = { 
      weekly: 'dream_weekly', 
      basic: 'dream_basic_monthly', 
      pro: 'dream_pro_monthly' 
    };
    
    const productId = productMap[planType];
    
    if (!offerings?.availablePackages) {
      Alert.alert('Error', 'Subscription plans are not available. Please try again later.');
      return;
    }
    
    console.log('💳 [Settings] Looking for product ID:', productId);
    console.log('💳 [Settings] Available packages:', offerings.availablePackages.map(p => ({
      identifier: p.identifier,
      productId: p.product.identifier
    })));
    
    const packageToPurchase = offerings.availablePackages.find(
      (p) => p.product.identifier === productId
    );
    
    if (!packageToPurchase) {
      Alert.alert('Error', 'Selected plan is not available. Please try again.');
      return;
    }
    
    console.log('✅ [Settings] Found package:', packageToPurchase.identifier);
    
    setShowSubscriptionModal(false);
    
    const success = await purchaseSubscription(packageToPurchase);
    
    if (success) {
      await refreshSubscriptionStatus();
    }
  };

  const getDaysUntilReset = () => {
    const resetDate = new Date(dreamUsage.resetDate);
    const now = new Date();
    
    const days = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  // ✅ UPDATED: Use SUPPORTED_LANGUAGES from context
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
                    {user ? 'No Active Subscription' : 'Sign in to Subscribe'}
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
              {/* ✅ UPDATED: Use SUPPORTED_LANGUAGES from context */}
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

function SubscriptionModal({
  visible,
  onClose,
  onRestore,
  onSelectPlan,
  currentId,
}: {
  visible: boolean;
  onClose: () => void;
  onRestore: () => void;
  onSelectPlan: (plan: 'weekly' | 'basic' | 'pro') => void;
  currentId?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Plan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces>
            <TouchableOpacity
              style={[styles.planCard, currentId === 'dream_weekly' && styles.currentPlan]}
              onPress={() => onSelectPlan('weekly')}
              disabled={currentId === 'dream_weekly'}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Weekly</Text>
                {currentId === 'dream_weekly' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>$3.49/week</Text>
              <View style={styles.planFeatures}>
                <Text style={styles.planFeature}>• 1 dream per week</Text>
                <Text style={styles.planFeature}>• HD quality videos</Text>
                <Text style={styles.planFeature}>• Low commitment</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, currentId === 'dream_basic_monthly' && styles.currentPlan]}
              onPress={() => onSelectPlan('basic')}
              disabled={currentId === 'dream_basic_monthly'}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Basic Monthly</Text>
                {currentId === 'dream_basic_monthly' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>$9.49/month</Text>
              <View style={styles.planFeatures}>
                <Text style={styles.planFeature}>• 3 dreams per month</Text>
                <Text style={styles.planFeature}>• HD quality videos</Text>
                <Text style={styles.planFeature}>• Basic support</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, styles.recommendedPlan, currentId === 'dream_pro_monthly' && styles.currentPlan]}
              onPress={() => onSelectPlan('pro')}
              disabled={currentId === 'dream_pro_monthly'}
            >
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>BEST VALUE</Text>
              </View>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Pro Monthly</Text>
                {currentId === 'dream_pro_monthly' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>$12.49/month</Text>
              <Text style={styles.planSubtext}>Just $2.50 per dream</Text>
              <View style={styles.planFeatures}>
                <Text style={styles.planFeature}>• 5 dreams per month</Text>
                <Text style={styles.planFeature}>• HD quality videos</Text>
                <Text style={styles.planFeature}>• Priority support</Text>
                <Text style={styles.planFeature}>• Early access to features</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreModalButton} onPress={() => { onClose(); onRestore(); }}>
              <Text style={styles.restoreModalButtonText}>Restore Purchases</Text>
            </TouchableOpacity>

            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/terms-of-service'); }}>
                <Text style={styles.legalLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}> • </Text>
              <TouchableOpacity onPress={() => { onClose(); router.push('/privacy-policy'); }}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.legalText}>Subscriptions auto-renew. Cancel anytime in App Store.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 24, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 24, color: '#6B7280' },
  planCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginHorizontal: 20, marginTop: 16, borderWidth: 2, borderColor: '#E5E7EB', position: 'relative' },
  recommendedPlan: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  currentPlan: { opacity: 0.7 },
  savingsBadge: { position: 'absolute', top: -10, left: 20, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  savingsText: { color: '#fff', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planName: { fontSize: 22, color: '#0A2540', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  currentBadge: { backgroundColor: '#6B7280', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  currentBadgeText: { color: '#fff', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  planPrice: { fontSize: 28, color: '#7278E6', marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: 'bold' },
  planSubtext: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  planFeatures: { marginTop: 12 },
  planFeature: { fontSize: 14, color: '#4B5563', marginBottom: 6 },
  restoreModalButton: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  restoreModalButtonText: { color: '#7278E6', fontSize: 14, textDecorationLine: 'underline' },
  legalLinks: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 8,
    marginBottom: 8 
  },
  legalLinkText: { 
    fontSize: 12, 
    color: '#7C86FF', 
    textDecorationLine: 'underline',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  legalSeparator: { 
    fontSize: 12, 
    color: '#9CA3AF',
    marginHorizontal: 4,
  },
  legalText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginHorizontal: 20, marginBottom: 20 },
});
