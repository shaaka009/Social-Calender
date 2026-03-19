import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';
import {
  buildEventsByDate,
  buildMarkedDates,
  buildMultiDayPillsByDate,
  getEventRange,
  parseIsoDateUtc,
  toIsoDate,
} from './calendarPreviewCalculations';

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

const getEventBorderColor = (event) => {
  if (event?.tags?.length > 0 && event.tags[0]?.color) {
    return String(event.tags[0].color).trim().toLowerCase();
  }
  if (event?.type === 'birthday') {
    return theme.colors.rose;
  }
  return theme.colors.primary;
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
  const eventsByDate = React.useMemo(() => buildEventsByDate(calendarEvents), [calendarEvents]);

  const multiDayPillsByDate = React.useMemo(
    () => buildMultiDayPillsByDate(calendarEvents, { getEventColor, getEventBorderColor }),
    [calendarEvents]
  );

  // Transform events into the format expected by `react-native-calendars`
  // Keep the incoming ISO date intact – this prevents off-by-one errors that
  // were happening because of timezone conversions.
  const baseMarkedDates = React.useMemo(
    () => buildMarkedDates(eventsByDate, multiDayPillsByDate, {
      primary: theme.colors.primary,
      rose: theme.colors.rose,
    }),
    [eventsByDate, multiDayPillsByDate]
  );

  const markedDates = React.useMemo(() => baseMarkedDates, [baseMarkedDates]);
  const handleCalendarDayPress = React.useCallback((day) => {
    if (eventsByDate[day.dateString]) {
      setSelectedDate(day.dateString);
      setShowEventModal(true);
    }
  }, [eventsByDate]);
  const renderCalendarDay = React.useCallback(({ date, state, marking }) => {
    if (!date) return null;

    const dateString = date.dateString;
    const hasEvents = Boolean(eventsByDate[dateString]);
    const isDisabled = state === 'disabled';
    const dayPills = multiDayPillsByDate[dateString] || [];
    const hasRange = dayPills.length > 0;
    const hasPillStartTitle = dayPills.some((pill) => pill.isStart && Boolean(pill.title));
    const weekDayIndex = new Date(`${dateString}T00:00:00`).getDay();
    const overlayZIndex = 100 - weekDayIndex;
    const utcDateForCell = parseIsoDateUtc(dateString);
    const dayOfWeekUtc = utcDateForCell ? utcDateForCell.getUTCDay() : 0;
    const daysRemainingInWeek = 7 - dayOfWeekUtc;
    const isSelected = Boolean(marking?.selected);
    const isToday = dateString === todayIsoDate;

    return (
      <View
        style={[
          styles.customDayFrame,
          hasPillStartTitle && styles.customDayFrameWithOverlayLabel,
          hasPillStartTitle && { zIndex: overlayZIndex, elevation: overlayZIndex },
        ]}
      >
        <View style={styles.customDaySlot}>
          <Pressable
            disabled={!hasEvents}
            onPress={() => handleCalendarDayPress(date)}
            style={[styles.customDayPressable]}
          >
            {dayPills.map((pill) => {
              const visibleTitleDays = Math.max(1, Math.min(pill.duration, daysRemainingInWeek));

              return (
                <View
                  key={`${pill.eventId}-${pill.tier}`}
                  style={[
                    styles.customStaticDemoBlock,
                    { backgroundColor: pill.color || RANGE_COLOR },
                    { borderColor: pill.borderColor || theme.colors.primary },
                    styles.customMultiDayPillOutlineBase,
                    pill.isStart && styles.customMultiDayPillOutlineStart,
                    pill.isEnd && styles.customMultiDayPillOutlineEnd,
                    !pill.isStart && styles.customMultiDayPillOverlapLeft,
                    !pill.isEnd && styles.customMultiDayPillOverlapRight,
                    pill.tier === 'large' && styles.customStaticDemoBlockLargeHeight,
                    pill.tier === 'middle' && styles.customStaticDemoBlockHalfBottom,
                    pill.tier === 'small' && styles.customStaticDemoBlockSmallHeight,
                    pill.isStart && styles.customStaticDemoBlockStart,
                    pill.isEnd && styles.customStaticDemoBlockEnd,
                    pill.tier === 'large' && pill.isStart && styles.customStaticDemoBlockInsetStartLarge,
                    pill.tier === 'large' && pill.isEnd && styles.customStaticDemoBlockInsetEndLarge,
                    pill.tier === 'middle' && pill.isStart && styles.customStaticDemoBlockInsetStart,
                    pill.tier === 'middle' && pill.isEnd && styles.customStaticDemoBlockInsetEnd,
                    pill.tier === 'small' && pill.isStart && styles.customStaticDemoBlockInsetStartWide,
                    pill.tier === 'small' && pill.isEnd && styles.customStaticDemoBlockInsetEndWide,
                  ]}
                >
                  {pill.isStart && Boolean(pill.title) && (
                    <View
                      style={[
                        styles.customMultiDayPillTitleWrap,
                        {
                          width: `${Math.max(
                            40,
                            (visibleTitleDays * 100)
                              - (pill.tier === 'small' ? 20 : pill.tier === 'middle' ? 24 : 18)
                          )}%`,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.customMultiDayPillTitle,
                          pill.tier === 'large' && styles.customMultiDayPillTitleLarge,
                          pill.tier === 'middle' && styles.customMultiDayPillTitleMiddle,
                          pill.tier === 'small' && styles.customMultiDayPillTitleSmall,
                        ]}
                      >
                        {pill.title}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            <View style={styles.customDayForeground}>
              <View
                style={[
                  styles.customDayNumberCircle,
                  isSelected && !hasRange && styles.customSelectedDay,
                  isSelected && !hasRange && marking?.selectedColor ? { backgroundColor: marking.selectedColor } : null,
                ]}
              >
                <Text
                  style={[
                    styles.customDayText,
                    isDisabled && styles.customDayTextDisabled,
                    hasRange && styles.customDayTextInRange,
                    isToday && styles.customDayTextToday,
                  ]}
                >
                  {date.day}
                </Text>
              </View>
              {marking?.marked && (
                <View style={[styles.customDayDot, { backgroundColor: marking?.dotColor || theme.colors.primary }]} />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    );
  }, [eventsByDate, handleCalendarDayPress, multiDayPillsByDate, todayIsoDate]);

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
            dayComponent={renderCalendarDay}
            enableSwipeMonths={true}
            onDayPress={handleCalendarDayPress}
            onMonthChange={(monthInfo) => {
              if (monthInfo?.year) {
                setActiveYear(monthInfo.year);
              }
            }}
          />
          <View style={styles.calendarBottomSpacer} />
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
  // Uniform extra room below the grid so last-row pills do not get clipped.
  calendarBottomSpacer: {
    height: wp(6.2),
  },
  customDayFrame: {
    width: '100%',
    paddingBottom: wp(2),
  },
  customDayFrameWithOverlayLabel: {
    zIndex: 20,
    elevation: 20,
  },
  customDaySlot: {
    width: '100%',
    overflow: 'visible',
  },
  customDayPressable: {
    minHeight: wp(12),
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  customDayForeground: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  customDayNumberCircle: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ---- Multi-day pill layers ----
  // Shared base for every rendered pill layer.
  customStaticDemoBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
  customMultiDayPillOutlineBase: {
    borderTopWidth: 1.2,
    borderBottomWidth: 1.2,
  },
  customMultiDayPillOutlineStart: {
    borderLeftWidth: 1.2,
  },
  customMultiDayPillOutlineEnd: {
    borderRightWidth: 1.2,
  },
  // Slight overlap hides subpixel seams between adjacent day cells.
  customMultiDayPillOverlapLeft: {
    left: -wp(0.5),
  },
  customMultiDayPillOverlapRight: {
    right: -wp(0.5),
  },
  customMultiDayPillTitleWrap: {
    position: 'absolute',
    left: wp(2),
    bottom: wp(0.5),
    overflow: 'hidden',
    zIndex: 2,
  },
  customMultiDayPillTitle: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  customMultiDayPillTitleLarge: {
    fontSize: wp(1.9),
  },
  customMultiDayPillTitleMiddle: {
    fontSize: wp(1.9),
  },
  customMultiDayPillTitleSmall: {
    fontSize: wp(1.9),
  },
  // Rounded cap styles for the first and last day in the range.
  customStaticDemoBlockStart: {
    borderTopLeftRadius: wp(3),
    borderBottomLeftRadius: wp(3),
  },
  customStaticDemoBlockEnd: {
    borderTopRightRadius: wp(3),
    borderBottomRightRadius: wp(3),
  },
  // Bottom / large pill layer (defined for future tier wiring).
  customStaticDemoBlockLargeHeight: {
    bottom: -wp(5.8),
    top: wp(1.5),
  },
  customStaticDemoBlockInsetStartLarge: {
    left: wp(0.5),
  },
  customStaticDemoBlockInsetEndLarge: {
    right: wp(0.5),
  },
  // Middle / medium pill layer.
  customStaticDemoBlockHalfBottom: {
    bottom: -wp(2.6),
    top: wp(2.5),
  },
  customStaticDemoBlockInsetStart: {
    left: wp(1.2),
  },
  customStaticDemoBlockInsetEnd: {
    right: wp(1.2),
  },
  // Top / smallest pill layer.
  customStaticDemoBlockSmallHeight: {
    top: wp(3),
    bottom: wp(0.6),
  },
  customStaticDemoBlockInsetStartWide: {
    left: wp(2),
  },
  customStaticDemoBlockInsetEndWide: {
    right: wp(2),
  },
  customSelectedDay: {
    backgroundColor: theme.colors.primary + '40',
  },
  customDayText: {
    fontSize: wp(3.5),
    color: theme.colors.text,
    fontWeight: '400',
  },
  customDayTextToday: {
    color: '#ff66ff',
    fontWeight: '600',
  },
  customDayTextDisabled: {
    color: theme.colors.textLight,
  },
  customDayTextInRange: {
    color: theme.colors.text,
  },
  customDayDot: {
    position: 'absolute',
    bottom: wp(0),
    width: 6,
    height: 6,
    borderRadius: 3,
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