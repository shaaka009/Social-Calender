import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';

const EventDetailsScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch(`${ENDPOINTS.EVENTS}${id}/`),
  });

  if (isLoading || !event) {
    return <LoadingState />;
  }

  // Helper to format date without the UTC offset shifting the day.
  // We append "T00:00:00" so the Date constructor treats the string as
  // local-midnight, avoiding the off-by-one error that happens when it
  // interprets bare YYYY-MM-DD as UTC.
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <CustomButton
          title="← Back"
          variant="text"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={styles.title}>Event Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Event Type Badge */}
        <View style={[
          styles.badge,
          { backgroundColor: event.type === 'birthday' ? theme.colors.rose + '20' : theme.colors.primary + '20' }
        ]}>
          <Text style={[
            styles.badgeText,
            { color: event.type === 'birthday' ? theme.colors.rose : theme.colors.primary }
          ]}>
            {event.type === 'birthday' ? '🎂 Birthday' : '📅 Event'}
          </Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Information</Text>
          <InfoRow label="Title" value={event.title} />
          <InfoRow label="Date" value={formatDate(event.date)} />
          {event.person && (
            <InfoRow 
              label="Associated Contact" 
              value={`${event.person.first_name} ${event.person.last_name}`} 
            />
          )}
        </View>

        {/* Notes */}
        {event.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{event.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <CustomButton
            title="Edit Event"
            onPress={() => router.push(`/events/${id}/edit`)}
            style={styles.button}
          />
          <CustomButton
            title="Delete"
            variant="outline"
            onPress={() => router.push(`/events/${id}/delete`)}
            style={[styles.button, styles.deleteButton]}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: wp(20),
  },
  backButtonText: {
    fontSize: wp(7),
    color: theme.colors.primary,
    marginRight: wp(1),
    marginTop: -wp(1),
  },
  backButtonLabel: {
    fontSize: wp(4),
    color: theme.colors.primary,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: wp(5),
    gap: wp(6),
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    borderRadius: wp(4),
  },
  badgeText: {
    fontSize: wp(4),
    fontWeight: '500',
  },
  section: {
    gap: wp(3),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: wp(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    fontSize: wp(4),
    color: theme.colors.textLight,
  },
  value: {
    fontSize: wp(4),
    color: theme.colors.text,
    fontWeight: '500',
  },
  notes: {
    fontSize: wp(4),
    color: theme.colors.text,
    lineHeight: wp(6),
  },
  actions: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: wp(4),
  },
  button: {
    flex: 1,
  },
  deleteButton: {
    borderColor: theme.colors.error,
  },
});

export default EventDetailsScreen;
