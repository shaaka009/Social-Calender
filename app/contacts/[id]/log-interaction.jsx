import { Picker } from '@react-native-picker/picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import MonthDayYearPicker from '../../../components/MonthDayYearPicker';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';

const LogInteractionScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading: isLoadingContact } = useConnection(id);
  const person = contact?.target || {};
  const queryClient = useQueryClient();
  
  // Get current user data
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiFetch(ENDPOINTS.USER),
  });
  const [isSaving, setIsSaving] = useState(false);
  // MonthDayYearPicker handles date selection
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date(new Date().setHours(0, 0, 0, 0)),  // Initialize to start of today
    type: 'call',  // default to call
    notes: '',
  });

  const interactionTypes = [
    { value: 'call', label: 'Phone Call' },
    { value: 'meeting', label: 'In-person Meeting' },
    { value: 'message', label: 'Message/Text' },
    { value: 'email', label: 'Email' },
    { value: 'video_call', label: 'Video Call' },
    { value: 'social', label: 'Social Media' },
    { value: 'other', label: 'Other' },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch(ENDPOINTS.INTERACTIONS, {
        method: 'POST',
        body: JSON.stringify({
          actor_person_id: contact.owner.id,
          target_person_id: person.id,
          date: formData.date.toISOString().split('T')[0],
          type: formData.type,
          notes: formData.notes,
        }),
      });

      // Show success toast
      Toast.show('Interaction logged successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
        shadow: true,
        animation: true,
        hideOnPress: true,
        delay: 0,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['interactions', id]);
      queryClient.invalidateQueries(['connection', id]);

      // Navigate back
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      Toast.show(error.message || 'Failed to log interaction', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.danger,
        shadow: true,
        animation: true,
        hideOnPress: true,
        delay: 0,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingContact || isLoadingUser || !contact || !currentUser) {
    return <LoadingState />;
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Log Interaction</Text>
        <Text style={styles.subtitle}>with {person.first_name} {person.last_name}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Date Picker */}
        <View style={styles.section}>
          <MonthDayYearPicker
            label="Date"
            date={formData.date}
            onChange={(d)=>setFormData(prev=>({...prev,date:d}))}
          />
        </View>

        {/* Interaction Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Type of Interaction</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              style={styles.picker}
            >
              {interactionTypes.map(type => (
                <Picker.Item 
                  key={type.value} 
                  label={type.label} 
                  value={type.value}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <CustomInput
            label="Notes"
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            placeholder="Add notes about this interaction"
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
    alignItems: 'center',
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    marginTop: wp(1),
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
  label: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    marginBottom: wp(2),
  },
  dateButton: {
    marginBottom: wp(3),
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(2),
    backgroundColor: theme.colors.backgroundSecondary,
  },
  picker: {
    color: theme.colors.text,
  },
  notesInput: {
    height: wp(40),
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
    borderRadius: theme.radius.md,
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

export default LogInteractionScreen; 