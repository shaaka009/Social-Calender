import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import ContactCard from '../../components/contacts/ContactCard';
import { mockContacts } from '../../constants/mockData';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const Contacts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Get unique tags from all contacts
  const allTags = [...new Set(mockContacts.flatMap(contact => contact.tags || []))];

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filteredContacts = mockContacts.filter(contact => {
    const matchesSearch = searchQuery.trim() === '' || 
      `${contact.firstName} ${contact.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.some(tag => contact.tags?.includes(tag));

    return matchesSearch && matchesTags;
  });

  const handleContactPress = useCallback((contact) => {
    router.push(`/contacts/${contact.id}`);
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search contacts..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={theme.colors.textLight}
      />
      
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
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/contacts/new')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              onPress={handleContactPress}
            />
          )}
          ListHeaderComponent={renderHeader}
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
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    borderRadius: wp(2),
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    marginBottom: wp(4),
  },
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(3),
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