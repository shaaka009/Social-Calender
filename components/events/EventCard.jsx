import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { EVENT_TYPES } from '../../constants/eventTypes';
import { theme } from '../../constants/theme';
import { getPersonAvatarColors, getPersonInitials } from '../../helpers/avatar';
import { parseDateLocal, wp } from '../../helpers/common';

const getStart = (event) => (
  parseDateLocal(event?.start_date || event?.date) || new Date(0)
);

const getEnd = (event) => (
  (event?.end_date ? parseDateLocal(event.end_date) : null) || getStart(event)
);

const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

const formatRange = (event) => {
  const start = getStart(event);
  const end = getEnd(event);
  return isSameDay(start, end)
    ? start.toLocaleDateString()
    : `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
};

const getPrimaryPerson = (event) => {
  if (Array.isArray(event?.people) && event.people.length > 0) {
    return event.people[0];
  }
  return event?.person || null;
};

const getBirthdayAge = (event, person) => {
  const turningMatch = String(event?.display_title || '').match(/turning\s+(\d+)/i);
  if (turningMatch?.[1]) {
    const parsedAge = Number(turningMatch[1]);
    if (Number.isFinite(parsedAge) && parsedAge > 0) return parsedAge;
  }

  if (!person?.birthday || !event?.start_date) return null;
  const occurrence = parseDateLocal(event.start_date);
  const birthDate = parseDateLocal(person.birthday);
  if (!occurrence || !birthDate) return null;
  const age = occurrence.getFullYear() - birthDate.getFullYear();
  return Number.isFinite(age) && age > 0 ? age : null;
};

const getOrdinalSuffix = (value) => {
  const abs = Math.abs(Number(value));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  const last = abs % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
};

const getEventCardTitle = (event) => {
  if (event?.type !== 'birthday') {
    return event?.display_title || event?.title;
  }

  const person = getPrimaryPerson(event);
  const preferredName = person?.nickname || person?.first_name || event?.title || 'Birthday';
  const turningAge = getBirthdayAge(event, person);

  if (turningAge) {
    return `${preferredName}'s ${turningAge}${getOrdinalSuffix(turningAge)} birthday!`;
  }
  return `${preferredName}'s Birthday`;
};

const EVENT_ICON_BY_TYPE = EVENT_TYPES.reduce((acc, eventType) => {
  acc[eventType.value] = eventType.icon;
  return acc;
}, {});

const EventCard = React.memo(({
  event,
  isSelectionMode = false,
  isSelected = false,
  isSelectionDisabled = false,
  onToggleSelect = null,
  onSelectionDisabledPress = null,
}) => {
  const {
    isToday,
    formattedRange,
    iconName,
    displayTitle,
    birthdayName,
    birthdayAgeLabel,
    isBirthdayEvent,
    visiblePeople,
    remainingPeopleCount,
    isPersonGeneratedEvent,
  } = React.useMemo(() => {
    const start = getStart(event);
    const people = [];

    if (Array.isArray(event.people) && event.people.length > 0) {
      event.people.forEach((person) => {
        if (!person?.id) return;
        people.push(person);
      });
    } else if (event.person?.id) {
      people.push(event.person);
    }

    const primaryPerson = getPrimaryPerson(event);
    const turningAge = getBirthdayAge(event, primaryPerson);
    const preferredBirthdayName = primaryPerson?.nickname
      || primaryPerson?.first_name
      || event?.title
      || 'Birthday';

    return {
      isToday: start.toDateString() === new Date().toDateString(),
      formattedRange: formatRange(event),
      iconName: EVENT_ICON_BY_TYPE[event.type] || 'calendar-outline',
      displayTitle: getEventCardTitle(event),
      birthdayName: preferredBirthdayName,
      birthdayAgeLabel: turningAge ? `${turningAge}${getOrdinalSuffix(turningAge)}` : null,
      isBirthdayEvent: event?.type === 'birthday',
      visiblePeople: people.slice(0, 3),
      remainingPeopleCount: Math.max(0, people.length - 3),
      isPersonGeneratedEvent: Boolean(
        event?.source === 'person_birthday' || event?.is_virtual || event?.person_id
      ),
    };
  }, [event]);

  const handlePress = React.useCallback(() => {
    if (isSelectionMode) {
      if (isSelectionDisabled) {
        onSelectionDisabledPress?.(event);
        return;
      }
      if (!onToggleSelect) return;
      onToggleSelect(event);
      return;
    }
    router.push(`/events/${event.id}`);
  }, [event, isSelectionDisabled, isSelectionMode, onSelectionDisabledPress, onToggleSelect]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventCard,
        isToday && styles.eventCardToday,
        isSelectionMode && isSelected && styles.eventCardSelected,
        isSelectionMode && isSelectionDisabled && styles.eventCardSelectionDisabled,
        pressed && styles.eventCardPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.content}>
        {!isPersonGeneratedEvent ? (
          <View style={styles.textContent}>
            {event?.type === 'birthday' && birthdayAgeLabel ? (
              <Text style={styles.eventTitle} numberOfLines={1}>
                <Text>{`${birthdayName}'s `}</Text>
                <Text style={styles.birthdayAgeText}>{birthdayAgeLabel}</Text>
                <Text> birthday!</Text>
              </Text>
            ) : (
              <Text style={styles.eventTitle} numberOfLines={1}>{displayTitle}</Text>
            )}
            <Text style={styles.eventDate}>{formattedRange}</Text>
            {visiblePeople.length > 0 && (
              <View style={styles.peopleRow}>
                {visiblePeople.map((person, index) => {
                  const initials = getPersonInitials(person);
                  const avatarColors = getPersonAvatarColors(person);
                  return (
                    <View
                      key={`${person.id}-${index}`}
                      style={[styles.personAvatarWrap, index > 0 && styles.personAvatarOverlapExtraTight]}
                    >
                      {person.profile_picture_url ? (
                        <Image
                          source={{ uri: person.profile_picture_url }}
                          style={[
                            styles.personAvatar,
                            styles.personAvatarSmall,
                            isBirthdayEvent && styles.personAvatarBirthdayLarge,
                          ]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.personAvatar,
                            styles.personAvatarSmall,
                            isBirthdayEvent && styles.personAvatarBirthdayLarge,
                            styles.personAvatarPlaceholder,
                            { backgroundColor: avatarColors.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.personAvatarInitials,
                              styles.personAvatarInitialsSmall,
                              isBirthdayEvent && styles.personAvatarInitialsBirthdayLarge,
                              { color: avatarColors.fg },
                            ]}
                          >
                            {initials}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {remainingPeopleCount > 0 && (
                  <View style={[styles.personAvatarWrap, styles.personAvatarOverlapExtraTight]}>
                    <View
                      style={[
                        styles.personAvatar,
                        styles.personAvatarSmall,
                        isBirthdayEvent && styles.personAvatarBirthdayLarge,
                        styles.personCountBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.personCountText,
                          styles.personCountTextSmall,
                          isBirthdayEvent && styles.personCountTextBirthdayLarge,
                        ]}
                      >
                        +{remainingPeopleCount}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
            {event.notes && (
              <Text style={styles.eventNotes} numberOfLines={2}>
                {event.notes}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.mainRow}>
            {visiblePeople.length > 0 ? (
              <View style={styles.peopleRail}>
                {visiblePeople.map((person, index) => {
                  const initials = getPersonInitials(person);
                  const avatarColors = getPersonAvatarColors(person);
                  return (
                    <View
                      key={`${person.id}-${index}`}
                      style={[styles.personAvatarWrap, index > 0 && styles.personAvatarOverlap]}
                    >
                      {person.profile_picture_url ? (
                        <Image
                          source={{ uri: person.profile_picture_url }}
                          style={[styles.personAvatar, isBirthdayEvent && styles.personAvatarBirthdayLarge]}
                        />
                      ) : (
                        <View style={[
                          styles.personAvatar,
                          isBirthdayEvent && styles.personAvatarBirthdayLarge,
                          styles.personAvatarPlaceholder,
                          { backgroundColor: avatarColors.bg },
                        ]}
                        >
                          <Text
                            style={[
                              styles.personAvatarInitials,
                              isBirthdayEvent && styles.personAvatarInitialsBirthdayLarge,
                              { color: avatarColors.fg },
                            ]}
                          >
                            {initials}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.textContent}>
              {event?.type === 'birthday' && birthdayAgeLabel ? (
                <Text style={styles.eventTitle} numberOfLines={1}>
                  <Text>{`${birthdayName}'s `}</Text>
                  <Text style={styles.birthdayAgeText}>{birthdayAgeLabel}</Text>
                  <Text> birthday!</Text>
                </Text>
              ) : (
                <Text style={styles.eventTitle} numberOfLines={1}>{displayTitle}</Text>
              )}
              <Text style={styles.eventDate}>{formattedRange}</Text>
              {event.notes && (
                <Text style={styles.eventNotes} numberOfLines={2}>
                  {event.notes}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
      <View style={styles.iconContainer}>
        {isSelectionMode ? (
          <Ionicons
            name={
              isSelectionDisabled
                ? 'ban-outline'
                : isSelected
                  ? 'checkbox'
                  : 'square-outline'
            }
            size={wp(7.2)}
            color={
              isSelectionDisabled
                ? theme.colors.textLight
                : isSelected
                  ? theme.colors.primary
                  : theme.colors.textLight
            }
          />
        ) : (
          <Ionicons
            name={iconName}
            size={wp(7.5)}
            color={theme.colors.primary}
          />
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: wp(14),
    paddingVertical: wp(3),
    paddingHorizontal: wp(5),
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventCardToday: {
    backgroundColor: `${theme.colors.primary}15`,
  },
  eventCardSelected: {
    backgroundColor: `${theme.colors.primary}22`,
  },
  eventCardSelectionDisabled: {
    opacity: 0.7,
  },
  eventCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flex: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peopleRail: {
    width: wp(12),
    minWidth: wp(12),
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: wp(2.2),
  },
  textContent: {
    flex: 1,
    minWidth: 0,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp(0.8),
  },
  eventTitle: {
    fontSize: wp(3.7),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(0.7),
  },
  birthdayAgeText: {
    color: 'green',
    fontWeight: '700',
  },
  iconContainer: {
    marginLeft: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDate: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
    marginBottom: wp(0.8),
  },
  personAvatarWrap: {
    borderRadius: wp(4.2),
    borderWidth: 1.5,
    borderColor: theme.colors.backgroundSecondary,
  },
  personAvatarOverlap: {
    marginLeft: -wp(1.6),
  },
  personAvatarOverlapExtraTight: {
    marginLeft: -wp(2.7),
  },
  personAvatar: {
    width: wp(8.4),
    height: wp(8.4),
    borderRadius: wp(4.2),
  },
  personAvatarSmall: {
    width: wp(6.6),
    height: wp(6.6),
    borderRadius: wp(3.3),
  },
  personAvatarBirthdayLarge: {
    width: wp(9.4),
    height: wp(9.4),
    borderRadius: wp(4.7),
  },
  personAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarInitials: {
    fontSize: wp(2.8),
    fontWeight: '700',
  },
  personAvatarInitialsSmall: {
    fontSize: wp(2.3),
  },
  personAvatarInitialsBirthdayLarge: {
    fontSize: wp(4),
  },
  personCountBadge: {
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCountText: {
    fontSize: wp(2.5),
    color: theme.colors.textLight,
    fontWeight: '700',
  },
  personCountTextSmall: {
    fontSize: wp(2.1),
  },
  personCountTextBirthdayLarge: {
    fontSize: wp(2.9),
  },
  eventNotes: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
  },
});

EventCard.displayName = 'EventCard';

export default EventCard;
