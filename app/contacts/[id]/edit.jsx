import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useContact from '../../../helpers/useContact';

const EditContactScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useContact(id);
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: null,
    notes: '',
    tags: '',
  });
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize form data when contact loads
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        birthday: contact.birthday ? new Date(contact.birthday) : null,
        notes: contact.notes || '',
        tags: (contact.tags || []).join(', '),
      });
    }
  }, [contact]);

  const isAppUser = Boolean(contact?.contact_user);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Prepare the payload
      const payload = {
        ...formData,
        // Convert tags string back to array
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        // Format date for API
        birthday: formData.birthday ? formData.birthday.toISOString().split('T')[0] : null,
      };

      // For app users, only send editable fields
      if (isAppUser) {
        const { first_name, last_name, email, ...editableFields } = payload;
        await apiFetch(`${ENDPOINTS.CONTACTS}${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(editableFields),
        });
      } else {
        // For manual contacts, send all fields
        await apiFetch(`${ENDPOINTS.CONTACTS}${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }

      // Show success toast
      Toast.show('Contact updated successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
        shadow: true,
        animation: true,
        hideOnPress: true,
        delay: 0,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact', id]);

      // Navigate back
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Failed to update contact:', error);
      Alert.alert('Error', error.message || 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Edit Contact</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {isAppUser ? (
          // App User Contact - Show profile info as read-only
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            <Text style={styles.sectionSubtitle}>
              This information comes from {contact.first_name}'s profile and cannot be edited.
            </Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{contact.first_name} {contact.last_name}</Text>
            </View>
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{contact.email}</Text>
            </View>
          </View>
        ) : (
          // Manual Contact - All fields editable
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <CustomInput
              label="First Name"
              value={formData.first_name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, first_name: text }))}
              placeholder="Enter first name"
            />
            <CustomInput
              label="Last Name"
              value={formData.last_name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, last_name: text }))}
              placeholder="Enter last name"
            />
            <CustomInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Common Editable Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Details</Text>
          <CustomInput
            label="Phone"
            value={formData.phone}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
          
          {/* Birthday Picker */}
          <Text style={styles.label}>Birthday</Text>
          <CustomButton
            title={formData.birthday ? formData.birthday.toLocaleDateString() : 'Select Birthday'}
            variant="outline"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          />
          {showDatePicker && (
            <DateTimePicker
              value={formData.birthday || new Date()}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setFormData(prev => ({ ...prev, birthday: selectedDate }));
                }
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Information</Text>
          <CustomInput
            label="Notes"
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            placeholder="Add notes about this contact"
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
          <CustomInput
            label="Tags"
            value={formData.tags}
            onChangeText={(text) => setFormData(prev => ({ ...prev, tags: text }))}
            placeholder="Enter tags separated by commas"
            helper="Example: family, work, gym"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <CustomButton
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            style={styles.button}
            disabled={isSaving}
          />
          <CustomButton
            title={isSaving ? "Saving..." : "Save"}
            onPress={handleSave}
            style={styles.button}
            disabled={isSaving}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: wp(5),
  },
  section: {
    marginBottom: wp(6),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  sectionSubtitle: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginBottom: wp(3),
    fontStyle: 'italic',
  },
  readOnlyField: {
    marginBottom: wp(3),
  },
  label: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginBottom: wp(1),
  },
  value: {
    fontSize: wp(4),
    color: theme.colors.text,
  },
  dateButton: {
    marginBottom: wp(3),
  },
  notesInput: {
    height: wp(30),
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: wp(4),
  },
  button: {
    flex: 1,
  },
});

export default EditContactScreen; 