// components/SubscriptionModal.tsx - UPDATED WITH LEGAL LINKS
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onRestore: () => void;
  onSelectPlan: (plan: 'weekly' | 'basic' | 'pro') => void;
  currentId?: string;
}

export function SubscriptionModal({
  visible,
  onClose,
  onRestore,
  onSelectPlan,
  currentId,
}: SubscriptionModalProps) {
  const router = useRouter();

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
            {/* WEEKLY */}
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

            {/* BASIC MONTHLY */}
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

            {/* PRO MONTHLY - BEST VALUE */}
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

            {/* Legal Links */}
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