import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import LoadingState from '../../components/LoadingState';
import MonthDayYearPicker from '../../components/MonthDayYearPicker';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { formatDateLocal, parseDateLocal, wp } from '../../helpers/common';
import { useCreateTag, useTags } from '../../helpers/useTags';

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
    profile_picture: null,
  });
  // Contact methods table rows: {type: string, value: string}
  const [contactRows, setContactRows] = useState([
    { type: 'Phone', value: '' },
    { type: 'Email', value: '' },
  ]);
  const [selectedTags, setSelectedTags] = useState([]);
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();

  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

  const [loading, setLoading] = useState(false);
  const [errors, ] = useState({});
  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        handleChange('profile_picture', result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image');
    }
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
      // Build payload from form + contact rows
      const payload = { ...form };
      // Extract email/phone if present
      contactRows.forEach(({ type, value }) => {
        const key = type.trim().toLowerCase();
        if (!value.trim()) return;
        if (key === 'phone') payload.phone = value.trim();
        else if (key === 'email') payload.email = value.trim();
        else {
          if (!payload.extra_contacts) payload.extra_contacts = [];
          payload.extra_contacts.push({ type: type.trim(), value: value.trim() });
        }
      });
      if (selectedTags.length) payload.tags = selectedTags;

      await apiFetch(ENDPOINTS.CONNECTIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        {showManualForm ? (
          <Pressable onPress={handleManualSubmit} disabled={loading} style={styles.saveButtonHeader}>
            <Text style={styles.saveButtonHeaderText}>{loading ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <ScrollView contentContainerStyle={showManualForm ? styles.containerManual : styles.container}>
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

            <View style={styles.manualContactRow}>
                <CustomButton
                  title="Add Manual Contact"
                  variant="text"
                  onPress={() => setShowManualForm(true)}
                  style={styles.manualContactButton}
                  textStyle={styles.manualContactButtonText}
                />
            </View>
          </>
        ) : (
          <>
            {/* Profile Picture Selector */}
            <Pressable onPress={handleImagePick} style={styles.imageContainer}>
              {form.profile_picture ? (
                <Image source={{ uri: form.profile_picture }} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>{form.first_name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>

            {/* Name Row */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: wp(2) }}>
                <CustomInput
                  label="First Name*"
                  value={form.first_name}
                  onChangeText={text => handleChange('first_name', text)}
                  error={errors.first_name}
                />
              </View>
              <View style={{ flex: 1 }}>
                <CustomInput
                  label="Last Name"
                  value={form.last_name}
                  onChangeText={text => handleChange('last_name', text)}
                  error={errors.last_name}
                />
              </View>
            </View>

            {/* Contact Information Table */}
            <Text style={styles.sectionLabel}>Contact Information</Text>

            {contactRows.map((row, idx) => (
              <View key={idx} style={styles.contactRow}>
                <TextInput
                  style={[styles.contactTypeInput, idx < 2 && styles.readOnlyInput]}
                  value={row.type}
                  onChangeText={text => setContactRows(prev => prev.map((r,i)=> i===idx ? { ...r, type: text } : r))}
                  editable={idx >= 2}
                  placeholder="Type"
                  placeholderTextColor={theme.colors.textLight + '90'}
                />
                <TextInput
                  style={styles.contactValueInput}
                  value={row.value}
                  onChangeText={text => setContactRows(prev => prev.map((r,i)=> i===idx ? { ...r, value: text } : r))}
                  placeholder="Enter info"
                  keyboardType={row.type.toLowerCase() === 'phone' ? 'phone-pad' : row.type.toLowerCase() === 'email' ? 'email-address' : 'default'}
                  placeholderTextColor={theme.colors.textLight + '90'}
                />
              </View>
            ))}

            {/* Add method row */}
            <Pressable style={styles.addContactBtn} onPress={() => setContactRows(prev => [...prev, { type: '', value: '' }])}>
              <Text style={styles.addContactBtnText}>＋ Add another contact method</Text>
            </Pressable>
 
            {/* Birthday Picker */}
            <MonthDayYearPicker
              label="Birthday"
              date={form.birthday ? parseDateLocal(form.birthday) : new Date()}
              onChange={(d)=>handleChange('birthday', formatDateLocal(d))}
            />

            {/* Tags */}
            <Text style={styles.sectionLabel}>Tags</Text>
            {/* Tags Row */}
            <View style={styles.tagsRow}>
              <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.plusText}>+</Text>
              </Pressable>

              <FlatList
                data={tags}
                horizontal
                keyExtractor={(item) => item.name}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsContainer}
                renderItem={({ item: tag }) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <Pressable
                      onPress={() => setSelectedTags(prev => prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name])}
                      style={[styles.tagButton, {
                        backgroundColor: isSelected ? tag.color || theme.colors.primary : 'transparent',
                        borderColor: tag.color || theme.colors.primary,
                      }]}
                    >
                      <Text style={[styles.tagText, { color: isSelected ? '#fff' : theme.colors.textLight }]}>
                        {tag.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>

            {/* Create Tag Modal */}
            <Modal
              visible={modalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setModalVisible(false)}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Create Tag</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Tag name"
                    value={newTag.name}
                    onChangeText={(text) => setNewTag((prev) => ({ ...prev, name: text }))}
                  />
                  <View style={styles.colorsRow}>
                    {COLOR_OPTIONS.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.colorDot, { backgroundColor: c }, newTag.color === c && styles.colorDotSelected]}
                        onPress={() => setNewTag((prev) => ({ ...prev, color: c }))}
                      />
                    ))}
                  </View>
                  <View style={styles.modalActions}>
                    <Pressable style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.modalBtn}
                      onPress={() => {
                        if (!newTag.name.trim()) return;
                        createTagMutation.mutate(newTag, {
                          onSuccess: () => {
                            setModalVisible(false);
                            setNewTag({ name: '', color: COLOR_OPTIONS[0] });
                          },
                        });
                      }}
                    >
                      <Text style={styles.saveText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
            {/* Save button moved to header */}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  manualContactRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: wp(2),
    marginBottom: wp(2),
  },

  manualContactButton: {
    alignSelf: 'center',
    width: '150%',
  },
  manualContactButtonText: {
    fontSize: wp(5),  
    fontWeight: '500',
  },
  
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
  containerManual: {
    flexGrow: 1,
    padding: wp(5),
    gap: wp(4),
    backgroundColor: theme.colors.background,
    paddingBottom: wp(80),
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
  /* Tags */
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  plusButton: {
    backgroundColor: theme.colors.primary,
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#fff',
    fontSize: wp(6),
    lineHeight: wp(8),
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: wp(2),
  },
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    borderWidth: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    minHeight: wp(8),
    justifyContent: 'center',
  },
  tagText: {
    fontSize: wp(3.5),
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp(3),
    padding: wp(5),
    width: '80%',
  },
  modalTitle: {
    fontSize: wp(5),
    fontWeight: '600',
    marginBottom: wp(3),
    color: theme.colors.text,
  },
  modalInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(3),
    color: theme.colors.text,
  },
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginBottom: wp(4),
  },
  colorDot: {
    width: wp(7),
    height: wp(7),
    borderRadius: wp(3.5),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: wp(3),
  },
  modalBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1),
  },
  cancelText: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: wp(2),
  },
  sectionLabel: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  addContactBtn: {
    alignSelf: 'center',
    marginTop: wp(2),
    paddingVertical: wp(2),
    paddingHorizontal: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addContactBtnText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: wp(2),
  },
  contactTypeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    padding: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  contactValueInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    padding: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  readOnlyInput: {
    backgroundColor: theme.colors.backgroundSecondary,
  },

  /* Image */
  imageContainer: {
    alignItems: 'center',
    marginBottom: wp(4),
  },
  profileImage: {
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
  },
  placeholderImage: {
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: wp(12),
    fontWeight: 'bold',
  },
  changePhotoText: {
    marginTop: wp(2),
    color: theme.colors.primary,
    fontSize: wp(3.5),
  },
  saveButtonHeader: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1),
  },
  saveButtonHeaderText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
});

export default AddContactScreen; 