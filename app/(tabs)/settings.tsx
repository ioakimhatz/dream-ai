// app/(tabs)/settings.tsx - WITH SUBSCRIPTION MANAGEMENT
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useDreamUsage } from '../contexts/DreamUsageContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  const { user, signOut } = useAuth();
  const { 
    dreamUsage, 
    subscription, 
    offerings,
    isLoadingSubscription,
    purchaseSubscription,
    restorePurchases 
  } = useDreamUsage();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Load user data from auth context
  useEffect(() => {
    if (user?.photo) {
      setUserAvatar(user.photo);
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const savedNotifications = await AsyncStorage.getItem('notifications');
      if (savedNotifications !== null) {
        setNotificationsEnabled(JSON.parse(savedNotifications));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const updateNotifications = async (value: boolean) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications', JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save notifications setting:', error);
      Alert.alert('Error', 'Failed to save notification setting');
    }
  };

  const handleLanguagePress = () => {
    Alert.alert(
      'Language Settings',
      'Language selection is available in the voice recording dropdown on the Home screen.',
      [{ text: 'OK' }]
    );
  };

  const handlePrivacyPress = () => {
    router.push('/privacy-policy');
  };

  const handleEditAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
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
        console.log('Avatar updated:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting avatar:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: signOut
        }
      ]
    );
  };

  const handleSelectPlan = async (packageId: string) => {
    const selectedPackage = offerings?.availablePackages.find(
      pkg => pkg.identifier === packageId
    );
    
    if (selectedPackage) {
      const success = await purchaseSubscription(selectedPackage);
      if (success) {
        setShowSubscriptionModal(false);
      }
    }
  };

  const getDaysUntilReset = () => {
    const resetDate = new Date(dreamUsage.resetDate);
    const now = new Date();
    
    if (subscription?.period === 'monthly') {
      // Calculate next month reset
      const nextReset = new Date(resetDate);
      nextReset.setMonth(nextReset.getMonth() + 1);
      const diff = nextReset.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    }
    
    return 0;
  };

  if (!user) {
    return (
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Please sign in to view settings</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <>
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <ScrollView 
          style={[styles.container, { paddingTop: insets.top }]} 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Make Dream AI feel like yours</Text>

          {/* USER PROFILE SECTION */}
          <View style={styles.card}>
            <Text style={styles.section}>Profile</Text>

            {/* Avatar and Name */}
            <View style={styles.profileSection}>
              <TouchableOpacity onPress={handleEditAvatar} style={styles.avatarContainer}>
                {userAvatar ? (
                  <Image source={{ uri: userAvatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>✎</Text>
                </View>
              </TouchableOpacity>
              
              <View style={styles.nameContainer}>
                <Text style={styles.displayName}>{user.name || 'User'}</Text>
                <Text style={styles.emailText}>{user.email}</Text>
              </View>
            </View>

            {/* Notifications */}
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

          {/* SUBSCRIPTION SECTION */}
          <View style={[styles.card, styles.subscriptionCard]}>
            <Text style={styles.section}>Subscription</Text>
            
            {isLoadingSubscription ? (
              <ActivityIndicator size="small" color="#7278E6" />
            ) : subscription ? (
              <>
                <View style={styles.subscriptionInfo}>
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{subscription.name}</Text>
                  </View>
                  <Text style={styles.subscriptionPrice}>{subscription.price}</Text>
                </View>

                <View style={styles.usageContainer}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageTitle}>Dreams Used</Text>
                    <Text style={styles.usageCount}>
                      {dreamUsage.used} / {dreamUsage.total}
                    </Text>
                  </View>
                  
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${(dreamUsage.used / dreamUsage.total) * 100}%` }
                      ]} 
                    />
                  </View>
                  
                  {getDaysUntilReset() > 0 && (
                    <Text style={styles.resetText}>
                      Resets in {getDaysUntilReset()} days
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
                  <Text style={styles.freeAccountTitle}>No Active Subscription</Text>
                  <Text style={styles.freeAccountSubtext}>
                    Subscribe to start creating amazing dream videos!
                  </Text>
                </View>
                
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

                <TouchableOpacity 
                  style={styles.restoreButton}
                  onPress={restorePurchases}
                >
                  <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* GENERAL SECTION */}
          <View style={styles.card}>
            <Text style={styles.section}>General</Text>

            <TouchableOpacity style={styles.row} onPress={handleLanguagePress}>
              <Text style={styles.rowTitle}>Language</Text>
              <View style={styles.languageDisplay}>
                <Text style={styles.currentLanguage}>English</Text>
                <Text style={styles.chev}>›</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.row, { marginTop: 8 }]} onPress={handlePrivacyPress}>
              <Text style={styles.rowTitle}>Privacy Policy</Text>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          </View>

          {/* SIGN OUT */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
              <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Sign Out</Text>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>v1.0 • Made with Dream AI</Text>
        </ScrollView>
      </LinearGradient>

      {/* SUBSCRIPTION MODAL */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Your Plan</Text>
              <TouchableOpacity 
                onPress={() => setShowSubscriptionModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* BASIC PLAN */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  subscription?.id === 'dream_basic_monthly' && styles.currentPlan
                ]}
                onPress={() => handleSelectPlan('dream_basic_monthly')}
                disabled={subscription?.id === 'dream_basic_monthly'}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Basic</Text>
                  {subscription?.id === 'dream_basic_monthly' && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planPrice}>€7.99/month</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.planFeature}>• 3 dreams per month</Text>
                  <Text style={styles.planFeature}>• HD quality videos</Text>
                  <Text style={styles.planFeature}>• Basic support</Text>
                </View>
              </TouchableOpacity>

              {/* PRO PLAN */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  styles.recommendedPlan,
                  subscription?.id === 'dream_pro_monthly' && styles.currentPlan
                ]}
                onPress={() => handleSelectPlan('dream_pro_monthly')}
                disabled={subscription?.id === 'dream_pro_monthly'}
              >
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>MOST POPULAR</Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Pro</Text>
                  {subscription?.id === 'dream_pro_monthly' && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planPrice}>€12.99/month</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.planFeature}>• 5 dreams per month</Text>
                  <Text style={styles.planFeature}>• HD quality videos</Text>
                  <Text style={styles.planFeature}>• Priority support</Text>
                  <Text style={styles.planFeature}>• Early access to features</Text>
                </View>
              </TouchableOpacity>

              {/* ANNUAL PLAN */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  subscription?.id === 'dream_annual' && styles.currentPlan
                ]}
                onPress={() => handleSelectPlan('dream_annual')}
                disabled={subscription?.id === 'dream_annual'}
              >
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>SAVE 44%</Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Annual</Text>
                  {subscription?.id === 'dream_annual' && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planPrice}>€89.99/year</Text>
                <Text style={styles.planSubtext}>Just €7.50/month</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.planFeature}>• 60 dreams per year</Text>
                  <Text style={styles.planFeature}>• HD quality videos</Text>
                  <Text style={styles.planFeature}>• Priority support</Text>
                  <Text style={styles.planFeature}>• All premium features</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.restoreModalButton}
                onPress={() => {
                  setShowSubscriptionModal(false);
                  restorePurchases();
                }}
              >
                <Text style={styles.restoreModalButtonText}>Restore Purchases</Text>
              </TouchableOpacity>

              <Text style={styles.legalText}>
                Subscriptions auto-renew. Cancel anytime in Google Play Store.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  title: {
    color: '#fff',
    fontSize: 45,
    fontWeight: '800',
    paddingHorizontal: 0,
    paddingTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 28,
    fontSize: 16,
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
    elevation: 3,
  },
  section: {
    color: '#0A2540',
    fontWeight: '800',
    fontSize: 16,
    opacity: 0.6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  // PROFILE STYLES
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7278E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    borderColor: '#fff',
  },
  editBadgeText: {
    fontSize: 10,
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A2540',
    marginBottom: 2,
  },
  emailText: {
    fontSize: 14,
    color: '#68707D',
  },

  // SUBSCRIPTION STYLES
  subscriptionCard: {
    minHeight: 140,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  planBadge: {
    backgroundColor: '#7278E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  planBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  subscriptionPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A2540',
  },
  usageContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 10,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageTitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  usageCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A2540',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7278E6',
    borderRadius: 4,
  },
  resetText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  manageButton: {
    borderWidth: 1,
    borderColor: '#7278E6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  manageButtonText: {
    color: '#7278E6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  freeAccountInfo: {
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  freeAccountTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A2540',
    marginBottom: 4,
  },
  freeAccountSubtext: {
    fontSize: 14,
    color: '#68707D',
  },
  subscribeButton: {
    marginHorizontal: 10,
    marginBottom: 12,
  },
  subscribeGradient: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreButtonText: {
    color: '#7278E6',
    fontSize: 14,
  },

  // GENERAL STYLES
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  rowTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#0A2540' 
  },
  chev: { 
    fontSize: 22, 
    color: '#9CA3AF' 
  },
  languageDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLanguage: {
    fontSize: 16,
    color: '#7278E6',
    fontWeight: '600',
    marginRight: 8,
  },
  footer: { 
    textAlign: 'center', 
    color: 'rgba(255,255,255,0.85)', 
    marginTop: 10 
  },

  // MODAL STYLES
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A2540',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280',
  },
  planCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  recommendedPlan: {
    borderColor: '#7278E6',
    backgroundColor: '#F5F3FF',
  },
  currentPlan: {
    opacity: 0.7,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: '#7278E6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0A2540',
  },
  currentBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7278E6',
    marginBottom: 4,
  },
  planSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  planFeatures: {
    marginTop: 12,
  },
  planFeature: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
  },
  restoreModalButton: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  restoreModalButtonText: {
    color: '#7278E6',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
});