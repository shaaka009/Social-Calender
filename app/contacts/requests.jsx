import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import CustomButton from '../../components/CustomButton';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';
import { useSubmitGuard } from '../../helpers/useSubmitGuard';

const ContactRequestsScreen = () => {
  const queryClient = useQueryClient();
  const { isSubmitting, run } = useSubmitGuard();
  
  // Get current user data
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiFetch(ENDPOINTS.USER),
  });
  
  // Fetch contacts with pending status
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: async () => {
      const contacts = await apiFetch(ENDPOINTS.CONNECTIONS);
      
      const filteredContacts = contacts.filter(c => {
        const isPending = c.status === 'pending';
        const isFromSomeoneElse = c.owner.id !== currentUser?.user?.id;
        const isToCurrentUser = c.target.id === currentUser?.user?.id;

        return isPending && isFromSomeoneElse && isToCurrentUser;
      });
      
      return filteredContacts;
    },
    // Only run this query when we have user data
    enabled: Boolean(currentUser?.success)
  });

  const handleAccept = useCallback((contactId) => run(async () => {
    try {
      await apiFetch(`${ENDPOINTS.CONNECTIONS}${contactId}/accept/`, {
        method: 'POST'
      });
      queryClient.invalidateQueries(['connections']);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to accept request');
    }
  }), [queryClient, run]);

  const handleDecline = useCallback((contactId) => run(async () => {
    try {
      await apiFetch(`${ENDPOINTS.CONNECTIONS}${contactId}/decline/`, {
        method: 'POST'
      });
      queryClient.invalidateQueries(['connections']);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to decline request');
    }
  }), [queryClient, run]);

  const renderRequest = useCallback(({ item: contact }) => (
    <View style={styles.requestCard}>
      <View>
        <Text style={styles.userName}>
          {contact.owner.first_name} {contact.owner.last_name}
        </Text>
        <Text style={styles.userEmail}>{contact.owner.email}</Text>
      </View>
      
      <View style={styles.actionButtons}>
        <CustomButton
          title="Accept"
          onPress={() => handleAccept(contact.id)}
          style={styles.actionButton}
          disabled={isSubmitting}
        />
        <CustomButton
          title="Decline"
          variant="outline"
          onPress={() => handleDecline(contact.id)}
          style={styles.actionButton}
          disabled={isSubmitting}
        />
      </View>
    </View>
  ), [handleAccept, handleDecline, isSubmitting]);

  return (
    <ScreenWrapper>
      {/* Navigation Header */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Contact Requests</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.container}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No pending contact requests
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: wp(3) }} />}
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: wp(4),
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: wp(15),
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
    padding: wp(5),
    flexGrow: 1,
  },
  requestCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    ...theme.shadows.small,
  },
  userName: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginTop: wp(1),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: wp(3),
    marginTop: wp(4),
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp(8),
  },
  emptyStateText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
});

export default ContactRequestsScreen; 