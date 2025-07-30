import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { wp } from '../../../helpers/common';
import useContact from '../../../helpers/useContact';

const ContactProfileScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useContact(id);

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
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
            {contact.first_name?.[0]}{contact.last_name?.[0]}
          </Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <InfoRow label="Name" value={`${contact.first_name} ${contact.last_name}`} />
          <InfoRow label="Email" value={contact.email || '—'} />
          <InfoRow label="Phone" value={contact.phone || '—'} />
          <InfoRow label="Birthday" value={formatDate(contact.birthday)} />
        </View>

        {/* Notes */}
        {contact.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{contact.notes}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {contact.tags?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagContainer}>
              {contact.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Actions (Edit/Delete to be implemented later) */}
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
});

export default ContactProfileScreen; 