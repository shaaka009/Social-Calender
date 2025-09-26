import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import LoadingState from '../../../components/LoadingState';
import MonthDayYearPicker from '../../../components/MonthDayYearPicker';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { formatDateLocal, parseDateLocal, wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';
import { useCreateTag, useTags } from '../../../helpers/useTags';

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
    no_contact_threshold: null,
    notes: '',
    tags: [],
  });
  
  // MonthDayYearPicker handles date selection

  // Initialize form data when contact loads
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.target?.first_name || '',
        last_name: person.last_name || '',
        email: person.email || '',
        phone: person.phone || '',
        birthday: person.birthday ? new Date(person.birthday) : null,
        no_contact_threshold: contact.no_contact_threshold,
        notes: person.notes || '',
        tags: contact.tags || [],
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
        tags: formData.tags,
        // Format date for API
        birthday: formData.birthday
          ? (formData.birthday instanceof Date
              ? formatDateLocal(formData.birthday)
              : formData.birthday)
          : null,
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
      Alert.alert('Error', error.message || 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  const { data: tagsList = [] } = useTags();
  const createTagMutation = useCreateTag();
  const [modalVisible, setModalVisible] = useState(false);
  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

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
    createTagMutation.mutate(newTag, {
      onSuccess: (data) => {
        setModalVisible(false);
        setNewTag({ name: '', color: '#ff8c00' });
        // auto-select
        toggleTag(data.name);
      },
    });
  };

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

        <View style={styles.divider} />

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

          {/* No Contact Threshold */}
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
          
          {/* Birthday */}
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
                  <TouchableOpacity style={styles.modalBtn} onPress={()=>setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtn} onPress={handleSaveTag}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
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
});

export default EditContactScreen; 