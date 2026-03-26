import { StyleSheet, View, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/config';

interface AddChildModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddChildModal({ visible, onClose, onSuccess }: AddChildModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    subjects: '',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.age) {
      Alert.alert('Error', 'Please enter child name and age');
      return;
    }

    // Validate name contains letters and is not only numbers
    if (!/[a-zA-Z]/.test(formData.name)) {
      Alert.alert('Error', 'Name must contain letters');
      return;
    }
    if (/^[0-9]+$/.test(formData.name.trim())) {
      Alert.alert('Error', 'Name cannot be only numbers');
      return;
    }

    const ageNum = parseInt(formData.age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 18) {
      Alert.alert('Error', 'Please enter a valid age (1-18)');
      return;
    }

    setLoading(true);

    try {
      const parentId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('access_token');
      if (!parentId) {
        Alert.alert('Error', 'Please log in again');
        return;
      }

      const subjectsArray = formData.subjects
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      const response = await fetch(api.addChild(parentId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: formData.name,
          age: ageNum,
          subjects: subjectsArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add child');
      }

      Alert.alert('Success', 'Child added successfully!');
      setFormData({ name: '', age: '', subjects: '' });
      onSuccess();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Add Child</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Child's Name *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter child's name"
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Age *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter age (1-18)"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text })}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Subjects Interested (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. Quran, Arabic, Islamic Studies"
                placeholderTextColor="#9CA3AF"
                value={formData.subjects}
                onChangeText={(text) => setFormData({ ...formData, subjects: text })}
                multiline
              />
              <ThemedText style={styles.hint}>Separate multiple subjects with commas</ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              <ThemedText style={styles.submitButtonText}>
                {loading ? 'Adding...' : 'Add Child'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    color: '#6B7280',
  },
  form: {
    paddingHorizontal: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F9FAFB',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
