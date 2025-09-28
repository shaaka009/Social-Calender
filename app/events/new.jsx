import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import MonthDayYearPicker from '../../components/MonthDayYearPicker';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';
import { useCreateTag, useTags } from '../../helpers/useTags';

const EVENT_TYPES = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'general', label: 'General' },
];

const AddEventScreen = () => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [form, setForm] = useState({
    title: '',
    date: new Date(),
    type: 'general',
    people_ids: [],
    tag_ids: [],
    notes: '',
  });

  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

  // Get tags for selection
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

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
          // For birthday events with no year specified, use a special format
          date: form.type === 'birthday' && form.date.noYear
            ? `0000-${String(form.date.getMonth() + 1).padStart(2, '0')}-${String(form.date.getDate()).padStart(2, '0')}`
            : `${form.date.getFullYear()}-${String(form.date.getMonth() + 1).padStart(2, '0')}-${String(form.date.getDate()).padStart(2, '0')}`,
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
          <MonthDayYearPicker
            label="Date"
            date={form.date}
            onChange={(d)=>setForm(prev=>({...prev,date:d}))}
            yearOptional={form.type === 'birthday'}
            showYear={true}
          />
        </View>

        {/* Associated Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Associated Contacts (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Select one or more contacts for this event</Text>
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
                  variant={form.people_ids.includes(conn.target.id) ? 'primary' : 'outline'}
                  onPress={() => setForm(prev => ({ 
                    ...prev, 
                    people_ids: prev.people_ids.includes(conn.target.id)
                      ? prev.people_ids.filter(id => id !== conn.target.id)
                      : [...prev.people_ids, conn.target.id]
                  }))}
                  style={styles.contactButton}
                />
              ))}
            </View>
          )}
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <Text style={styles.sectionSubtitle}>Add tags to help organize your events</Text>
          
          <View style={styles.tagsRow}>
            <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
              <Ionicons name="add" size={wp(6)} color="#fff" />
            </Pressable>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsContainer}
            >
              {tags.map(tag => (
                <Pressable
                  key={tag.id}
                  onPress={() => setForm(prev => ({
                    ...prev,
                    tag_ids: prev.tag_ids.includes(tag.id)
                      ? prev.tag_ids.filter(id => id !== tag.id)
                      : [...prev.tag_ids, tag.id]
                  }))}
                  style={[styles.tagButton, {
                    backgroundColor: form.tag_ids.includes(tag.id) ? tag.color : 'transparent',
                    borderColor: tag.color,
                  }]}
                >
                  <Text style={[styles.tagText, { 
                    color: form.tag_ids.includes(tag.id) ? '#fff' : theme.colors.textLight 
                  }]}>{tag.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
                        onSuccess: (newTagData) => {
                          setModalVisible(false);
                          setNewTag({ name: '', color: COLOR_OPTIONS[0] });
                          // Add the new tag to the selected tags
                          setForm(prev => ({
                            ...prev,
                            tag_ids: [...prev.tag_ids, newTagData.id]
                          }));
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
    marginBottom: wp(3),
    gap: wp(2),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  sectionSubtitle: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
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
  /* Tags */
  tagsContainer: {
    flexDirection: 'row',
    gap: wp(2),
    paddingHorizontal: wp(2),
    paddingVertical: wp(1),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    borderWidth: 1,
    minHeight: wp(8),
    justifyContent: 'center',
  },
  tagText: {
    fontSize: wp(3.5),
  },
  plusButton: {
    backgroundColor: theme.colors.primary,
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
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
});

export default AddEventScreen;
