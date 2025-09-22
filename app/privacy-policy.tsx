// app/privacy-policy.tsx - COMPREHENSIVE LEGAL VERSION
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

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Privacy Policy & Terms</Text>
        </View>

        {/* CRITICAL: Content Policy & User Agreement */}
        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.warningTitle}>⚠️ Important Terms of Use</Text>
          <Text style={styles.warningText}>
            By using Dream AI, you agree to the following terms:
          </Text>
          <Text style={styles.bulletPoint}>
            • You must be 18 years or older to use this app
          </Text>
          <Text style={styles.bulletPoint}>
            • You will NOT create content depicting real people without their explicit consent
          </Text>
          <Text style={styles.bulletPoint}>
            • You will NOT generate illegal, harmful, or inappropriate content
          </Text>
          <Text style={styles.bulletPoint}>
            • AI-generated content may be inaccurate or fictional - verify before use
          </Text>
          <Text style={styles.bulletPoint}>
            • You are solely responsible for content you create and share
          </Text>
        </View>

        {/* Content Generation Policy */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Content Generation & Liability</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>IMPORTANT:</Text> Dream AI uses third-party AI services 
            (OpenAI, fal.ai) to generate content. We do NOT control the AI's output and cannot 
            guarantee accuracy, appropriateness, or safety of generated content.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>You acknowledge that:</Text>
          </Text>
          <Text style={styles.bulletPoint}>
            • Generated videos are fictional representations, not real events
          </Text>
          <Text style={styles.bulletPoint}>
            • AI may produce unexpected or unintended results
          </Text>
          <Text style={styles.bulletPoint}>
            • Content may not be suitable for all audiences
          </Text>
          <Text style={styles.bulletPoint}>
            • You must review all content before sharing
          </Text>
          <Text style={styles.bulletPoint}>
            • We are NOT liable for AI-generated content or its consequences
          </Text>
        </View>

        {/* Third-Party Persons Protection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Protection of Third Parties</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>STRICTLY PROHIBITED:</Text>
          </Text>
          <Text style={styles.bulletPoint}>
            • Creating deepfakes or misleading content of real people
          </Text>
          <Text style={styles.bulletPoint}>
            • Using photos of others without written consent
          </Text>
          <Text style={styles.bulletPoint}>
            • Generating content that could harm someone's reputation
          </Text>
          <Text style={styles.bulletPoint}>
            • Creating content depicting minors in any context
          </Text>
          <Text style={styles.bulletPoint}>
            • Impersonating or misrepresenting others
          </Text>
          <Text style={styles.paragraph}>
            Violation will result in immediate account termination and potential legal action.
          </Text>
        </View>

        {/* GDPR Compliance (EU) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>EU Data Protection (GDPR)</Text>
          <Text style={styles.paragraph}>
            For users in the European Union, we comply with GDPR requirements:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Legal Basis for Processing:</Text> Legitimate interest 
            and consent for providing dream visualization services.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Your Rights Include:</Text>
          </Text>
          <Text style={styles.bulletPoint}>• Right to access your personal data</Text>
          <Text style={styles.bulletPoint}>• Right to rectification of inaccurate data</Text>
          <Text style={styles.bulletPoint}>• Right to erasure ("right to be forgotten")</Text>
          <Text style={styles.bulletPoint}>• Right to restrict processing</Text>
          <Text style={styles.bulletPoint}>• Right to data portability</Text>
          <Text style={styles.bulletPoint}>• Right to object to processing</Text>
          <Text style={styles.bulletPoint}>• Right to withdraw consent at any time</Text>
          <Text style={styles.paragraph}>
            Contact our Data Protection Officer: dpo@dreamai.app
          </Text>
        </View>

        {/* US Privacy Rights */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>US Privacy Rights (CCPA/COPPA)</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>California Residents (CCPA):</Text> You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Know what personal information we collect</Text>
          <Text style={styles.bulletPoint}>• Delete your personal information</Text>
          <Text style={styles.bulletPoint}>• Opt-out of the sale of personal information</Text>
          <Text style={styles.bulletPoint}>• Non-discrimination for exercising rights</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Children's Privacy (COPPA):</Text> Dream AI is NOT 
            intended for children under 18. We do not knowingly collect data from minors. 
            If we discover a user is under 18, their account will be immediately terminated.
          </Text>
        </View>

        {/* Data Collection & Storage */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Data we collect includes:</Text>
          </Text>
          <Text style={styles.bulletPoint}>• Voice recordings (temporarily processed)</Text>
          <Text style={styles.bulletPoint}>• Text descriptions of dreams</Text>
          <Text style={styles.bulletPoint}>• Generated videos (stored locally)</Text>
          <Text style={styles.bulletPoint}>• Email (if provided for account)</Text>
          <Text style={styles.bulletPoint}>• Usage analytics (anonymized)</Text>
          <Text style={styles.bulletPoint}>• Device information for app functionality</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>We do NOT:</Text> Sell your data, share with advertisers, 
            or use for purposes other than providing our service.
          </Text>
        </View>

        {/* Data Security */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Security & Retention</Text>
          <Text style={styles.paragraph}>
            • Voice recordings are deleted immediately after transcription
          </Text>
          <Text style={styles.paragraph}>
            • Generated videos are stored locally on your device
          </Text>
          <Text style={styles.paragraph}>
            • Server data is encrypted using industry standards (AES-256)
          </Text>
          <Text style={styles.paragraph}>
            • We retain data only as long as necessary for service provision
          </Text>
          <Text style={styles.paragraph}>
            • You can request complete data deletion at any time
          </Text>
        </View>

        {/* Third-Party Services */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Third-Party Services & Data Processing</Text>
          <Text style={styles.paragraph}>
            We use the following processors (sub-processors under GDPR):
          </Text>
          <Text style={styles.bulletPoint}>
            • <Text style={styles.bold}>OpenAI:</Text> Text processing (US-based, Privacy Shield)
          </Text>
          <Text style={styles.bulletPoint}>
            • <Text style={styles.bold}>fal.ai:</Text> Video generation (US-based)
          </Text>
          <Text style={styles.bulletPoint}>
            • <Text style={styles.bold}>RevenueCat:</Text> Subscription management (GDPR compliant)
          </Text>
          <Text style={styles.bulletPoint}>
            • <Text style={styles.bold}>Google Firebase:</Text> Authentication (optional, GDPR compliant)
          </Text>
          <Text style={styles.paragraph}>
            Each service processes data according to their privacy policies and appropriate 
            data processing agreements.
          </Text>
        </View>

        {/* Disclaimer & Limitation of Liability */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Disclaimer & Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>DREAM AI IS PROVIDED "AS IS" WITHOUT WARRANTIES.</Text>
          </Text>
          <Text style={styles.paragraph}>
            We are NOT responsible for:
          </Text>
          <Text style={styles.bulletPoint}>• Content generated by AI systems</Text>
          <Text style={styles.bulletPoint}>• Accuracy or appropriateness of results</Text>
          <Text style={styles.bulletPoint}>• How you use generated content</Text>
          <Text style={styles.bulletPoint}>• Third-party reactions to your content</Text>
          <Text style={styles.bulletPoint}>• Any damages arising from app use</Text>
          <Text style={styles.paragraph}>
            Maximum liability is limited to the amount paid for subscription in the last 12 months.
          </Text>
        </View>

        {/* Intellectual Property */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Intellectual Property Rights</Text>
          <Text style={styles.paragraph}>
            • You retain ownership of your original dream descriptions
          </Text>
          <Text style={styles.paragraph}>
            • Generated videos are yours to use (non-exclusive license)
          </Text>
          <Text style={styles.paragraph}>
            • You grant us license to process your content for service provision
          </Text>
          <Text style={styles.paragraph}>
            • AI-generated content may not be copyrightable in some jurisdictions
          </Text>
          <Text style={styles.paragraph}>
            • You must respect others' intellectual property rights
          </Text>
        </View>

        {/* Contact & Legal */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Data Protection Officer:</Text>
          </Text>
          <Text style={styles.contactInfo}>dpo@dreamai.app</Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Legal Inquiries:</Text>
          </Text>
          <Text style={styles.contactInfo}>legal@dreamai.app</Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>DMCA/Copyright Claims:</Text>
          </Text>
          <Text style={styles.contactInfo}>dmca@dreamai.app</Text>
          
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>General Support:</Text>
          </Text>
          <Text style={styles.contactInfo}>support@dreamai.app</Text>
        </View>

        {/* Governing Law */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Governing Law & Disputes</Text>
          <Text style={styles.paragraph}>
            • These terms are governed by Delaware law (US users) and local law (EU users)
          </Text>
          <Text style={styles.paragraph}>
            • Disputes will be resolved through binding arbitration
          </Text>
          <Text style={styles.paragraph}>
            • Class action waiver applies where legally permitted
          </Text>
          <Text style={styles.paragraph}>
            • EU users may use ODR platform for dispute resolution
          </Text>
        </View>

        {/* Updates */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Policy Updates</Text>
          <Text style={styles.paragraph}>
            We may update this policy to reflect changes in law or our practices. 
            Material changes will be notified via email or in-app notification. 
            Continued use after updates constitutes acceptance.
          </Text>
        </View>

        <Text style={styles.footer}>
          Last Updated: {new Date().toLocaleDateString()}
        </Text>
        <Text style={styles.footer}>
          Version 2.0 - GDPR/CCPA Compliant
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
  
  warningCard: {
    backgroundColor: '#FFF4F4',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  
  warningTitle: {
    color: '#D32F2F',
    fontWeight: '800',
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  
  warningText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#D32F2F',
    marginBottom: 8,
    fontWeight: '600',
  },
  
  sectionTitle: {
    color: '#0A2540',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 12,
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