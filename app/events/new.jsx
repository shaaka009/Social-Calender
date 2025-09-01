import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';

const EVENT_TYPES = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'general', label: 'General' },
];

const AddEventScreen = () => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [form, setForm] = useState({
    title: '',
    date: new Date(),
    type: 'general',
    person_id: null,
    notes: '',
  });

  // Get contacts for selection
  const { data: contacts = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
  });

  // Filter contacts based on search
  const filteredContacts = contacts.filter(conn => {
    const searchLower = searchQuery.toLowerCase();
    const name = `${conn.target.first_name} ${conn.target.last_name}`.toLowerCase();
    return !searchQuery || name.includes(searchLower);
  });

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Please enter a title for the event');
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch(ENDPOINTS.EVENTS, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          // Format as YYYY-MM-DD in the *local* timezone rather than relying on
          // `toISOString()` (UTC) which can shift the day forward/backwards.
          date: `${form.date.getFullYear()}-${String(form.date.getMonth() + 1).padStart(2, '0')}-${String(form.date.getDate()).padStart(2, '0')}`,
        }),
      });

      // Show success toast
      Toast.show('Event created successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
        shadow: true,
        animation: true,
        hideOnPress: true,
        delay: 0,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['dashboard']);

      // Navigate back
      router.back();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Add Event</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          
          <CustomInput
            label="Title"
            value={form.title}
            onChangeText={(text) => setForm(prev => ({ ...prev, title: text }))}
            placeholder="Enter event title"
          />

          {/* Event Type */}
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.typeButtons}>
            {EVENT_TYPES.map(type => (
              <CustomButton
                key={type.value}
                title={type.label}
                variant={form.type === type.value ? 'primary' : 'outline'}
                onPress={() => setForm(prev => ({ ...prev, type: type.value }))}
                style={styles.typeButton}
              />
            ))}
          </View>

          {/* Date Picker */}
          <Text style={styles.label}>Date</Text>
          <CustomButton
            title={form.date.toLocaleDateString()}
            variant="outline"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
          />
          {showDatePicker && Platform.OS === 'ios' && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={form.date}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setForm(prev => ({ ...prev, date: selectedDate }));
                  }
                }}
              />
              <View style={styles.datePickerButtons}>
                <CustomButton
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerButton}
                />
                <CustomButton
                  title="Confirm"
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerButton}
                />
              </View>
            </View>
          )}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={form.date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setForm(prev => ({ ...prev, date: selectedDate }));
                }
              }}
            />
          )}
        </View>

        {/* Associated Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Associated Contact (Optional)</Text>
          <CustomInput
            label="Search Contacts"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name"
          />
          {filteredContacts.length > 0 && (
            <View style={styles.contactList}>
              {filteredContacts.map(conn => (
                <CustomButton
                  key={conn.id}
                  title={`${conn.target.first_name} ${conn.target.last_name}`}
                  variant={form.person_id === conn.target.id ? 'primary' : 'outline'}
                  onPress={() => setForm(prev => ({ 
                    ...prev, 
                    person_id: prev.person_id === conn.target.id ? null : conn.target.id 
                  }))}
                  style={styles.contactButton}
                />
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          <CustomInput
            label="Notes"
            value={form.notes}
            onChangeText={(text) => setForm(prev => ({ ...prev, notes: text }))}
            placeholder="Add notes about this event"
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <CustomButton
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            style={styles.button}
            disabled={isLoading}
          />
          <CustomButton
            title={isLoading ? "Saving..." : "Save"}
            onPress={handleSave}
            style={styles.button}
            disabled={isLoading}
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
  label: {
    fontSize: wp(4),
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  typeButtons: {
    flexDirection: 'row',
    gap: wp(3),
    marginBottom: wp(3),
  },
  typeButton: {
    flex: 1,
  },
  dateButton: {
    marginBottom: wp(3),
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
  contactList: {
    gap: wp(2),
    marginTop: wp(2),
  },
  contactButton: {
    alignItems: 'flex-start',
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

export default AddEventScreen;
