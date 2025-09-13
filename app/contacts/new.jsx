import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { formatDateLocal, wp } from '../../helpers/common';

const AddContactScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  
  // User search results
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: () => searchQuery.trim() 
      ? apiFetch(`${ENDPOINTS.USER_SEARCH}?q=${encodeURIComponent(searchQuery.trim())}`)
      : [],
    enabled: searchQuery.trim().length > 0
  });

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, ] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Use a Date object for consistency with the Event picker implementation
  const [tempDate, setTempDate] = useState(new Date());

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAddContact = useCallback(async (userId) => {
    try {
      await apiFetch(ENDPOINTS.CONNECTIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_person_id: Number(userId) }),
      });
      Alert.alert('Success', 'Contact request sent!');
      router.replace('/contacts');
    } catch (err) {
      Alert.alert(
        'Error',
        typeof err.data === 'object' 
          ? Object.values(err.data).flat().join('\n')
          : err.message || 'Failed to add contact'
      );
    }
  }, []);

  const handleManualSubmit = async () => {
    if (!form.first_name.trim()) {
      Alert.alert('Error', 'First name is required');
      return;
    }

    setLoading(true);
    try {
      await apiFetch(ENDPOINTS.CONNECTIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
        }),
      });
      router.replace('/contacts');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  const renderSearchResults = () => {
    if (!searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Search for users by name or email
          </Text>
        </View>
      );
    }

    if (isSearching) {
      return <LoadingState />;
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No users found
          </Text>
          <CustomButton
            title="Add as Manual Contact"
            variant="outline"
            onPress={() => setShowManualForm(true)}
            style={{ marginTop: wp(4) }}
          />
        </View>
      );
    }

    return searchResults.map(user => (
      <View key={user.id} style={styles.userCard}>
        <View>
          <Text style={styles.userName}>
            {user.first_name} {user.last_name}
          </Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        
        {user.connection_status?.status === 'none' && (
          <CustomButton
            title="Add Contact"
            onPress={() => handleAddContact(user.id)}
          />
        )}
        
        {user.connection_status?.status === 'pending' && (
          <Text style={styles.statusText}>Request Sent</Text>
        )}
        
        {user.connection_status?.status === 'accepted' && (
          <Text style={styles.statusText}>Already Connected</Text>
        )}
      </View>
    ));
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
        <Text style={styles.headerTitle}>Add Contact</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {!showManualForm ? (
          <>
            <CustomInput
              label="Search Users"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Enter name or email"
            />
            
            <View style={styles.searchResults}>
              {renderSearchResults()}
            </View>

            <CustomButton
              title="Add Manual Contact Instead"
              variant="outline"
              onPress={() => setShowManualForm(true)}
              style={{ marginTop: wp(4) }}
            />
          </>
        ) : (
          <>
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
                  value={tempDate}
                  mode="date"
                  display="spinner"
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
                      setTempDate(new Date());
                    }}
                    style={styles.datePickerButton}
                  />
                  <CustomButton
                    title="Confirm"
                    onPress={() => {
                      if (tempDate) {
                        handleChange('birthday', formatDateLocal(tempDate));
                      }
                      setShowDatePicker(false);
                      setTempDate(new Date());
                    }}
                    style={styles.datePickerButton}
                  />
                </View>
              </View>
            )}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    handleChange('birthday', formatDateLocal(selectedDate));
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
            <CustomButton 
              title="Save Manual Contact" 
              onPress={handleManualSubmit}
              disabled={loading}
            />
            <CustomButton
              title="Search for Users Instead"
              variant="outline"
              onPress={() => setShowManualForm(false)}
              style={{ marginTop: wp(4) }}
            />
          </>
        )}
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
    minWidth: wp(15),
  },
  backButtonText: {
    fontSize: wp(7),
    color: theme.colors.primary,
    marginRight: wp(1),
    marginTop: -wp(1),
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
  searchResults: {
    flex: 1,
    gap: wp(3),
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    ...theme.shadows.small,
  },
  userName: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginTop: wp(1),
  },
  statusText: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp(8),
  },
  emptyStateText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
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