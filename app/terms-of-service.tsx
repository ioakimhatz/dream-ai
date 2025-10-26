import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Terms of Service</Text>
        </View>

        {/* Acceptance of Terms */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By downloading, installing, or using Dream AI ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.
          </Text>
          <Text style={styles.paragraph}>
            You must be at least 18 years old to use this App. By using the App, you represent that you are 18 or older.
          </Text>
        </View>

        {/* Subscription Terms */}
        <View style={[styles.card, styles.highlightCard]}>
          <Text style={styles.sectionTitle}>2. Subscription Terms</Text>
          
          <Text style={styles.subsectionTitle}>2.1 Available Plans</Text>
          <Text style={styles.bulletPoint}>• Weekly Plan: $3.49 per week (1 dream per week)</Text>
          <Text style={styles.bulletPoint}>• Basic Monthly: $9.49 per month (3 dreams per month)</Text>
          <Text style={styles.bulletPoint}>• Pro Monthly: $12.49 per month (5 dreams per month)</Text>
          
          <Text style={styles.subsectionTitle}>2.2 Auto-Renewal</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>All subscriptions automatically renew</Text> unless cancelled at least 24 hours before the end of the current period. You will be charged for renewal within 24 hours prior to the end of the current period.
          </Text>
          
          <Text style={styles.subsectionTitle}>2.3 Cancellation</Text>
          <Text style={styles.paragraph}>
            You can cancel your subscription at any time through your Apple App Store account settings. Cancellation takes effect at the end of the current billing period. No refunds for partial periods.
          </Text>
          
          <Text style={styles.subsectionTitle}>2.4 Free Trials</Text>
          <Text style={styles.paragraph}>
            If a free trial is offered, you may cancel before the trial ends to avoid charges. If not cancelled, you will be automatically charged for the selected subscription.
          </Text>
          
          <Text style={styles.subsectionTitle}>2.5 Refunds</Text>
          <Text style={styles.paragraph}>
            All purchases are final. Refund requests must be submitted through the Apple App Store and are subject to Apple's refund policy. We do not control Apple's refund decisions.
          </Text>
        </View>

        {/* Account Terms */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Account & Usage</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.1 Account Creation:</Text> You may create an account using email, Apple Sign-In, or Google Sign-In. You are responsible for maintaining account security.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.2 One Account Per User:</Text> Each subscription is for individual use only. Sharing accounts is prohibited.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>3.3 Usage Limits:</Text> Your subscription includes a specific number of dreams per period. Unused dreams do not roll over to the next period.
          </Text>
        </View>

        {/* Prohibited Uses */}
        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.sectionTitle}>4. Prohibited Uses</Text>
          <Text style={styles.paragraph}>
            You agree NOT to use Dream AI for:
          </Text>
          <Text style={styles.bulletPoint}>• Creating deepfakes or misleading content of real people</Text>
          <Text style={styles.bulletPoint}>• Generating content depicting minors in any context</Text>
          <Text style={styles.bulletPoint}>• Using photos of others without their explicit consent</Text>
          <Text style={styles.bulletPoint}>• Creating illegal, harmful, or inappropriate content</Text>
          <Text style={styles.bulletPoint}>• Violating any person's privacy or intellectual property rights</Text>
          <Text style={styles.bulletPoint}>• Harassment, hate speech, or discriminatory content</Text>
          <Text style={styles.bulletPoint}>• Commercial use without written permission</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Violation will result in immediate account termination without refund.</Text>
          </Text>
        </View>

        {/* Content & Intellectual Property */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Content & Ownership</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>5.1 Your Content:</Text> You retain ownership of your original dream descriptions and input photos. You grant us a license to process this content solely to provide the service.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>5.2 Generated Videos:</Text> You receive a non-exclusive license to use generated videos for personal, non-commercial purposes. AI-generated content may not be copyrightable in all jurisdictions.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>5.3 Our Rights:</Text> Dream AI, our logo, and the App itself remain our intellectual property.
          </Text>
        </View>

        {/* AI Disclaimer */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. AI-Generated Content Disclaimer</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>IMPORTANT:</Text> Dream AI uses third-party AI services (OpenAI, fal.ai) to generate content. We do NOT control AI output and cannot guarantee accuracy, appropriateness, or safety.
          </Text>
          <Text style={styles.paragraph}>
            You acknowledge that:
          </Text>
          <Text style={styles.bulletPoint}>• Generated videos are fictional, not real events</Text>
          <Text style={styles.bulletPoint}>• AI may produce unexpected or unintended results</Text>
          <Text style={styles.bulletPoint}>• You must review all content before sharing</Text>
          <Text style={styles.bulletPoint}>• You are solely responsible for how you use generated content</Text>
        </View>

        {/* Limitation of Liability */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>DREAM AI IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</Text>
          </Text>
          <Text style={styles.paragraph}>
            We are NOT liable for:
          </Text>
          <Text style={styles.bulletPoint}>• Content generated by AI systems</Text>
          <Text style={styles.bulletPoint}>• Accuracy or appropriateness of results</Text>
          <Text style={styles.bulletPoint}>• How you use generated content</Text>
          <Text style={styles.bulletPoint}>• Third-party reactions to your content</Text>
          <Text style={styles.bulletPoint}>• Any damages arising from App use</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Maximum liability is limited to the amount you paid for your subscription in the last 12 months.</Text>
          </Text>
        </View>

        {/* Account Deletion */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Account Deletion</Text>
          <Text style={styles.paragraph}>
            You can delete your account at any time from the Settings screen. This will:
          </Text>
          <Text style={styles.bulletPoint}>• Permanently delete all your data</Text>
          <Text style={styles.bulletPoint}>• Cancel your subscription (no refund for remaining period)</Text>
          <Text style={styles.bulletPoint}>• Remove your account from our systems</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>This action cannot be undone.</Text>
          </Text>
        </View>

        {/* Termination */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Termination</Text>
          <Text style={styles.paragraph}>
            We reserve the right to suspend or terminate your account for:
          </Text>
          <Text style={styles.bulletPoint}>• Violation of these Terms</Text>
          <Text style={styles.bulletPoint}>• Fraudulent or illegal activity</Text>
          <Text style={styles.bulletPoint}>• Abuse of the service</Text>
          <Text style={styles.paragraph}>
            Termination for violations results in immediate loss of access without refund.
          </Text>
        </View>

        {/* Changes to Terms */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms at any time. Material changes will be notified via email or in-app notification. Continued use after changes constitutes acceptance of new terms.
          </Text>
        </View>

        {/* Governing Law */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>11. Governing Law</Text>
          <Text style={styles.paragraph}>
            These terms are governed by the laws of Delaware, United States (for US users) and applicable local laws (for international users).
          </Text>
          <Text style={styles.paragraph}>
            Disputes will be resolved through binding arbitration, except where prohibited by law.
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>12. Contact</Text>
          <Text style={styles.paragraph}>
            For questions about these Terms:
          </Text>
          <Text style={styles.contactInfo}>support@dream-ai.app</Text>
        </View>

        <Text style={styles.footer}>
          Last Updated: October 23, 2025
        </Text>
        <Text style={styles.footer}>
          Version 1.0
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    marginLeft: -2,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  highlightCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#7C86FF',
  },
  warningCard: {
    backgroundColor: '#FFF4F4',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  sectionTitle: {
    color: '#0A2540',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 12,
  },
  subsectionTitle: {
    color: '#0A2540',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#0A2540',
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 4,
    marginLeft: 8,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7C86FF',
    fontWeight: '600',
    marginBottom: 8,
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 5,
  },
});