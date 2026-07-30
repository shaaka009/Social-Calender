import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import MonthDayYearPicker from '../../../components/MonthDayYearPicker';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { TAG_COLOR_OPTIONS } from '../../../constants/tagColors';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { formatDateLocal, parseDateLocal, wp } from '../../../helpers/common';
import { useOneShot, useSubmitGuard } from '../../../helpers/useSubmitGuard';
import useConnection from '../../../helpers/useConnection';
import { useCreateTag, useTags } from '../../../helpers/useTags';

const EditContactScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};
  const navigation = useNavigation();

  // Hide the native header so we can render a custom one like the profile edit screen
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const queryClient = useQueryClient();
  const { isSubmitting, run } = useSubmitGuard();
  const { isSubmitting: isCreatingTag, run: runCreateTag } = useSubmitGuard();
  const goOnce = useOneShot();
  const { data: tagsList = [] } = useTags();
  const createTagMutation = useCreateTag();
  const [modalVisible, setModalVisible] = useState(false);
  const COLOR_OPTIONS = TAG_COLOR_OPTIONS;
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    nickname: '',
    organization: '',
    birthday: null,
    no_contact_threshold: null,
    notes: '',
    tags: [],
    profile_picture: null,
  });

  // Contact rows table similar to profile screen
  const [contactRows, setContactRows] = useState([
    { type: 'Phone', value: '' },
    { type: 'Email', value: '' },
  ]);
  
  // MonthDayYearPicker handles date selection

  // Initialize form data when contact loads
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.target?.first_name || '',
        last_name: person.last_name || '',
        email: person.email || '',
        phone: person.phone || '',
        nickname: contact.nickname || '',
        organization: contact.effective_organization || person.organization || '',
        // Use parseDateLocal to construct the date in local timezone to avoid off-by-one errors
        birthday: person.birthday ? parseDateLocal(person.birthday) : null,
        no_contact_threshold: contact.no_contact_threshold,
        notes: contact.notes || person.notes || '',
        tags: contact.tags || [],
        profile_picture: person.profile_picture_url || person.profile_picture || null,
      });

      // Populate contact rows
      setContactRows([
        { type: 'Phone', value: person.phone || '' },
        { type: 'Email', value: person.email || '' },
        ...(Array.isArray(person.extra_contacts) ? person.extra_contacts : []),
      ]);
    }
  }, [contact]);

  const isAppUser = Boolean(contact?.target?.is_app_user);

  // Image picker for manual contacts
  const handleImagePick = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to choose a contact photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        setFormData(prev => ({ ...prev, profile_picture: result.assets[0].uri }));
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = () => run(async () => {
    try {
      // Build payload from formData and contactRows similar to profile edit logic
      const payload = { ...formData };

      // Remove potential stale keys—we will rebuild from contactRows
      delete payload.phone;
      delete payload.email;
      delete payload.extra_contacts;

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
      // Remove organization if blank to avoid wiping unintentionally
      if (!payload.organization?.trim()) delete payload.organization;
      if (!payload.nickname?.trim()) delete payload.nickname;

      // Format date for API
      payload.birthday = formData.birthday
        ? formData.birthday instanceof Date
          ? formatDateLocal(formData.birthday)
          : formData.birthday
        : null;

      const hasLocalImage = typeof formData.profile_picture === 'string' && (
        formData.profile_picture.startsWith('file://') || formData.profile_picture.startsWith('content://')
      );

      // App-user identity fields are read-only; only connection-level fields are editable.
      let payloadForRequest = payload;
      if (isAppUser) {
        const {
          first_name,
          last_name,
          email,
          phone,
          birthday,
          ...editableFields
        } = payload;
        payloadForRequest = editableFields;
      }

      let requestBody = null;
      let headers = {};

      if (hasLocalImage) {
        const fd = new FormData();
        Object.entries(payloadForRequest).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (key === 'profile_picture') return;
          if (key === 'tags' && Array.isArray(value)) {
            value.forEach(t => fd.append('tags', t));
            return;
          }
          if (typeof value === 'object') {
            fd.append(key, JSON.stringify(value));
          } else {
            fd.append(key, value.toString());
          }
        });
        fd.append('profile_picture', {
          uri: formData.profile_picture,
          name: 'profile.jpg',
          type: 'image/jpeg',
        });
        requestBody = fd;
      } else {
        delete payloadForRequest.profile_picture;
        requestBody = JSON.stringify(payloadForRequest);
        headers['Content-Type'] = 'application/json';
      }

      await apiFetch(`${ENDPOINTS.CONNECTIONS}${id}/`, {
        method: 'PATCH',
        body: requestBody,
        headers,
      });

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
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connection', id] });

      // Navigate back (keep the guard active during the toast delay so a
      // second tap can't fire another PATCH before we leave the screen).
      await new Promise((resolve) => setTimeout(resolve, 500));
      goOnce(() => router.back());
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update contact');
    }
  });

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  const toggleTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSaveTag = () => {
    if (!newTag.name.trim()) return;
    runCreateTag(async () => {
      const data = await createTagMutation.mutateAsync(newTag);
      setModalVisible(false);
      setNewTag({ name: '', color: '#ff8c00' });
      // auto-select
      toggleTag(data.name);
    });
  };

  return (
    <ScreenWrapper>
      {/* Custom Header – mirrors profile edit header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goOnce(() => router.back())} disabled={isSubmitting}>
          <Ionicons name="arrow-back" size={wp(5)} color={theme.colors.primary} />
          <Text style={styles.backButtonLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Contact</Text>
        <Pressable style={styles.saveButtonHeader} onPress={handleSave} disabled={isSubmitting}>
          <Text style={styles.saveButtonHeaderText}>{isSubmitting ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
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
            <CustomInput
              label="Organization"
              value={formData.organization}
              onChangeText={(text) => setFormData(prev => ({ ...prev, organization: text }))}
              placeholder="Organization"
            />
            <CustomInput
              label="Nickname"
              value={formData.nickname}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nickname: text }))}
              placeholder="Nickname"
            />
          </View>
        ) : (
          <>
            {/* Manual Contact - All fields editable */}
            <Pressable onPress={handleImagePick} style={styles.imageContainer}>
              {formData.profile_picture ? (
                <Image source={{ uri: formData.profile_picture }} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>{formData.first_name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              {/* First + Last name in same row */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: wp(2) }}>
                  <CustomInput
                    label="First Name"
                    value={formData.first_name}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, first_name: text }))}
                    placeholder="First name"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CustomInput
                    label="Last Name"
                    value={formData.last_name}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, last_name: text }))}
                    placeholder="Last name"
                  />
                </View>
              </View>
              {/* Nickname */}
              <CustomInput
                label="Nickname"
                value={formData.nickname}
                onChangeText={(text) => setFormData(prev => ({ ...prev, nickname: text }))}
                placeholder="Nickname"
              />
              {/* Organization */}
              <CustomInput
                label="Organization"
                value={formData.organization}
                onChangeText={(text) => setFormData(prev => ({ ...prev, organization: text }))}
                placeholder="Organization"
              />
            </View>

            {/* Contact Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              {contactRows.map((row, idx) => (
                <View key={idx} style={styles.contactRow}>
                  <TextInput
                    style={[styles.contactTypeInput, idx < 2 && styles.readOnlyInput]}
                    value={row.type}
                    onChangeText={(text) =>
                      setContactRows((prev) => prev.map((r, i) => (i === idx ? { ...r, type: text } : r)))
                    }
                    editable={idx >= 2}
                    placeholder="Type"
                    placeholderTextColor={theme.colors.textLight + '90'}
                  />
                  <TextInput
                    style={styles.contactValueInput}
                    value={row.value}
                    onChangeText={(text) =>
                      setContactRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: text } : r)))
                    }
                    placeholder="Enter info"
                    keyboardType={
                      row.type.toLowerCase() === 'phone'
                        ? 'phone-pad'
                        : row.type.toLowerCase() === 'email'
                        ? 'email-address'
                        : 'default'
                    }
                    placeholderTextColor={theme.colors.textLight + '90'}
                  />
                </View>
              ))}
              <Pressable
                style={styles.addContactBtn}
                onPress={() => setContactRows((prev) => [...prev, { type: '', value: '' }])}
              >
                <Text style={styles.addContactBtnText}>＋ Add another contact method</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* No Contact Alert Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>No Contact Alert</Text>
          <View style={styles.thresholdContainer}>
            <View style={styles.thresholdHeader}>
              <Text style={styles.label}>No Contact Alert</Text>
              <Switch
                value={formData.no_contact_threshold !== null}
                onValueChange={(enabled) => {
                  setFormData(prev => ({
                    ...prev,
                    no_contact_threshold: enabled ? 30 : null
                  }));
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                thumbColor={formData.no_contact_threshold !== null ? theme.colors.primary : theme.colors.textLight}
              />
            </View>
            {formData.no_contact_threshold !== null && (
              <View style={styles.thresholdContent}>
                <Text style={styles.thresholdLabel}>Alert me after</Text>
                <View style={styles.thresholdInputContainer}>
                  <CustomInput
                    value={formData.no_contact_threshold.toString()}
                    onChangeText={(text) => {
                      const value = text.trim() === '' ? 30 : parseInt(text, 10);
                      setFormData(prev => ({ ...prev, no_contact_threshold: value }));
                    }}
                    keyboardType="number-pad"
                    style={styles.thresholdInput}
                  />
                  <Text style={styles.thresholdUnit}>days</Text>
                </View>
              </View>
            )}
            <Text style={styles.helper}>
              {formData.no_contact_threshold === null 
                ? "No alerts will be generated for this contact" 
                : `You'll be notified if you haven't contacted ${person.first_name} in ${formData.no_contact_threshold} days`}
            </Text>
          </View>
        </View>
          
          {/* Birthday */}
          <View style={styles.section}>
            <MonthDayYearPicker
              label="Birthday"
              date={(() => {
                if (!formData.birthday) return new Date();
                return typeof formData.birthday === 'string'
                  ? parseDateLocal(formData.birthday)
                  : new Date(formData.birthday);
              })()}
              onChange={(d)=>setFormData(prev=>({...prev,birthday:d}))}
            />
          </View>

        {/* Tags Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsRow}>
            <TouchableOpacity style={styles.plusButton} onPress={() => setModalVisible(true)}>
              <Text style={{ color: '#fff', fontSize: wp(5) }}>＋</Text>
            </TouchableOpacity>

            <FlatList
              data={tagsList.map(t=>t)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item)=>item.name}
              contentContainerStyle={styles.tagsContainer}
              renderItem={({item:tag})=> (
                <TouchableOpacity
                  style={[styles.tagButton,{
                    backgroundColor: formData.tags.includes(tag.name)?((tag.color&&tag.color!=='#cccccc')?tag.color:theme.colors.primary):'transparent',
                    borderWidth:1,
                    borderColor: tag.color||theme.colors.primary,
                  }]}
                  onPress={()=>toggleTag(tag.name)}
                >
                  <Text style={[styles.tagText,{color:formData.tags.includes(tag.name)?'#fff':theme.colors.textLight}]}>{tag.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Modal copied from main screen */}
          <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={()=>setModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Create Tag</Text>
                <TextInput style={styles.modalInput} placeholder="Tag name" value={newTag.name} onChangeText={(text)=>setNewTag(prev=>({...prev,name:text}))}/>
                <View style={styles.colorsRow}>
                  {COLOR_OPTIONS.map(c=> (
                    <TouchableOpacity key={c} style={[styles.colorDot,{backgroundColor:c},newTag.color===c&&styles.colorDotSelected]} onPress={()=>setNewTag(prev=>({...prev,color:c}))}/>
                  ))}
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtn} onPress={()=>setModalVisible(false)} disabled={isCreatingTag}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtn} onPress={handleSaveTag} disabled={isCreatingTag}>
                    <Text style={[styles.saveText, isCreatingTag && { opacity: 0.5 }]}>
                      {isCreatingTag ? 'Saving…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          </View>

        <View style={styles.divider} />

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Information</Text>
          <CustomInput
            label=""
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            placeholder="Add notes about this contact"
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: wp(3),
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
  saveButtonHeader: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1),
  },
  saveButtonHeaderText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: wp(5),
    gap: wp(4),
    paddingBottom: wp(60),
    backgroundColor: theme.colors.background,
  },
  section: {
    marginBottom: wp(6),
    gap: wp(2),
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
  thresholdContainer: {
    marginBottom: wp(3),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
  },
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(3),
  },
  thresholdContent: {
    marginTop: wp(2),
    paddingTop: wp(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  thresholdLabel: {
    fontSize: wp(3.8),
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  thresholdInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  thresholdInput: {
    width: wp(20),
  },
  thresholdUnit: {
    fontSize: wp(4),
    color: theme.colors.text,
  },
  helper: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginTop: wp(3),
    fontStyle: 'italic',
  },

  /* Tag styles */
  newTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(3),
    gap: wp(2),
  },
  newTagInput: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    color: theme.colors.text,
  },
  addTagButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    borderRadius: wp(2),
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: wp(2),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  tagButton: {
    paddingHorizontal: wp(5),
    borderRadius: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    height: wp(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  tagText: {
    color: '#fff',
  },
  tagTextSelected: {
    color: '#fff',
  },
  plusButton: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
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
  modalActions: {
    flexDirection: 'row',
    gap: wp(3),
  },
  modalBtn: {
    flex: 1,
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
  cancelText: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: wp(4),
  },

  /* New styles for contact rows */
  rowInputs: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: wp(3),
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: wp(2),
  },
  contactTypeInput: {
    flex: 1,
    fontSize: wp(4),
    color: theme.colors.text,
    paddingVertical: 0,
  },
  contactValueInput: {
    flex: 1,
    fontSize: wp(4),
    color: theme.colors.text,
    paddingVertical: 0,
  },
  readOnlyInput: {
    color: theme.colors.textLight + '90',
  },
  addContactBtn: {
    marginTop: wp(3),
    alignItems: 'center',
  },
  addContactBtnText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: wp(5),
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
});

// Hide default header for Expo Router (v2)
export const options = { headerShown: false };

export default EditContactScreen; 