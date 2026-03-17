import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const parseLocalDate = (isoStr) => {
  if (!isoStr) return new Date();
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getStart = (event) => parseLocalDate(event.start_date || event.date);

const getEnd = (event) => (
  event.end_date ? parseLocalDate(event.end_date) : getStart(event)
);

const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

const formatRange = (event) => {
  const start = getStart(event);
  const end = getEnd(event);
  return isSameDay(start, end)
    ? start.toLocaleDateString()
    : `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
};

const EVENT_ICON_BY_TYPE = EVENT_TYPES.reduce((acc, eventType) => {
  acc[eventType.value] = eventType.icon;
  return acc;
}, {});

const EventCard = React.memo(({ event }) => {
  const { isToday, formattedRange, iconName } = React.useMemo(() => {
    const start = getStart(event);
    return {
      isToday: start.toDateString() === new Date().toDateString(),
      formattedRange: formatRange(event),
      iconName: EVENT_ICON_BY_TYPE[event.type] || 'calendar-outline',
    };
  }, [event]);

  const handlePress = React.useCallback(() => {
    router.push(`/events/${event.id}`);
  }, [event.id]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventCard,
        isToday && styles.eventCardToday,
        pressed && styles.eventCardPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.content}>
        <Text style={styles.eventTitle}>{event.display_title || event.title}</Text>
        <Text style={styles.eventDate}>{formattedRange}</Text>
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
      </View>
      <View style={styles.iconContainer}>
        <Ionicons
          name={iconName}
          size={wp(7.5)}
          color={theme.colors.primary}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: wp(3),
    paddingHorizontal: wp(5),
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventCardToday: {
    backgroundColor: `${theme.colors.primary}15`,
  },
  eventCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flex: 1,
  },
  eventTitle: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  iconContainer: {
    marginLeft: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default EventCard;
