import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import CustomInput from '../../../components/CustomInput';
import DateRangePicker from '../../../components/DateRangePicker';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { EVENT_TYPES } from '../../../constants/eventTypes';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { parseDateLocal, wp } from '../../../helpers/common';
import useContacts from '../../../helpers/useContacts';
import { useCreateTag, useTags } from '../../../helpers/useTags';

const EditEventScreen = () => {
  const { id } = useLocalSearchParams();
  const eventId = Array.isArray(id) ? id[0] : id;
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Form state (declare BEFORE using in displayedContacts)
  const [formData, setFormData] = useState({
    title: '',
    start_date: new Date(),
    end_date: null,
    type: 'general',
    people_ids: [],
    tag_ids: [],
    notes: '',
  });

  // Contacts & tags data
  const { data: contacts = [] } = useContacts();
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const filteredContacts = useMemo(() => contacts.filter(conn => {
    const searchLower = searchQuery.toLowerCase();
    const name = `${conn.target.first_name} ${conn.target.last_name}`.toLowerCase();
    return !searchQuery || name.includes(searchLower);
  }), [contacts, searchQuery]);

  // Contacts to display in grid: if user is actively searching (showContacts) use filtered list,
  // otherwise show currently selected contacts so they are visible on initial load.
  const displayedContacts = useMemo(
    () => (showContacts ? filteredContacts : contacts.filter((conn) => formData.people_ids.includes(conn.target.id))),
    [contacts, filteredContacts, formData.people_ids, showContacts]
  );

  const togglePersonSelection = useCallback((personId, currentlySelected) => {
    setFormData((prev) => ({
      ...prev,
      people_ids: currentlySelected
        ? prev.people_ids.filter((id) => id !== personId)
        : [...prev.people_ids, personId],
    }));
  }, []);

  const renderContactItem = useCallback(({ item: conn }) => {
    const selected = formData.people_ids.includes(conn.target.id);
    const person = conn.target;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => togglePersonSelection(conn.target.id, selected)}
      >
        <View style={styles.avatarWrapper}>
          {person.profile_picture_url ? (
            <Image source={{ uri: person.profile_picture_url }} style={styles.gridAvatar} />
          ) : (
            <View style={[styles.gridAvatar, styles.gridAvatarPlaceholder]}>
              <Text style={styles.gridAvatarText}>{person.first_name?.[0]}{person.last_name?.[0]}</Text>
            </View>
          )}
          {selected && (
            <Ionicons name="checkmark-circle" size={wp(6)} color={theme.colors.primary} style={styles.checkIcon} />
          )}
        </View>
        <Text style={styles.gridName} numberOfLines={1}>{person.first_name}</Text>
      </TouchableOpacity>
    );
  }, [formData.people_ids, togglePersonSelection]);

  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

  // Bottom sheet for event type selection (same as AddEvent)
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openTypeSheet = () => {
    sheetAnim.setValue(SCREEN_HEIGHT);
    setTypeSheetVisible(true);
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const closeTypeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setTypeSheetVisible(false));
  };

  // Fetch event data
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiFetch(`${ENDPOINTS.EVENTS}${eventId}/`),
    enabled: Boolean(eventId),
    staleTime: 60 * 1000,
  });

  // Update form when event data is loaded
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        start_date: parseDateLocal(event.start_date),
        end_date: event.end_date ? parseDateLocal(event.end_date) : null,
        type: event.type,
        people_ids: event.people?.map(p=>p.id) || [],
        tag_ids: event.tags?.map(t=>t.id) || [],
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
      const format = (d) => {
        if (!d) return null;
        if (formData.type === 'birthday' && d.noYear) {
          return `0000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const apiData = {
        title: formData.title.trim(),
        start_date: format(formData.start_date),
        end_date: formData.end_date ? format(formData.end_date) : null,
        type: formData.type,
        notes: formData.notes.trim(),
        people_ids: formData.people_ids,
        tag_ids: formData.tag_ids,
      };

      await apiFetch(`${ENDPOINTS.EVENTS}${eventId}/`, {
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
      queryClient.invalidateQueries(['event', eventId]);
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
          <Pressable
            style={styles.selector}
            onPress={openTypeSheet}
          >
            <Text style={styles.selectorText}>{EVENT_TYPES.find(t=>t.value===formData.type)?.label}</Text>
            <Ionicons name="chevron-down" size={wp(5)} color={theme.colors.textLight} />
          </Pressable>

          {/* Date Picker */}
          <DateRangePicker
            label="Date(s)"
            startDate={formData.start_date}
            endDate={formData.end_date}
            onChange={({start_date,end_date})=>setFormData(prev=>({...prev,start_date,end_date}))}
          />
        </View>

        {/* Associated Contact */}
        <View style={styles.section}>
          <Text style={styles.label}>Associated Contacts</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor={theme.colors.textLight}
            value={searchQuery}
            onChangeText={text=>{setSearchQuery(text); setShowContacts(true);}}
            onFocus={()=>setShowContacts(true)}
          />

          {(showContacts || formData.people_ids.length>0) && (
            <View style={styles.gridContainer}>
              <FlatList
                data={displayedContacts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderContactItem}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.gridRow}
                initialNumToRender={9}
                removeClippedSubviews
              />
            </View>
          )}
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
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
                  onPress={() => setFormData(prev => ({
                    ...prev,
                    tag_ids: prev.tag_ids.includes(tag.id)
                      ? prev.tag_ids.filter(id => id !== tag.id)
                      : [...prev.tag_ids, tag.id]
                  }))}
                  style={[styles.tagButton, {
                    backgroundColor: formData.tag_ids.includes(tag.id) ? tag.color : 'transparent',
                    borderColor: tag.color,
                  }]}
                >
                  <Text style={[styles.tagText, { 
                    color: formData.tag_ids.includes(tag.id) ? '#fff' : theme.colors.textLight 
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
                          setFormData(prev => ({
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

      {/* Bottom Sheet for Event Types */}
      <Modal
        visible={typeSheetVisible}
        animationType="fade"
        transparent
        onRequestClose={closeTypeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeTypeSheet} />
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }] }] }>
          <View style={styles.sheetHandle} />
          {EVENT_TYPES.map((type)=>(
            <TouchableOpacity
              key={type.value}
              style={styles.sheetOption}
              onPress={()=>{
                setFormData(prev=>({...prev,type:type.value}));
                closeTypeSheet();
              }}
            >
              <View style={styles.sheetOptionContent}>
                <Ionicons name={type.icon} size={wp(5)} color={formData.type === type.value ? theme.colors.primary : theme.colors.text} />
                <Text style={[styles.sheetOptionText, formData.type===type.value && styles.sheetOptionTextSelected]}>{type.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Modal>
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
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(2),
    backgroundColor: theme.colors.backgroundSecondary,
    marginBottom: wp(3),
  },
  selectorText: {
    fontSize: wp(4),
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
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  gridContainer:{
    width: '100%',
    marginTop: wp(3),
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: wp(3),
    marginBottom: wp(4),
  },
  gridItem:{
    width: '30%',
    alignItems:'center',
    marginBottom: wp(4),
  },
  avatarWrapper:{
    position:'relative',
  },
  checkIcon:{
    position:'absolute',
    right:-wp(1),
    bottom:-wp(1),
    backgroundColor:'#fff',
    borderRadius: wp(3),
  },
  gridAvatar:{
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
  },
  gridAvatarPlaceholder:{
    backgroundColor: theme.colors.primary,
    justifyContent:'center',
    alignItems:'center',
  },
  gridAvatarText:{
    color:'#fff',
    fontSize: wp(6),
    fontWeight:'600',
  },
  gridName:{
    marginTop: wp(1),
    fontSize: wp(3.2),
    color: theme.colors.text,
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
  notesInput: {
    height: wp(40),
    textAlignVertical: 'top',
  },
  /* Bottom sheet styles */
  sheetBackdrop: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    backgroundColor: theme.colors.background,
    paddingTop: wp(2),
    paddingBottom: wp(6),
    paddingHorizontal: wp(5),
    borderTopLeftRadius: wp(4),
    borderTopRightRadius: wp(4),
    position: 'absolute',
    bottom:0,
    width:'100%',
  },
  sheetHandle:{
    width: wp(12),
    height: wp(1),
    backgroundColor: theme.colors.border,
    borderRadius: wp(0.5),
    alignSelf:'center',
    marginBottom: wp(3),
  },
  sheetOption:{
    paddingVertical: wp(3),
  },
  sheetOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  sheetOptionText:{
    fontSize: wp(4.5),
    color: theme.colors.text,
  },
  sheetOptionTextSelected:{
    fontWeight:'600',
    color: theme.colors.primary,
  },
});

export default EditEventScreen;
