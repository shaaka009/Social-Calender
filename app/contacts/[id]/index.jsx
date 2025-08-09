import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';

const ContactProfileScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};
  
  // Fetch recent interactions
  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', person.id],
    queryFn: async () => {
      const response = await apiFetch(`${ENDPOINTS.INTERACTIONS}?target=${person.id}`);
      return response;
    },
    // Only fetch when we have both the connection ID and the person ID
    enabled: Boolean(id) && Boolean(person.id),
  });

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const handleLogInteraction = () => {
    router.push(`/contacts/${id}/log-interaction`);
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Contact Profile</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {person.first_name?.[0]}{person.last_name?.[0]}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <CustomButton
            title="Log Interaction"
            onPress={handleLogInteraction}
            style={styles.quickActionButton}
            variant="outline"
            icon={<Ionicons name="add-circle-outline" size={wp(5)} color={theme.colors.primary} style={styles.buttonIcon} />}
          />
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <InfoRow label="Name" value={`${person.first_name} ${person.last_name}`} />
          <InfoRow label="Email" value={person.email || '—'} />
          <InfoRow label="Phone" value={person.phone || '—'} />
          <InfoRow label="Birthday" value={formatDate(person.birthday)} />
          <InfoRow 
            label="Last Contact" 
            value={contact.last_contact_date ? formatDate(contact.last_contact_date) : 'No interactions logged'}
          />
        </View>

        {/* Recent Interactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Interactions</Text>
          {interactions.length > 0 ? (
            interactions.map((interaction) => (
              <View key={interaction.id} style={styles.interactionCard}>
                <View style={styles.interactionHeader}>
                  <Text style={styles.interactionType}>
                    {interaction.type_display}
                    {interaction.is_mirrored && (
                      <Text style={styles.loggedBy}> (logged by {person.first_name})</Text>
                    )}
                  </Text>
                  <Text style={styles.interactionDate}>{formatDate(interaction.date)}</Text>
                </View>
                {interaction.notes && (
                  <Text style={styles.interactionNotes}>{interaction.notes}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No interactions logged yet</Text>
          )}
        </View>

        {/* Notes */}
        {person.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{person.notes}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {person.tags?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagContainer}>
              {person.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Actions (Edit/Delete) */}
        <View style={styles.actions}>
          <CustomButton
            title="Edit Contact"
            onPress={() => router.push(`/contacts/${id}/edit`)}
            style={{ flex: 1 }}
          />
          <CustomButton
            title="Delete"
            variant="outline"
            onPress={() => router.push(`/contacts/${id}/delete`)}
            style={{ flex: 1, marginLeft: wp(3) }}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: wp(5),
    gap: wp(4),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: wp(20),
  },
  backText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  avatarContainer: {
    alignSelf: 'center',
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: wp(10),
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: wp(2),
  },
  quickActionButton: {
    minWidth: wp(40),
  },
  buttonIcon: {
    marginRight: wp(2),
  },
  section: {
    gap: wp(2),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: wp(1),
  },
  infoLabel: {
    color: theme.colors.textLight,
    fontSize: wp(4),
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  interactionCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginVertical: wp(1),
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(1),
  },
  interactionType: {
    fontSize: wp(3.8),
    fontWeight: '500',
    color: theme.colors.text,
  },
  interactionDate: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  interactionNotes: {
    fontSize: wp(3.5),
    color: theme.colors.text,
    marginTop: wp(1),
  },
  emptyText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: wp(3),
  },
  notesText: {
    fontSize: wp(4),
    color: theme.colors.text,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tag: {
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
  },
  tagText: {
    color: theme.colors.text,
    fontSize: wp(3.5),
  },
  actions: {
    flexDirection: 'row',
    marginTop: wp(4),
  },
  loggedBy: {
    fontSize: wp(3),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
});

export default ContactProfileScreen; 