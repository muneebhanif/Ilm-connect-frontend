import { StyleSheet, View, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function TabTwoScreen() {
  return (
    // ScrollView = like a scrollable <div> container
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        
        {/* Hero Section - like a <header> in web */}
        <View style={styles.heroSection}>
          
          {/* Lantern Icon - centered with flexbox */}
          <View style={styles.lanternContainer}>
            <Ionicons name="home" size={48} color="#4ECDC4" />
          </View>
          
          {/* Auth Card - like a <div className="card"> */}
          <View style={styles.authSection}>
            <View style={styles.authIcon}>
              <Ionicons name="lock-closed" size={24} color="#4ECDC4" />
            </View>
            <ThemedText style={styles.authTitle}>
              Connect with Authentic
            </ThemedText>
            <ThemedText style={styles.authSubtitle}>
              Islamic Learning
            </ThemedText>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <ThemedText style={styles.sectionTitle}>
            Discover Islamic Education
          </ThemedText>
          
          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="book" size={28} color="#4ECDC4" />
            </View>
            <ThemedView style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>
                Quran & Tajweed
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Connect with certified Quran teachers for personalized lessons
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="school" size={28} color="#4ECDC4" />
            </View>
            <ThemedView style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>
                Islamic Studies
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Learn about Hadith, Fiqh, and Islamic history from scholars
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="language" size={28} color="#4ECDC4" />
            </View>
            <ThemedView style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>
                Arabic Language
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Master Arabic to understand the Quran in its original language
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="people" size={28} color="#4ECDC4" />
            </View>
            <ThemedView style={styles.featureContent}>
              <ThemedText style={styles.featureTitle}>
                Community Learning
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Join study circles and connect with fellow learners
              </ThemedText>
            </ThemedView>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Made with </ThemedText>
          <View style={styles.visilyBadge}>
            <ThemedText style={styles.visilyText}>Visily</ThemedText>
          </View>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    // Like: height: 400px; background: linear-gradient(...)
    height: 400,
    backgroundColor: '#E8B4A0',
    justifyContent: 'center',  // Vertical centering (flex-direction is 'column' by default)
    alignItems: 'center',       // Horizontal centering
    paddingTop: 60,
    overflow: 'hidden',
  },
  lanternContainer: {
    marginBottom: 30,
    // By default, Views use flexbox (display: flex in web)
  },
  lanternText: {
    fontSize: 120,
  },
  authSection: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  authIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  authIconText: {
    fontSize: 24,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  featuresSection: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    fontFamily: Fonts.rounded,
    color: '#2C3E50',
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E8F8F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureIcon: {
    fontSize: 36,
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 12,
    color: '#95A5A6',
  },
  visilyBadge: {
    backgroundColor: '#5E3FBE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  visilyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
