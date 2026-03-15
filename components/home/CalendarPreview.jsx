import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const EventPreview = ({ event, onPress }) => (
  <Pressable style={styles.eventPreview} onPress={onPress}>
    <View style={styles.eventIcon}>
      <Ionicons 
        name={EVENT_TYPES.find(t => t.value === event.type)?.icon || 'calendar-outline'}
        size={wp(7)} 
        color={theme.colors.primary}
      />
      {event.person && (
        <View style={[
          styles.eventBadge,
          { backgroundColor: event.type === 'birthday' ? theme.colors.rose : theme.colors.primary }
        ]}>
          <Ionicons name="person" size={wp(2.5)} color="#fff" />
        </View>
      )}
    </View>
    <View style={styles.eventInfo}>
      <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
      <View style={styles.eventDetails}>
        {event.person && (
          <Text style={styles.eventPerson} numberOfLines={1}>
            {event.person.first_name} {event.person.last_name}
          </Text>
        )}
        {event.tags && event.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {event.tags.map(tag => (
              <View 
                key={tag.id} 
                style={[styles.tag, { backgroundColor: tag.color + '40' }]}
              >
                <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  </Pressable>
);

const CalendarPreview = ({ events = [], isLoading = false, error = null }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const closeEventModal = React.useCallback(() => {
    setShowEventModal(false);
  }, []);

  // Group events by date for quick lookup when a day is pressed
  // NOTE: `event.date` is already a server-provided ISO string (YYYY-MM-DD) so
  // we can rely on it directly instead of converting it to a Date object first.
  const eventsByDate = events.reduce((acc, event) => {
    const dateStr = event.start_date || event.date;
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(event);
    return acc;
  }, {});

  // Transform events into the format expected by `react-native-calendars`
  // Keep the incoming ISO date intact – this prevents off-by-one errors that
  // were happening because of timezone conversions.
  const markedDates = events.reduce((acc, event) => {
    const dateStr = event.start_date || event.date;
    if (!acc[dateStr]) {
      const eventsOnThisDate = events.filter(e => (e.start_date || e.date) === dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;

      acc[dateStr] = {
        dots: eventsOnThisDate.flatMap(e => {
          // If event has tags, create a dot for each tag
          if (e.tags && e.tags.length > 0) {
            return e.tags.map(tag => ({
              color: tag.color,
              key: `${e.id}-${tag.id}`,
            }));
          }
          // If no tags, fall back to default color scheme
          return [{
            color: e.type === 'birthday' ? theme.colors.rose : theme.colors.primary,
            key: e.id.toString(),
          }];
        }),
        marked: true,
        selected: isSelected || isToday,
        selectedColor: isSelected ? theme.colors.primary : theme.colors.primary + '40',
      };
    }
    return acc;
  }, {});

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load events. Please try again later.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendar</Text>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.calendarWrapper}>
          <Calendar
            style={styles.calendar}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              textSectionTitleColor: theme.colors.text,
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: theme.colors.primary,
              dayTextColor: theme.colors.text,
              textDisabledColor: theme.colors.textLight,
              dotColor: theme.colors.primary,
              selectedDotColor: '#ffffff',
              monthTextColor: theme.colors.text,
              indicatorColor: theme.colors.primary,
              // Make dots more prominent
              dotStyle: {
                width: 6,
                height: 6,
                borderRadius: 3,
                marginTop: 2,
              },
              // Improve day text styling
              textDayFontSize: wp(3.5),
              textMonthFontSize: wp(4),
              textDayHeaderFontSize: wp(3.5),
              // Add font weights
              textDayFontWeight: '400',
              textMonthFontWeight: '600',
              textDayHeaderFontWeight: '600',
            }}
            markingType={'multi-dot'}
            markedDates={markedDates}
            enableSwipeMonths={true}
            onDayPress={(day) => {
              if (eventsByDate[day.dateString]) {
                setSelectedDate(day.dateString);
                setShowEventModal(true);
              }
            }}
          />
        </View>
      )}
      {events.length === 0 && !isLoading && (
        <Text style={styles.emptyText}>No upcoming events</Text>
      )}

      {/* Event Modal */}
      <Modal
        visible={showEventModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeEventModal}
        onDismiss={() => setSelectedDate(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={closeEventModal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Events on {selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString() : ''}
              </Text>
              <Pressable 
                onPress={closeEventModal}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={wp(6)} color={theme.colors.textLight} />
              </Pressable>
            </View>
            <ScrollView style={styles.eventList}>
              {selectedDate && eventsByDate[selectedDate]?.map(event => (
                <EventPreview
                  key={event.id}
                  event={event}
                  onPress={() => {
                    closeEventModal();
                    router.push(`/events/${event.id}`);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: wp(5),
    ...theme.shadows.small,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  calendarWrapper: {
    borderRadius: wp(4),
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  calendar: {
    borderRadius: wp(4),
  },
  loadingContainer: {
    height: wp(80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: wp(40),
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    fontSize: wp(4),
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textLight,
    fontSize: wp(4),
    fontStyle: 'italic',
    marginTop: wp(3),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: wp(4),
    width: '100%',
    maxHeight: '80%',
    ...theme.shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalCloseButton: {
    padding: wp(2),
  },
  eventList: {
    padding: wp(4),
  },
  // Event preview styles
  eventPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(3),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    marginBottom: wp(2),
    ...theme.shadows.small,
  },
  eventIcon: {
    width: wp(12),
    height: wp(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
    position: 'relative',
  },
  eventBadge: {
    position: 'absolute',
    bottom: -wp(1),
    right: -wp(1),
    width: wp(5),
    height: wp(5),
    borderRadius: wp(2.5),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: wp(4),
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  eventPerson: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  eventDetails: {
    flexDirection: 'column',
    gap: wp(1),
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(1),
  },
  tag: {
    paddingHorizontal: wp(2),
    paddingVertical: wp(0.5),
    borderRadius: wp(2),
  },
  tagText: {
    fontSize: wp(3),
    fontWeight: '500',
  },
});

export default CalendarPreview;