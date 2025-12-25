import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { wp } from '../helpers/common';
import MonthDayYearPicker from './MonthDayYearPicker';

export default function DateRangePicker({
  label = 'Date',
  startDate = new Date(),
  endDate = null,
  onChange, // ({start_date, end_date})
  rangeEnabledDefault = false,
  containerStyle,
}) {
  const handleStartChange = (d) => {
    // If end_date is null or before new start, sync it to start.
    let newEnd = endDate;
    if (!endDate || (endDate && d > endDate)) {
      newEnd = d;
    }
    onChange?.({ start_date: d, end_date: newEnd });
  };
  const handleEndChange = (d) => {
    onChange?.({ start_date: startDate, end_date: d });
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Start date picker */}
      <MonthDayYearPicker
        label={'Start Date'}
        date={startDate || new Date()}
        onChange={handleStartChange}
        showYear={true}
      />

      {/* End date picker */}
      <MonthDayYearPicker
        label="End Date"
        date={endDate || startDate || new Date()}
        onChange={handleEndChange}
        showYear={true}
      />
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
});
