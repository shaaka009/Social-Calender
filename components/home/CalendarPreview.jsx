import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const daysInMonth = (year, monthOneBased) => new Date(year, monthOneBased, 0).getDate();
const toIsoDate = (year, monthOneBased, day) => {
  const safeDay = Math.min(day, daysInMonth(year, monthOneBased));
  return `${year}-${String(monthOneBased).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVENT_SPAN_DAYS = 366;
const RANGE_COLOR = '#E7DDFF';
const SUBDUED_TAG_COLOR_MAP = {
  '#ff8c00': '#ffe8cc', // orange
  '#ff4d4f': '#ffd8d9', // red
  '#40a9ff': '#d9efff', // blue
  '#52c41a': '#dcf3d0', // green
  '#faad14': '#ffefcc', // yellow
  '#722ed1': '#e6d8f8', // purple
  '#13c2c2': '#d2f3f3', // teal
};

const isIsoDate = (value) => typeof value === 'string' && ISO_DATE_REGEX.test(value);

const parseIsoDateUtc = (isoDate) => {
  if (!isIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const formatIsoDateUtc = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getEventColor = (event) => {
  if (event?.tags?.length > 0 && event.tags[0]?.color) {
    const normalizedTagColor = String(event.tags[0].color).trim().toLowerCase();
    return SUBDUED_TAG_COLOR_MAP[normalizedTagColor] || RANGE_COLOR;
  }
  if (event?.type === 'birthday') {
    return '#ffd7d7';
  }
  return RANGE_COLOR;
};

const getEventRange = (event) => {
  const startDate = event?.start_date || event?.date || null;
  if (!isIsoDate(startDate)) return null;

  const candidateEndDate = event?.end_date || startDate;
  const endDate = isIsoDate(candidateEndDate) ? candidateEndDate : startDate;

  if (endDate < startDate) {
    return { startDate, endDate: startDate };
  }

  return { startDate, endDate };
};

const expandEventDates = (startDate, endDate) => {
  const startUtc = parseIsoDateUtc(startDate);
  const endUtc = parseIsoDateUtc(endDate);
  if (!startUtc || !endUtc || endUtc < startUtc) return [];

  const dates = [];
  const cursor = new Date(startUtc);

  while (cursor <= endUtc && dates.length < MAX_EVENT_SPAN_DAYS) {
    dates.push(formatIsoDateUtc(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

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
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const closeEventModal = React.useCallback(() => {
    setShowEventModal(false);
  }, []);

  const getDateStr = (event) => event?.start_date || event?.date || null;
  const todayIsoDate = React.useMemo(() => new Date().toISOString().split('T')[0], []);

  const validEvents = React.useMemo(
    () => events.filter((event) => getEventRange(event)),
    [events]
  );

  const recurringBirthdaySources = React.useMemo(
    () => validEvents.filter(
      (event) => event?.type === 'birthday' && event?.is_virtual && event?.source === 'person_birthday'
    ),
    [validEvents]
  );

  // Expand virtual birthdays around the currently viewed year so the home calendar
  // shows birthday dots across years without changing events-tab behavior.
  const recurringBirthdayEvents = React.useMemo(() => {
    const expandedEvents = [];
    const seenRecurringKeys = new Set();

    recurringBirthdaySources.forEach((event) => {
      const dateStr = getDateStr(event);
      const [_, rawMonth, rawDay] = dateStr.split('-').map(Number);
      if (!rawMonth || !rawDay) return;

      const personKey = event.person_id || event.person?.id || event.id;
      const dedupeKey = `${personKey}-${rawMonth}-${rawDay}`;
      if (seenRecurringKeys.has(dedupeKey)) return;
      seenRecurringKeys.add(dedupeKey);

      for (let year = activeYear - 8; year <= activeYear + 8; year += 1) {
        const birthdayDate = toIsoDate(year, rawMonth, rawDay);
        expandedEvents.push({
          ...event,
          // Keep the original ID so details routing keeps working with existing screens.
          start_date: birthdayDate,
          end_date: birthdayDate,
        });
      }
    });

    return expandedEvents;
  }, [activeYear, recurringBirthdaySources]);

  const nonRecurringEvents = React.useMemo(
    () => validEvents.filter(
      (event) => !(event?.type === 'birthday' && event?.is_virtual && event?.source === 'person_birthday')
    ),
    [validEvents]
  );

  const calendarEvents = React.useMemo(
    () => [...nonRecurringEvents, ...recurringBirthdayEvents],
    [nonRecurringEvents, recurringBirthdayEvents]
  );

  // Group events by date for quick lookup when a day is pressed.
  const eventsByDate = React.useMemo(() => {
    const groupedEvents = {};
    const seenEventIdsByDate = {};

    calendarEvents.forEach((event) => {
      const dateRange = getEventRange(event);
      if (!dateRange) return;

      const eventDates = expandEventDates(dateRange.startDate, dateRange.endDate);
      const fallbackEventId = `${event.title || 'event'}-${dateRange.startDate}-${dateRange.endDate}`;
      const eventId = event?.id != null ? String(event.id) : fallbackEventId;

      eventDates.forEach((dateStr) => {
        if (!groupedEvents[dateStr]) {
          groupedEvents[dateStr] = [];
          seenEventIdsByDate[dateStr] = new Set();
        }

        if (seenEventIdsByDate[dateStr].has(eventId)) return;

        seenEventIdsByDate[dateStr].add(eventId);
        groupedEvents[dateStr].push(event);
      });
    });
    return groupedEvents;
  }, [calendarEvents]);

  const rangeVisualByDate = React.useMemo(() => {
    const visualMap = {};

    calendarEvents.forEach((event) => {
      const dateRange = getEventRange(event);
      if (!dateRange || dateRange.startDate === dateRange.endDate) return;

      const eventDates = expandEventDates(dateRange.startDate, dateRange.endDate);
      const eventColor = getEventColor(event);
      eventDates.forEach((dateStr, index) => {
        if (!visualMap[dateStr]) {
          visualMap[dateStr] = { isStart: false, isEnd: false, isMiddle: false, color: eventColor };
        }

        if (index === 0) {
          visualMap[dateStr].isStart = true;
        } else if (index === eventDates.length - 1) {
          visualMap[dateStr].isEnd = true;
        } else {
          visualMap[dateStr].isMiddle = true;
        }
      });
    });

    return visualMap;
  }, [calendarEvents]);

  // Transform events into the format expected by `react-native-calendars`
  // Keep the incoming ISO date intact – this prevents off-by-one errors that
  // were happening because of timezone conversions.
  const baseMarkedDates = React.useMemo(() => {
    return Object.entries(eventsByDate).reduce((acc, [dateStr, eventsOnThisDate]) => {
      const seenDotKeys = new Set();
      const dots = eventsOnThisDate.flatMap((event) => {
        if (event.tags && event.tags.length > 0) {
          return event.tags
            .map((tag) => ({
              color: tag.color,
              key: `${event.id}-${tag.id}`,
            }))
            .filter((dot) => {
              if (seenDotKeys.has(dot.key)) return false;
              seenDotKeys.add(dot.key);
              return true;
            });
        }

        const defaultDot = {
          color: event.type === 'birthday' ? theme.colors.rose : theme.colors.primary,
          key: event.id?.toString() || `${event.title}-${dateStr}`,
        };

        if (seenDotKeys.has(defaultDot.key)) {
          return [];
        }
        seenDotKeys.add(defaultDot.key);
        return [defaultDot];
      });

      const dayRangeVisual = rangeVisualByDate[dateStr];
      const hasRange = Boolean(dayRangeVisual);
      const primaryDotColor = dots[0]?.color || theme.colors.primary;

      acc[dateStr] = hasRange ? {
        startingDay: dayRangeVisual.isStart,
        endingDay: dayRangeVisual.isEnd,
        color: dayRangeVisual.color || RANGE_COLOR,
        textColor: theme.colors.text,
        marked: true,
        dotColor: primaryDotColor,
      } : {
        marked: true,
        dotColor: primaryDotColor,
      };

      if (dateStr === todayIsoDate && !hasRange) {
        acc[dateStr].selected = true;
        acc[dateStr].selectedColor = theme.colors.primary + '40';
      }

      return acc;
    }, {});
  }, [eventsByDate, rangeVisualByDate, todayIsoDate]);

  const markedDates = React.useMemo(() => baseMarkedDates, [baseMarkedDates]);

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
            markingType={'period'}
            markedDates={markedDates}
            enableSwipeMonths={true}
            onDayPress={(day) => {
              if (eventsByDate[day.dateString]) {
                setSelectedDate(day.dateString);
                setShowEventModal(true);
              }
            }}
            onMonthChange={(monthInfo) => {
              if (monthInfo?.year) {
                setActiveYear(monthInfo.year);
              }
            }}
          />
        </View>
      )}
      {calendarEvents.length === 0 && !isLoading && (
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
    paddingVertical: wp(3),
    paddingHorizontal: wp(2),
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