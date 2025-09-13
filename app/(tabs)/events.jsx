import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';

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

  // Group events by month
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.date);
    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(event);
    return acc;
  }, {});

  // Sort events within each month
  Object.values(groupedEvents).forEach(monthEvents => {
    monthEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

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

      <LoadingState isLoading={isLoading}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
            <View key={monthYear} style={styles.monthSection}>
              <Text style={styles.monthTitle}>{monthYear}</Text>
              <View style={styles.eventList}>
                {monthEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </View>
            </View>
          ))}

          {events.length === 0 && (
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
        </ScrollView>
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
  contentContainer: {
    padding: wp(5),
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
  eventCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    ...theme.shadows.small,
  },
  eventCardToday: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary,
    borderWidth: 1,
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
});

export default Events;