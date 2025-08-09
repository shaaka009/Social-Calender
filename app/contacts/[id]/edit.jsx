import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';

const EditContactScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};
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
  const [tempDate, setTempDate] = useState(null);

  // Initialize form data when contact loads
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.target?.first_name || '',
        last_name: person.last_name || '',
        email: person.email || '',
        phone: person.phone || '',
        birthday: person.birthday ? new Date(person.birthday) : null,
        notes: person.notes || '',
        tags: (person.tags || []).join(', '),
      });
    }
  }, [contact]);

  const isAppUser = Boolean(contact?.target?.is_app_user);

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
        await apiFetch(`${ENDPOINTS.CONNECTIONS}${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(editableFields),
        });
      } else {
        // For manual contacts, send all fields
        await apiFetch(`${ENDPOINTS.CONNECTIONS}${id}/`, {
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
      queryClient.invalidateQueries(['connections']);
      queryClient.invalidateQueries(['connection', id]);

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
              This information comes from {person.first_name}&apos;s profile and cannot be edited.
            </Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{person.first_name} {person.last_name}</Text>
            </View>
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{person.email}</Text>
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
            onPress={() => {
              const now = new Date();
              setShowDatePicker(true);
              setTempDate(formData.birthday || now);
            }}
            style={styles.dateButton}
          />
          {showDatePicker && Platform.OS === 'ios' && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={tempDate || new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date(1900, 0, 1)}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                  }
                }}
              />
              <View style={styles.datePickerButtons}>
                <CustomButton
                  title="Cancel"
                  variant="outline"
                  onPress={() => {
                    setShowDatePicker(false);
                    setTempDate(null);
                  }}
                  style={styles.datePickerButton}
                />
                <CustomButton
                  title="Confirm"
                  onPress={() => {
                    if (tempDate) {
                      setFormData(prev => ({ ...prev, birthday: tempDate }));
                    }
                    setShowDatePicker(false);
                  }}
                  style={styles.datePickerButton}
                />
              </View>
            </View>
          )}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={tempDate || new Date()}
              mode="date"
              display="default"
              minimumDate={new Date(1900, 0, 1)}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (event.type === 'set') {
                  if (selectedDate) {
                    setFormData(prev => ({ ...prev, birthday: selectedDate }));
                  }
                }
                setShowDatePicker(false);
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
  datePickerContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.roundness,
    padding: wp(4),
    marginTop: wp(2),
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: wp(4),
  },
  datePickerButton: {
    flex: 1,
    marginHorizontal: wp(2),
  },
});

export default EditContactScreen; 