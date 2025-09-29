import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { parseDateLocal, wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';
import { useTags } from '../../../helpers/useTags';

const ContactProfileScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};

  // Get user's tag palette to resolve colors
  const { data: tagsPalette = [] } = useTags();

  const tagColor = (name) => tagsPalette.find((t) => t.name === name)?.color || theme.colors.primary;

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

  const [tab, setTab] = useState('info');

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return parseDateLocal(dateStr).toLocaleDateString();
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
          <CustomButton
            title="Edit"
            variant="text"
            onPress={() => router.push(`/contacts/${id}/edit`)}
            style={styles.backBtn}
          />
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {person.profile_picture_url ? (
            <Image source={{ uri: person.profile_picture_url }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>
              {person.first_name?.[0]}{person.last_name?.[0]}
            </Text>
          )}
        </View>

        {/* Name Title */}
        <Text style={styles.nameTitle}>{contact.nickname || `${person.first_name} ${person.last_name}`.trim()}</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabButton, tab === 'info' && styles.tabButtonActive]} onPress={()=>setTab('info')}>
            <Text style={[styles.tabText, tab === 'info' && styles.tabTextActive]}>Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, tab === 'interactions' && styles.tabButtonActive]} onPress={()=>setTab('interactions')}>
            <Text style={[styles.tabText, tab === 'interactions' && styles.tabTextActive]}>Interactions</Text>
          </TouchableOpacity>
        </View>

        {tab === 'info' && (
          <>
            {/* Tags */}
            {contact.tags?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View style={styles.tagContainer}>
                  {contact.tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: tagColor(tag) }] }>
                      <Text style={styles.tagTextWhite}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Basic Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              <InfoRow label="Name" value={contact.nickname ? `${person.first_name} ${person.last_name} (${contact.nickname})` : `${person.first_name} ${person.last_name}`.trim()} />
              {(contact.effective_organization || person.organization) && (
                <InfoRow label="Organization" value={contact.effective_organization || person.organization} />
              )}
              {person.location && (
                <InfoRow label="Location" value={person.location} />
              )}
              <InfoRow label="Email" value={person.email || '—'} />
              <InfoRow label="Phone" value={person.phone || '—'} />
              <InfoRow label="Birthday" value={formatDate(person.birthday)} />
              <InfoRow
                label="Last Contact"
                value={contact.last_contact_date ? formatDate(contact.last_contact_date) : 'No interactions logged'}
              />
            </View>

            {/* Notes */}
            {person.notes ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{person.notes}</Text>
              </View>
            ) : null}
          </>
        )}

        {tab === 'interactions' && (
          <>
            {/* Interactions Header with Log Button */}
            <View style={[styles.section, styles.interactionsHeader]}>
              <View style={styles.interactionsHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Interactions</Text>
                <CustomButton
                  title="Log Interaction"
                  variant="outline"
                  onPress={handleLogInteraction}
                  style={styles.quickActionButton}
                  icon={<Ionicons name="add-circle-outline" size={wp(5)} color={theme.colors.primary} style={styles.buttonIcon} />}
                />
              </View>
            </View>

            {/* Interactions List */}
            <View style={styles.section}>
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
          </>
        )}

        {/* Delete Button */}
        <CustomButton
          title="Delete Contact"
          variant="text"
          onPress={() => router.push(`/contacts/${id}/delete`) }
          style={styles.deleteButton}
          textStyle={{ color: theme.colors.danger }}
        />

        <View style={{ height: wp(10) }} />
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: wp(12),
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
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
  },
  tagTextWhite: {
    color: '#fff',
    fontSize: wp(3.5),
  },
  actions: {
    flexDirection: 'row',
    marginTop: wp(4),
  },
  deleteButton: {
    alignSelf: 'center',
    marginTop: wp(6),
    minWidth: wp(50),
  },
  interactionsHeader: {
    marginTop: wp(2),
  },
  interactionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loggedBy: {
    fontSize: wp(3),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  nameTitle: {
    fontSize: wp(6),
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: wp(3),
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    marginTop: wp(4),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(4),
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp(2),
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: wp(4),
    color: theme.colors.text,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ContactProfileScreen; 