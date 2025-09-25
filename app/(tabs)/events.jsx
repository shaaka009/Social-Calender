import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';
import { useCreateTag, useTags } from '../../helpers/useTags';

const EventCard = ({ event }) => {
  const isToday = new Date(event.date).toDateString() === new Date().toDateString();
  const isPast = new Date(event.date) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.eventCard,
        isToday && styles.eventCardToday,
        isPast && styles.eventCardPast,
        pressed && styles.eventCardPressed,
      ]}
      onPress={() => router.push(`/events/${event.id}`)}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventType}>
          {event.type === 'birthday' ? '🎂' : '📅'}
        </Text>
      </View>
      <Text style={styles.eventDate}>
        {new Date(`${event.date}T00:00:00`).toLocaleDateString()}
      </Text>
      {event.person && (
        <Text style={styles.eventPerson}>
          {event.person.first_name} {event.person.last_name}
        </Text>
      )}
      {event.notes && (
        <Text style={styles.eventNotes} numberOfLines={2}>
          {event.notes}
        </Text>
      )}
    </Pressable>
  );
};

const Events = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch(ENDPOINTS.EVENTS),
  });

  /* --------------------------------------------------
   * Tag filtering (event types)
   * -------------------------------------------------- */
  const [selectedTags, setSelectedTags] = useState([]);

  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();

  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

  const toggleTag = useCallback((tag) => {
    setSelectedTags(prev => (
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    ));
  }, []);

  /* --------------------------------------------------
   * Derived list
   * -------------------------------------------------- */
  const visibleEvents = useMemo(() => {
    if (selectedTags.length === 0) return events;
    // We need event.person.tags or similar; backend may not supply. Fallback: filter none.
    return events.filter(e => false);
  }, [events, selectedTags]);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <CustomButton
          title="Add Event"
          onPress={() => router.push('/events/new')}
        />
      </View>

      {/* Tags row */}
      <View style={styles.tagsRow}>
        <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={wp(6)} color="#fff" />
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
      </View>

      <LoadingState isLoading={isLoading}>
        <FlatList
          data={visibleEvents}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.listContent}
        />

        {events.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySubtext}>
              Add your first event to start tracking important dates
            </Text>
            <CustomButton
              title="Add Event"
              onPress={() => router.push('/events/new')}
              style={styles.emptyButton}
            />
          </View>
        )}
      </LoadingState>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: wp(10),
  },
  monthSection: {
    marginBottom: wp(6),
  },
  monthTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  eventList: {
    gap: wp(3),
  },
  /* Tags */
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
  eventCard: {
    paddingVertical: wp(3),
    paddingHorizontal: wp(5),
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventCardToday: {
    backgroundColor: theme.colors.primary + '15',
  },
  eventCardPast: {
    opacity: 0.7,
  },
  eventCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(1),
  },
  eventTitle: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  eventType: {
    fontSize: wp(5),
    marginLeft: wp(2),
  },
  eventDate: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginBottom: wp(1),
  },
  eventPerson: {
    fontSize: wp(3.8),
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  eventNotes: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp(10),
  },
  emptyText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  emptySubtext: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: wp(4),
  },
  emptyButton: {
    minWidth: wp(40),
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
});

export default Events;