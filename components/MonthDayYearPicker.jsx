import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { wp } from '../helpers/common';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function MonthDayYearPicker({
  label,
  date = new Date(),
  onChange,
  containerStyle,
}) {
  const [month, setMonth] = useState(date.getMonth());
  const [dayStr, setDayStr] = useState(String(date.getDate()));
  const [yearStr, setYearStr] = useState(String(date.getFullYear()));

  // Update when parent date prop changes
  useEffect(() => {
    setMonth(date.getMonth());
    setDayStr(String(date.getDate()));
    setYearStr(String(date.getFullYear()));
  }, [date]);

  const [showMonthWheel, setShowMonthWheel] = useState(false);
  const [tempMonth, setTempMonth] = useState(month);

  useEffect(() => {
    if (showMonthWheel) {
      setTempMonth(month);
    }
  }, [showMonthWheel, month]);

  const daysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();

  const propagate = (m, d, y) => {
    const safeDay = Math.min(d, daysInMonth(m, y));
    const newDate = new Date(y, m, safeDay);
    onChange?.(newDate);
  };

  const handleConfirmMonth = () => {
    setMonth(tempMonth);
    propagate(tempMonth, Number(dayStr) || 1, Number(yearStr));
    setShowMonthWheel(false);
  };

  const handleDayChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setDayStr(cleaned);
    const num = Number(cleaned);
    if (num >= 1 && num <= daysInMonth(month, Number(yearStr))) {
      propagate(month, num, Number(yearStr));
    }
  };

  const handleYearChange = (text) => {
    // Keep raw string for user typing
    const cleaned = text.replace(/[^0-9]/g, '');
    setYearStr(cleaned);

    // Only propagate once we have 4 digits
    if (cleaned.length === 4) {
      const num = Number(cleaned);
      const currentYear = new Date().getFullYear();
      const validYear = Math.min(Math.max(num, 1900), currentYear);
      setYearStr(String(validYear));
      propagate(month, Number(dayStr) || 1, validYear);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.inputBase, styles.monthInput]}
          onPress={() => setShowMonthWheel(true)}
        >
          <Text style={styles.inputText}>{MONTHS[month]}</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.inputBase, styles.dayInput]}
          value={dayStr}
          placeholder="Day"
          placeholderTextColor={theme.colors.textLight + '90'}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={handleDayChange}
        />

        <TextInput
          style={[styles.inputBase, styles.yearInput]}
          value={yearStr}
          placeholder="Year"
          placeholderTextColor={theme.colors.textLight + '90'}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={handleYearChange}
        />
      </View>

      {/* Month wheel modal */}
      <Modal
        visible={showMonthWheel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthWheel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.wheelContainer}>
            <Picker
              selectedValue={tempMonth}
              onValueChange={(v) => setTempMonth(v)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {MONTHS.map((m, idx) => (
                <Picker.Item key={idx} label={m} value={idx} />
              ))}
            </Picker>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmMonth}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: wp(2) },
  row: {
    flexDirection: 'row',
    gap: wp(2),
    alignItems: 'center',
  },
  label: {
    fontSize: wp(4),
    fontWeight: theme.fonts.medium,
    color: theme.colors.text,
  },
  inputBase: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    paddingVertical: wp(3),
    paddingHorizontal: wp(4),
    minWidth: wp(20),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  inputText: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  monthInput: { flex: 2 },
  dayInput: { flex: 1, textAlign: 'center' },
  yearInput: { flex: 1.5, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
  },
  wheelContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: wp(3),
    width: '80%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    fontSize: wp(5),
  },
  confirmBtn: {
    paddingVertical: wp(3),
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmText: {
    fontSize: wp(4),
    fontWeight: theme.fonts.medium,
    color: theme.colors.primary,
  },
}); 