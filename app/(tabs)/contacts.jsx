import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import ContactCard from '../../components/contacts/ContactCard';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';
import useContactRequests from '../../helpers/useContactRequests';
import useContacts from '../../helpers/useContacts';

const Contacts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const { data: contacts = [], isLoading } = useContacts();
  const { pendingCount } = useContactRequests();

  const allTags = [...new Set(contacts.flatMap(contact => contact.tags || []))];

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filterContacts = useCallback((contact) => {
    const matchesSearch = searchQuery.trim() === '' || 
      `${contact.first_name} ${contact.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.some(tag => (contact.tags || []).includes(tag));

    // Only show accepted contacts
    const isAccepted = !contact.contact_user || contact.status === 'accepted';

    return matchesSearch && matchesTags && isAccepted;
  }, [searchQuery, selectedTags]);

  const handleContactPress = useCallback((contact) => {
    router.push(`/contacts/${contact.id}`);
  }, []);

  const renderTags = () => (
    <View style={styles.header}>
      <View style={styles.tagsContainer}>
        {allTags.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[
              styles.tagButton,
              selectedTags.includes(tag) && styles.tagButtonSelected
            ]}
            onPress={() => toggleTag(tag)}
          >
            <Text style={[
              styles.tagText,
              selectedTags.includes(tag) && styles.tagTextSelected
            ]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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
                size={wp(6)} 
                color={theme.colors.text}
              />
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => router.push('/contacts/new')}
            >
              <Text style={styles.actionButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textLight}
        />

        <FlatList
          data={contacts.filter(filterContacts)}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onPress={handleContactPress}
            />
          )}
          ListHeaderComponent={renderTags}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(4),
  },
  title: {
    fontSize: wp(6),
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  titleActions: {
    flexDirection: 'row',
    gap: wp(3),
  },
  actionButton: {
    paddingHorizontal: wp(4),
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
  },
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
  },
  tagButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  tagText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  tagTextSelected: {
    color: '#fff',
  },
  listContent: {
    gap: wp(3),
  },
  separator: {
    height: wp(3),
  },
});

export default Contacts; 