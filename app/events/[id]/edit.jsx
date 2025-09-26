import { Picker } from '@react-native-picker/picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import MonthDayYearPicker from '../../../components/MonthDayYearPicker';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { formatDateLocal, parseDateLocal, wp } from '../../../helpers/common';

const EditEventScreen = () => {
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch event data
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch(`${ENDPOINTS.EVENTS}${id}/`),
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    date: new Date(),
    type: 'general',
    person_id: null,
    notes: '',
  });

  // Update form when event data is loaded
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        date: parseDateLocal(event.date),
        type: event.type,
        person_id: event.person?.id || null,
        notes: event.notes || '',
      });
    }
  }, [event]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Toast.show('Please enter a title', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.error,
      });
      return;
    }

    setIsSaving(true);
    try {
      // Prepare data for API
      // Format date as YYYY-MM-DD in local timezone
      const apiData = {
        title: formData.title.trim(),
        date: formatDateLocal(formData.date),
        type: formData.type,
        notes: formData.notes.trim(),
        person_id: formData.person_id,
      };

      await apiFetch(`${ENDPOINTS.EVENTS}${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(apiData),
      });

      // Show success toast
      Toast.show('Event updated successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['event', id]);
      queryClient.invalidateQueries(['dashboard']);

      // Navigate back
      router.back();
    } catch (error) {
      Toast.show(error.message || 'Failed to update event', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.error,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !event) {
    return <LoadingState />;
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <CustomButton
          title="Cancel"
          variant="text"
          onPress={() => router.back()}
          style={styles.headerButton}
        />
        <Text style={styles.title}>Edit Event</Text>
        <CustomButton
          title="Save"
          variant="text"
          onPress={handleSave}
          disabled={isSaving}
          style={styles.headerButton}
        />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Basic Info */}
        <View style={styles.section}>
          <CustomInput
            label="Title"
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            placeholder="Enter event title"
          />

          {/* Event Type */}
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              style={styles.picker}
            >
              <Picker.Item label="Birthday" value="birthday" />
              <Picker.Item label="General Event" value="general" />
            </Picker>
          </View>

          {/* Date Picker */}
          <MonthDayYearPicker
            label="Date"
            date={formData.date}
            onChange={(d)=>setFormData(prev=>({...prev,date:d}))}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <CustomInput
            label="Notes"
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            placeholder="Add notes about this event"
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerButton: {
    minWidth: wp(20),
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: wp(5),
    gap: wp(6),
  },
  section: {
    gap: wp(4),
  },
  label: {
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(2),
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
  notesInput: {
    height: wp(40),
    textAlignVertical: 'top',
  },
});

export default EditEventScreen;
