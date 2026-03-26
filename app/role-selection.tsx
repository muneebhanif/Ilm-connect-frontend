import { StyleSheet, View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackButton } from '@/components/back-button';
import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <BackButton />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="people" size={36} color="#4ECDC4" />
            </View>
            <ThemedText type="title" style={styles.title}>
              Join IlmConnect
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Choose how you'd like to use our platform
            </ThemedText>
          </View>

          {/* Role Cards */}
          <View style={styles.cardsContainer}>
            {/* Parent Option */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => router.push('/signup-parent')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#fff', '#F8FEFF']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <View style={styles.iconContainer}>
                    <LinearGradient
                      colors={['#4ECDC4', '#44A08D']}
                      style={styles.iconGradient}
                    >
                      <Ionicons name="people" size={40} color="#fff" />
                    </LinearGradient>
                  </View>
                  
                  <View style={styles.cardTextContent}>
                    <ThemedText style={styles.roleTitle}>I'm a Parent</ThemedText>
                    <ThemedText style={styles.roleDescription}>
                      Find trusted Islamic teachers for your children and manage their learning journey
                    </ThemedText>
                  </View>

                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#4ECDC4" />
                      <ThemedText style={styles.featureText}>Browse verified teachers</ThemedText>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#4ECDC4" />
                      <ThemedText style={styles.featureText}>Book and manage classes</ThemedText>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#4ECDC4" />
                      <ThemedText style={styles.featureText}>Track your child's progress</ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardArrow}>
                    <Ionicons name="arrow-forward-circle" size={32} color="#4ECDC4" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Teacher Option */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => router.push('/signup-teacher')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#fff', '#FFF8F5']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <View style={styles.iconContainer}>
                    <LinearGradient
                      colors={['#FF6B6B', '#ee5a24']}
                      style={styles.iconGradient}
                    >
                      <Ionicons name="school" size={40} color="#fff" />
                    </LinearGradient>
                  </View>
                  
                  <View style={styles.cardTextContent}>
                    <ThemedText style={styles.roleTitle}>I'm a Teacher</ThemedText>
                    <ThemedText style={styles.roleDescription}>
                      Share your Islamic knowledge and connect with students worldwide
                    </ThemedText>
                  </View>

                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#FF6B6B" />
                      <ThemedText style={styles.featureText}>Create your teaching profile</ThemedText>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#FF6B6B" />
                      <ThemedText style={styles.featureText}>Set your own schedule & rates</ThemedText>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#FF6B6B" />
                      <ThemedText style={styles.featureText}>Grow your student base</ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardArrow}>
                    <Ionicons name="arrow-forward-circle" size={32} color="#FF6B6B" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#999" />
            <ThemedText style={styles.footerText}>
              Your data is secure and protected
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
  },
  roleCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  cardGradient: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardContent: {
    padding: 24,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    marginBottom: 20,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  featuresList: {
    gap: 12,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#444',
  },
  cardArrow: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
  },
});
