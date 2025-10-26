// app/profile.tsx - FIXED: Clean name display
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { useAuth } from './contexts/AuthContext';

export default function ProfileScreen() {
  const { user, signOut, updateSubscription } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/signin');
          }
        }
      ]
    );
  };

  const getPlanName = () => {
    if (!user?.dreamUsage) return 'Free';
    
    switch (user.dreamUsage.planId) {
      case 'basic':
        return 'Basic';
      case 'pro':
        return 'Pro';
      case 'annual':
        return 'Annual';
      default:
        return 'Free';
    }
  };

  const getPlanPrice = () => {
    if (!user?.dreamUsage) return 'Free';
    
    switch (user.dreamUsage.planId) {
      case 'basic':
        return '€7.99/month';
      case 'pro':
        return '€12.99/month';
      case 'annual':
        return '€89.99/year';
      default:
        return 'Free';
    }
  };

  const getRenewalDate = () => {
    if (user?.dreamUsage?.resetDate) {
      const date = new Date(user.dreamUsage.resetDate);
      return `Renews ${date.toLocaleDateString()}`;
    }
    
    return 'No active plan';
  };

  const getDreamsRemaining = () => {
    if (!user?.dreamUsage) return 0;
    return Math.max(0, user.dreamUsage.total - user.dreamUsage.used);
  };

  const hasActivePlan = () => {
    return user?.dreamUsage && user.dreamUsage.planId !== 'free';
  };

  const handleSelectPlan = async (plan: 'basic' | 'pro' | 'annual') => {
    const dreamCounts = { basic: 3, pro: 5, annual: 60 };
    
    await updateSubscription({
      plan: plan,
      isActive: true,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dreamsRemaining: dreamCounts[plan],
      totalDreams: dreamCounts[plan],
    });
    
    setShowPaywall(false);
    
    Alert.alert('Success!', `${plan.toUpperCase()} plan activated! You now have ${dreamCounts[plan]} dreams.`);
  };

  const handleRestore = async () => {
    Alert.alert('Restore', 'No purchases found (Demo mode)');
  };

  // 🔥 HELPER: Get clean display name
  const getDisplayName = () => {
    if (!user) return 'User';
    
    // If name looks like an ugly Apple ID, return clean fallback
    if (
      user.name.length > 30 ||
      user.name.includes('.eba') ||
      user.name.includes('.403') ||
      /^\d{6}/.test(user.name)
    ) {
      return 'Apple User';
    }
    
    return user.name || 'User';
  };

  // 🔥 HELPER: Should we show email?
  const shouldShowEmail = () => {
    if (!user) return false;
    
    return (
      !user.email.includes('privaterelay.appleid.com') &&
      user.email.length < 50
    );
  };

  if (!user) {
    return (
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Please sign in to view profile</Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => router.replace('/(auth)/signin')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.avatarText}>
                  {getDisplayName().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* 🔥 FIXED: Clean name display */}
            <Text style={styles.profileName}>{getDisplayName()}</Text>
            {/* 🔥 FIXED: Only show real emails */}
            {shouldShowEmail() && (
              <Text style={styles.profileEmail}>{user.email}</Text>
            )}
          </View>

          {/* Subscription Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Plan</Text>
            <View style={styles.subscriptionCard}>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{getPlanName()}</Text>
                <Text style={styles.planPrice}>{getPlanPrice()}</Text>
              </View>
              <Text style={styles.renewalText}>{getRenewalDate()}</Text>
              
              <View style={styles.dreamsInfo}>
                <Text style={styles.dreamsAmount}>{getDreamsRemaining()}</Text>
                <Text style={styles.dreamsLabel}>
                  Dreams Remaining This {user?.dreamUsage?.planId === 'annual' ? 'Month' : 'Period'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.managePlanButton}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.managePlanText}>
                  {hasActivePlan() ? 'Change Plan' : 'Subscribe Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="card-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Payment Method</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="receipt-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Billing History</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="settings-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Manage Subscription</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="notifications-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="document-text-outline" size={24} color="#333" />
              <Text style={styles.menuText}>Terms & Privacy</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#ff4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Subscription Modal */}
        <SubscriptionModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onRestore={handleRestore}
          onSelectPlan={handleSelectPlan}
          currentId={user?.dreamUsage?.planId}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  placeholderAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  subscriptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  planInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 16,
    color: '#666',
  },
  renewalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  dreamsInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dreamsAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  dreamsLabel: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  managePlanButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  managePlanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});