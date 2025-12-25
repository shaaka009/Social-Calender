import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomInput from '../../components/CustomInput';
import DateRangePicker from '../../components/DateRangePicker';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';
import { useCreateTag, useTags } from '../../helpers/useTags';

const AddEventScreen = () => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showContacts, setShowContacts] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    start_date: new Date(),
    end_date: null,
    type: 'general',
    people_ids: [],
    tag_ids: [],
    notes: '',
  });

  // Bottom sheet visibility
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current; // Y offset ensures sheet starts off-screen

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
      const format = (d)=>{
        if (!d) return null;
        if (form.type==='birthday' && d.noYear){
          return `0000-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      await apiFetch(ENDPOINTS.EVENTS, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          start_date: format(form.start_date),
          end_date: form.end_date ? format(form.end_date) : null,
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
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Add Event</Text>

        <Pressable 
          onPress={handleSave}
          disabled={isLoading}
          style={styles.saveButtonHeader}
        >
          <Text style={styles.saveButtonHeaderText}>{isLoading ? 'Saving...' : 'Save'}</Text>
        </Pressable>
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

          {/* Event Type Selector */}
          <Text style={styles.label}>Event Type</Text>
          <Pressable
            style={styles.selector}
            onPress={openTypeSheet}
          >
            <Text style={styles.selectorText}>{EVENT_TYPES.find(t=>t.value===form.type)?.label}</Text>
            <Ionicons name="chevron-down" size={wp(5)} color={theme.colors.textLight} />
          </Pressable>

          {/* Date Picker */}
          <DateRangePicker
            label="Date(s)"
            startDate={form.start_date}
            endDate={form.end_date}
            onChange={({start_date,end_date})=>setForm(prev=>({...prev,start_date,end_date}))}
          />
        </View>

        {/* Associated Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Associated Contacts (Optional)</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor={theme.colors.textLight}
            value={searchQuery}
            onChangeText={text=>{setSearchQuery(text); setShowContacts(true);}}
            onFocus={()=>setShowContacts(true)}
          />

          {showContacts && (
            <View style={styles.gridContainer}>
              {filteredContacts.map(conn=>{
                const selected = form.people_ids.includes(conn.target.id);
                const person = conn.target;
                return (
                  <TouchableOpacity
                    key={conn.id}
                    style={styles.gridItem}
                    onPress={()=>setForm(prev=>({
                      ...prev,
                      people_ids: selected ? prev.people_ids.filter(id=>id!==conn.target.id) : [...prev.people_ids, conn.target.id]
                    }))}
                  >
                    <View style={styles.avatarWrapper}>
                      {person.profile_picture_url ? (
                        <Image source={{uri: person.profile_picture_url}} style={styles.gridAvatar} />
                      ) : (
                        <View style={[styles.gridAvatar, styles.gridAvatarPlaceholder]}>
                          <Text style={styles.gridAvatarText}>{person.first_name?.[0]}{person.last_name?.[0]}</Text>
                        </View>
                      )}
                      {selected && (
                        <Ionicons name="checkmark-circle" size={wp(6)} color={theme.colors.primary} style={styles.checkIcon}/>
                      )}
                    </View>
                    <Text style={styles.gridName} numberOfLines={1}>{person.first_name}</Text>
                  </TouchableOpacity>
                );
              })}
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

        {/* Spacer to avoid bottom overlap */}
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
                setForm(prev=>({...prev,type:type.value}));
                closeTypeSheet();
              }}
            >
              <Text style={[styles.sheetOptionText, form.type===type.value && styles.sheetOptionTextSelected]}>{`${type.emoji}  ${type.label}`}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: wp(4),
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  contactSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
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
  /* Bottom sheet */
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
  sheetOptionText:{
    fontSize: wp(4.5),
    color: theme.colors.text,
  },
  sheetOptionTextSelected:{
    fontWeight:'600',
    color: theme.colors.primary,
  },
  gridContainer:{
    flexDirection:'row',
    flexWrap:'wrap',
    gap: wp(4),
    marginTop: wp(3),
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
});

export default AddEventScreen;
