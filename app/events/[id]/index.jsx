import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { EVENT_TYPES } from '../../../constants/eventTypes';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { parseDateLocal, wp } from '../../../helpers/common';
import useContacts from '../../../helpers/useContacts';

const EventDetailsScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch(`${ENDPOINTS.EVENTS}${id}/`),
  });

  // Fetch user's contacts to resolve connection IDs for associated people
  const { data: contacts = [] } = useContacts();

  // Helper: map of personId -> connectionId
  const connectionByPersonId = React.useMemo(() => {
    const map = {};
    contacts.forEach((conn) => {
      map[conn.target.id] = conn.id;
    });
    return map;
  }, [contacts]);

  if (isLoading || !event) {
    return <LoadingState />;
  }

  // Format start/end dates into a nice string respecting birthday (no year) logic
  const formatDate = (ev) => {
    if (!ev.start_date) return '—';
    const start = parseDateLocal(ev.start_date);
    const end = ev.end_date ? parseDateLocal(ev.end_date) : null;

    const optsFull = { year: 'numeric', month: 'short', day: 'numeric' };
    const optsNoYear = { month: 'short', day: 'numeric' };

    // Birthday with no year (encoded as 0000-…)
    const isNoYear = start.getFullYear() === 0;

    const format = (d) => d.toLocaleDateString(undefined, isNoYear ? optsNoYear : optsFull);

    if (end && end.getTime() !== start.getTime()) {
      return `${format(start)} – ${format(end)}`;
    }
    return format(start);
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Event Details</Text>
        <CustomButton
          title="Edit"
          variant="text"
          onPress={() => router.push(`/events/${id}/edit`)}
          style={styles.backBtn}
        />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Event Title */}
        <Text style={styles.eventTitle}>{event.title}</Text>
        {/* Event Type Badge */}
        <View style={[
          styles.badge,
          { backgroundColor: theme.colors.primary + '20' }
        ]}>
          <View style={styles.badgeContent}>
            <Ionicons 
              name={EVENT_TYPES.find(t=>t.value===event.type)?.icon || 'calendar-outline'} 
              size={wp(4.5)} 
              color={theme.colors.primary}
            />
            <Text style={[
              styles.badgeText,
              { color: theme.colors.primary }
            ]}>
              {EVENT_TYPES.find(t=>t.value===event.type)?.label || 'Event'}
            </Text>
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Information</Text>
          <InfoRow label="Title" value={event.title} />
          <InfoRow label="Date(s)" value={formatDate(event)} />
          {event.person && (
            <InfoRow 
              label="Associated Contact" 
              value={`${event.person.first_name} ${event.person.last_name}`} 
            />
          )}
        </View>

        {/* Notes */}
        {event.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{event.notes}</Text>
          </View>
        )}

        {/* People */}
        {event.people?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            <View style={styles.peopleContainer}>
              {event.people.map((p) => {
                const connId = connectionByPersonId[p.id];
                const ChipComponent = connId ? TouchableOpacity : View;
                return (
                  <ChipComponent
                    key={p.id}
                    style={styles.personChip}
                    onPress={connId ? () => router.push(`/contacts/${connId}`) : undefined}
                  >
                    <Text style={styles.personChipText}>{`${p.first_name} ${p.last_name}`.trim()}</Text>
                  </ChipComponent>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Tags */}
        {event.tags?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagContainer}>
              {event.tags.map((tag) => (
                <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color || theme.colors.primary }] }>
                  <Text style={styles.tagTextWhite}>{tag.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Delete Button */}
        <CustomButton
          title="Delete Event"
          variant="text"
          onPress={() => router.push(`/events/${id}/delete`)}
          style={styles.deleteButton}
          textStyle={{ color: theme.colors.danger }}
        />
      </ScrollView>
    </ScreenWrapper>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

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
  backBtn: {
    width: wp(20),
  },
  backText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: wp(5),
    gap: wp(6),
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    borderRadius: wp(4),
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  badgeText: {
    fontSize: wp(4),
    fontWeight: '500',
  },
  section: {
    gap: wp(3),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: wp(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    fontSize: wp(4),
    color: theme.colors.textLight,
  },
  value: {
    fontSize: wp(4),
    color: theme.colors.text,
    fontWeight: '500',
  },
  notes: {
    fontSize: wp(4),
    color: theme.colors.text,
    lineHeight: wp(6),
  },
  actions: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: wp(4),
  },
  button: {
    flex: 1,
  },
  deleteButton: {
    alignSelf: 'center',
    marginTop: wp(6),
    minWidth: wp(50),
  },
  eventTitle: {
    fontSize: wp(6),
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: wp(3),
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
  },
  tagTextWhite: {
    color: '#fff',
    fontSize: wp(3.5),
  },
  peopleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  personChip: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
  },
  personChipText: {
    fontSize: wp(3.5),
    color: theme.colors.text,
  },
});

export default EventDetailsScreen;
