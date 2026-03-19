import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import ContactCard from '../../components/contacts/ContactCard';
import { TAG_COLOR_OPTIONS } from '../../constants/tagColors';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';
import useContactRequests from '../../helpers/useContactRequests';
import useContacts from '../../helpers/useContacts';
import { useCreateTag, useTags } from '../../helpers/useTags';

const Contacts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const COLOR_OPTIONS = TAG_COLOR_OPTIONS;
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

  const { data: contacts = [] } = useContacts();
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const { pendingCount } = useContactRequests();

  const allTags = tags;

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filterContacts = useCallback((contact) => {
    const firstName = contact.target?.first_name || '';
    const lastName = contact.target?.last_name || '';
    const matchesSearch = searchQuery.trim() === '' || 
      `${firstName} ${lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const contactTagList = (contact.tags || contact.target?.tags || []);
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => contactTagList.includes(tag));

    // Only show accepted connections
    const isAccepted = contact.status === 'accepted';

    return matchesSearch && matchesTags && isAccepted;
  }, [searchQuery, selectedTags]);
  const filteredContacts = useMemo(
    () => contacts.filter(filterContacts),
    [contacts, filterContacts]
  );

  const handleContactPress = useCallback((contact) => {
    router.push(`/contacts/${contact.id}`);
  }, []);

  const handleSaveTag = useCallback(() => {
    if (!newTag.name.trim()) return;
    createTagMutation.mutate(newTag, {
      onSuccess: () => {
        setModalVisible(false);
        setNewTag({ name: '', color: COLOR_OPTIONS[0] });
      },
    });
  }, [COLOR_OPTIONS, createTagMutation, newTag]);

  const renderTags = useCallback(() => (
    <View style={styles.tagsRow}>
      <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={wp(6)} color="#fff" />
      </Pressable>

      {/* Wrap FlatList to allow fade overlay */}
      <View style={styles.tagsList}>
        {allTags.length === 0 ? (
          <View style={styles.tagsContainer}>
            <View style={styles.ghostTag} pointerEvents="none">
              <Text style={styles.ghostTagText}>Create tags to organize contacts</Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={allTags}
            horizontal
            keyExtractor={(item) => item.name}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsContainer}
            renderItem={({ item: tag }) => {
              const isSelected = selectedTags.includes(tag.name);
              return (
                <Pressable
                  onPress={() => toggleTag(tag.name)}
                  style={[styles.tagButton, {
                    backgroundColor: isSelected ? tag.color || theme.colors.primary : 'transparent',
                    borderColor: tag.color || theme.colors.primary,
                  }]}
                >
                  <Text style={[styles.tagText, { color: isSelected ? '#fff' : theme.colors.textLight }]}> {tag.name} </Text>
                </Pressable>
              );
            }}
          />
        )}
        {/* right-edge fade */}
        {allTags.length > 0 && (
          <LinearGradient
            colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tagsFade}
            pointerEvents="none"
          />
        )}
      </View>

      {/* spacing between tags and filter */}
      <View style={{ width: wp(2) }} />
      <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
        <Ionicons name="filter" size={wp(6)} color={theme.colors.text} />
      </TouchableOpacity>

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
                onPress={handleSaveTag}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Contacts</Text>
            <Text style={{ color: theme.colors.text, marginBottom: wp(3) }}>Filter options coming soon...</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  ), [COLOR_OPTIONS, allTags, filterModalVisible, handleSaveTag, modalVisible, newTag.color, newTag.name, selectedTags]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Contacts</Text>
          <View style={styles.titleActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/contacts/requests')}
            >
              <Ionicons 
                name="notifications-outline" 
                size={wp(7)} 
                color={theme.colors.text}
              />
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/contacts/new')}
            >
              <Ionicons 
              name="add" 
              size={wp(8)} 
              color={theme.colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search your contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textLight}
        />

        {renderTags()}

        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onPress={handleContactPress}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: wp(5),
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(4),
    paddingHorizontal: wp(5),
  },
  title: {
    fontSize: wp(9),
    fontWeight: '600',
    color: theme.colors.text,
  },
  titleActions: {
    flexDirection: 'row',
    gap: wp(0),
  },
  actionButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    borderRadius: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: theme.colors.error,
    borderRadius: wp(4),
    minWidth: wp(4),
    height: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -wp(1),
    right: -wp(1),
    paddingHorizontal: wp(1),
  },
  badgeText: {
    color: '#fff',
    fontSize: wp(3),
    fontWeight: '600',
  },
  header: {
    marginBottom: wp(4),
    paddingHorizontal: wp(5),
  },
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(4),
    marginHorizontal: wp(5),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  tagsContainer: {
    paddingHorizontal: wp(5),
    flexDirection: 'row',
    gap: wp(2),
    marginTop: wp(2),
    marginBottom: wp(2),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: wp(2),
    marginBottom: wp(2),
    paddingRight: wp(3.5),
  },
  tagsList: {
    flexShrink: 1,
    flexGrow: 1,
    overflow: 'hidden',
    marginLeft: wp(0),
    paddingLeft: wp(0),
  },
  tagsFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: wp(12), // wider fade for smoother look
  },
  plusButton: {
    backgroundColor: theme.colors.primary,
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(5),
  }, 
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: wp(8),
    justifyContent: 'center',
  },
  tagButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tagText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  tagTextSelected: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: wp(3),
  },

  /* Modal styles */
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
  // EDIT: new styles for divider and filter button
  filterButton: {
    paddingHorizontal: wp(2),
    paddingVertical: wp(2),
  },
  ghostTag: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    minHeight: wp(8),
    justifyContent: 'center',
    opacity: 0.5,
  },
  ghostTagText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
    fontStyle: 'italic',
  },
});

export default Contacts; 