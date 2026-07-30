import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { theme } from '../constants/theme';
import { wp } from '../helpers/common';

export default function DateRangePicker({
  label = 'Date',
  startDate = new Date(),
  endDate = null,
  onChange, // ({start_date, end_date})
  containerStyle,
}) {
  const [calendarWidth, setCalendarWidth] = useState(0);

  const toIsoDate = useCallback((date) => {
    if (!(date instanceof Date)) return null;
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const fromIsoDate = useCallback((isoDate) => {
    if (!isoDate) return null;
    const [year, month, day] = isoDate.split('-').map(Number);
    if (Number.isNaN(year) || !month || !day) return null;
    const noYear = year === 0;
    const date = new Date(noYear ? 2000 : year, month - 1, day);
    if (noYear) date.noYear = true;
    return date;
  }, []);

  const startIso = toIsoDate(startDate);
  const endIso = toIsoDate(endDate);

  const markedDates = useMemo(() => {
    const marks = {};

    if (!startIso) return marks;

    if (!endIso || endIso < startIso) {
      marks[startIso] = {
        startingDay: true,
        endingDay: true,
        color: theme.colors.primary,
        textColor: '#fff',
      };
      return marks;
    }

    const start = fromIsoDate(startIso);
    const end = fromIsoDate(endIso);
    if (!start || !end) return marks;

    let current = new Date(start);
    while (current <= end) {
      const currentIso = toIsoDate(current);
      if (!currentIso) break;

      const isStart = currentIso === startIso;
      const isEnd = currentIso === endIso;

      marks[currentIso] = {
        color: theme.colors.primary,
        textColor: '#fff',
        startingDay: isStart,
        endingDay: isEnd,
      };

      current.setDate(current.getDate() + 1);
    }

    return marks;
  }, [startIso, endIso, fromIsoDate, toIsoDate]);

  const handleDayPress = useCallback((day) => {
    const pressedDate = fromIsoDate(day?.dateString);
    if (!pressedDate) return;

    if (!startDate || (startDate && endDate)) {
      onChange?.({ start_date: pressedDate, end_date: null });
      return;
    }

    if (pressedDate < startDate) {
      onChange?.({ start_date: pressedDate, end_date: startDate });
      return;
    }

    onChange?.({ start_date: startDate, end_date: pressedDate });
  }, [fromIsoDate, onChange, startDate, endDate]);

  const selectedRangeText = useMemo(() => {
    if (!startDate) return 'Select a start and end date';

    const startText = startDate.toLocaleDateString();
    if (!endDate) return `Start: ${startText}`;

    return `${startText} - ${endDate.toLocaleDateString()}`;
  }, [startDate, endDate]);

  const currentMonth = useMemo(() => startIso || toIsoDate(new Date()), [startIso, toIsoDate]);

  const minDate = useMemo(() => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 10);
    return toIsoDate(today);
  }, [toIsoDate]);

  const maxDate = useMemo(() => {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 10);
    return toIsoDate(today);
  }, [toIsoDate]);

  const calendarTheme = useMemo(() => ({
    selectedDayBackgroundColor: theme.colors.primary,
    selectedDayTextColor: '#fff',
    todayTextColor: theme.colors.primary,
    arrowColor: theme.colors.primary,
    monthTextColor: theme.colors.text,
    textMonthFontWeight: '600',
    textSectionTitleColor: theme.colors.textLight,
    dayTextColor: theme.colors.text,
    textDisabledColor: '#c5c5c5',
    calendarBackground: theme.colors.background,
    // Overdraw period fillers so subpixel column gaps (varies by month width) don't
    // show as white hairlines between adjacent selected days.
    'stylesheet.day.period': {
      container: {
        alignSelf: 'stretch',
        alignItems: 'center',
        overflow: 'visible',
      },
      fillers: {
        position: 'absolute',
        height: 34,
        flexDirection: 'row',
        left: -3,
        right: -3,
      },
    },
  }), []);

  const handleCalendarLayout = useCallback((event) => {
    const width = Math.max(0, Math.floor(event?.nativeEvent?.layout?.width || 0));
    setCalendarWidth((prevWidth) => (prevWidth === width ? prevWidth : width));
  }, []);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Text style={styles.selectedRangeText}>{selectedRangeText}</Text>
      <Text style={styles.helperText}>Tap start date, then tap end date. Tap again to restart.</Text>
      <View style={styles.calendarContainer} onLayout={handleCalendarLayout}>
        <Calendar
          current={currentMonth}
          onDayPress={handleDayPress}
          enableSwipeMonths={true}
          markingType="period"
          markedDates={markedDates}
          theme={calendarTheme}
          minDate={minDate}
          maxDate={maxDate}
          onPressArrowLeft={(subtractMonth) => {
            subtractMonth();
          }}
          onPressArrowRight={(addMonth) => {
            addMonth();
          }}
          calendarWidth={calendarWidth || undefined}
          style={styles.calendar}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: wp(3),
  },
  label: {
    fontSize: wp(4),
    fontWeight: theme.fonts.medium,
    color: theme.colors.text,
  },
  selectedRangeText: {
    fontSize: wp(3.6),
    color: theme.colors.text,
    fontWeight: theme.fonts.medium,
  },
  helperText: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
  },
  calendarContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  calendar: {
    width: '100%',
  },
});
