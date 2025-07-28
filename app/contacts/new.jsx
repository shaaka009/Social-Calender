import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';

const AddContactScreen = () => {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    tags: '', // comma-separated
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);
  const queryClient = useQueryClient();

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'Required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    // birthday is always ISO string from date picker; no manual regex check needed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
    };

    setLoading(true);
    try {
      await apiFetch(ENDPOINTS.CONTACTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Refresh cached contacts then navigate back
      queryClient.invalidateQueries(['contacts']);
      router.replace('/contacts');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      {/* Navigation Header */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Contact</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <CustomInput
          label="First Name*"
          value={form.first_name}
          onChangeText={text => handleChange('first_name', text)}
          error={errors.first_name}
        />
        <CustomInput
          label="Last Name"
          value={form.last_name}
          onChangeText={text => handleChange('last_name', text)}
          error={errors.last_name}
        />
        <CustomInput
          label="Email"
          value={form.email}
          onChangeText={text => handleChange('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <CustomInput
          label="Phone"
          value={form.phone}
          onChangeText={text => handleChange('phone', text)}
          keyboardType="phone-pad"
        />
        {/* Birthday Picker */}
        <View style={styles.birthdayContainer}>
          <Text style={styles.label}>Birthday</Text>
          <TouchableOpacity 
            style={[
              styles.birthdayButton,
              form.birthday && styles.birthdayButtonSelected
            ]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[
              styles.birthdayButtonText,
              form.birthday && styles.birthdayButtonTextSelected
            ]}>
              {form.birthday 
                ? new Date(form.birthday).toLocaleDateString() 
                : 'Select date'}
            </Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && Platform.OS === 'ios' && (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={tempDate || form.birthday ? new Date(tempDate || form.birthday) : new Date()}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setTempDate(selectedDate.toISOString());
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
                    handleChange('birthday', tempDate.slice(0, 10));
                  }
                  setShowDatePicker(false);
                  setTempDate(null);
                }}
                style={styles.datePickerButton}
              />
            </View>
          </View>
        )}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={form.birthday ? new Date(form.birthday) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                handleChange('birthday', selectedDate.toISOString().slice(0, 10));
              }
            }}
          />
        )}
        <CustomInput
          label="Tags (comma separated)"
          value={form.tags}
          onChangeText={text => handleChange('tags', text)}
        />
        <View style={{ height: wp(4) }} />
        <CustomButton title="Save Contact" onPress={handleSubmit} disabled={loading} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: wp(4),
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: wp(15), // Ensures header title stays centered
  },
  backButtonText: {
    fontSize: wp(7),
    color: theme.colors.primary,
    marginRight: wp(1),
    marginTop: -wp(1), // Visual alignment for arrow
  },
  backButtonLabel: {
    fontSize: wp(4),
    color: theme.colors.primary,
  },
  container: {
    flexGrow: 1,
    padding: wp(5),
    gap: wp(4),
    backgroundColor: theme.colors.background,
  },
  birthdayContainer: {
    gap: wp(2),
  },
  label: {
    fontSize: wp(4),
    fontWeight: "500",
    color: theme.colors.text,
  },
  birthdayButton: {
    padding: wp(4),
    borderRadius: wp(3),
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  birthdayButtonSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  birthdayButtonText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
  },
  birthdayButtonTextSelected: {
    color: theme.colors.primary,
  },
  datePickerContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: wp(4),
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: wp(3),
    marginTop: wp(4),
  },
  datePickerButton: {
    flex: 1,
  },
});

export default AddContactScreen; 