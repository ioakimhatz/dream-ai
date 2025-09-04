// app/privacy-policy.tsx
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
          <Text style={styles.title}>Privacy Policy</Text>
        </View>

        {/* Content Cards */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.paragraph}>
            Dream AI collects information you provide directly to us, such as when you create dreams, 
            record voice prompts, or contact us for support. This includes your dream descriptions, 
            voice recordings, and generated videos.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How We Use Your Data</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <Text style={styles.bulletPoint}>• Generate your dream videos using AI</Text>
          <Text style={styles.bulletPoint}>• Improve our dream generation services</Text>
          <Text style={styles.bulletPoint}>• Process and fulfill your requests</Text>
          <Text style={styles.bulletPoint}>• Send you technical notices and updates</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Storage & Security</Text>
          <Text style={styles.paragraph}>
            Your dream videos and data are stored locally on your device and securely on our servers. 
            We use OpenAI and fal.ai services to process your dreams, but your data is not stored 
            permanently on their servers. We implement appropriate security measures to protect 
            your information.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Access and update your information</Text>
          <Text style={styles.bulletPoint}>• Delete your account and data</Text>
          <Text style={styles.bulletPoint}>• Opt out of notifications</Text>
          <Text style={styles.bulletPoint}>• Request a copy of your data</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We use trusted third-party services to provide our features:
          </Text>
          <Text style={styles.bulletPoint}>• OpenAI for text processing</Text>
          <Text style={styles.bulletPoint}>• fal.ai for video generation</Text>
          <Text style={styles.bulletPoint}>• Google for authentication (optional)</Text>
          <Text style={styles.paragraph}>
            These services process your data according to their own privacy policies.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Dream AI is not intended for children under 13 years of age. We do not knowingly 
            collect personal information from children under 13.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this privacy policy, contact us at:
          </Text>
          <Text style={styles.contactInfo}>privacy@dreamai.app</Text>
        </View>

        <Text style={styles.footer}>Last Updated: January 15, 2025</Text>
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
    fontSize: 32,
    fontWeight: '800',
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
  },
  
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
});