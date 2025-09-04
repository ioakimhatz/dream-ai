// app/profile.tsx - Complete Updated for Subscription System
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
import { PaywallModal } from '../components/PaywallModal';
import { useAuth } from './contexts/AuthContext';

export default function ProfileScreen() {
  const { user, signOut, getDreamsRemaining, hasActivePlan } = useAuth();
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
    if (!user?.subscription.plan) {
      return user?.subscription.isTrialActive ? 'Free Trial' : 'No Plan';
    }
    
    switch (user.subscription.plan) {
      case 'basic_pro':
        return 'Basic Pro';
      case 'premium_pro':
        return 'Premium Pro';
      case 'annual_pro':
        return 'Annual Pro';
      default:
        return 'Unknown Plan';
    }
  };

  const getPlanPrice = () => {
    if (!user?.subscription.plan) return 'Free';
    
    switch (user.subscription.plan) {
      case 'basic_pro':
        return '$5.99/month';
      case 'premium_pro':
        return '$9.99/month';
      case 'annual_pro':
        return '$89.99/year';
      default:
        return 'Unknown';
    }
  };

  const getRenewalDate = () => {
    if (user?.subscription.isTrialActive && user?.subscription.trialEndsAt) {
      return `Trial ends ${user.subscription.trialEndsAt.toLocaleDateString()}`;
    }
    
    if (user?.subscription.renewalDate) {
      return `Renews ${user.subscription.renewalDate.toLocaleDateString()}`;
    }
    
    return 'No renewal date';
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
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
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
                  Dreams Remaining This {user?.subscription.plan === 'annual_pro' ? 'Month' : 'Period'}
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

        {/* Paywall Modal */}
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          dreamsNeeded={1}
          feature="Subscription Management"
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