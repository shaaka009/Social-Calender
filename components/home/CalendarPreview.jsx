import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const CalendarPreview = ({ events = [] }) => {
  // Transform events into marked dates format for the calendar
  const markedDates = events.reduce((acc, event) => {
    // Count events on this date
    const eventsOnThisDate = events.filter(e => e.date === event.date);

    acc[event.date] = {
      // Different dot styles based on event type
      dots: eventsOnThisDate.map(e => ({
        color: e.type === 'birthday' ? theme.colors.rose : theme.colors.primary,
        key: e.id.toString(),
      })),
      // If it's today's date, show selected style
      selected: event.date === new Date().toISOString().split('T')[0],
      selectedColor: theme.colors.primary,
    };
    return acc;
  }, {});

  return (
    <View style={styles.container}>
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
        }}
        markingType={'multi-dot'}
        markedDates={markedDates}
        enableSwipeMonths={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(4),
    padding: wp(2),
    marginBottom: wp(5),
    ...theme.shadows.small,
  },
  calendar: {
    borderRadius: wp(4),
  },
});

export default CalendarPreview; 