import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';

const DeleteEventScreen = () => {
  const { id } = useLocalSearchParams();
  const eventId = Array.isArray(id) ? id[0] : id;
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch event data
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiFetch(`${ENDPOINTS.EVENTS}${eventId}/`),
    enabled: Boolean(eventId),
    staleTime: 60 * 1000,
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`${ENDPOINTS.EVENTS}${eventId}/`, {
        method: 'DELETE',
      });

      // Show success toast
      Toast.show('Event deleted successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['events']);
      queryClient.invalidateQueries(['dashboard']);

      // Navigate to events list
      router.replace('/events');
    } catch (error) {
      Toast.show(error.message || 'Failed to delete event', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.error,
      });
      setIsDeleting(false);
    }
  };

  if (isLoading || !event) {
    return <LoadingState />;
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Delete Event</Text>
          <Text style={styles.message}>
            Are you sure you want to delete "{event.title}"? This action cannot be undone.
          </Text>

          <View style={styles.actions}>
            <CustomButton
              title="Cancel"
              variant="outline"
              onPress={() => router.back()}
              style={styles.button}
              disabled={isDeleting}
            />
            <CustomButton
              title={isDeleting ? "Deleting..." : "Delete"}
              onPress={handleDelete}
              style={[styles.button, styles.deleteButton]}
              disabled={isDeleting}
            />
          </View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
    justifyContent: 'center',
  },
  content: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(4),
    padding: wp(5),
    ...theme.shadows.medium,
  },
  title: {
    fontSize: wp(6),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(4),
    textAlign: 'center',
  },
  message: {
    fontSize: wp(4),
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: wp(6),
    lineHeight: wp(6),
  },
  actions: {
    flexDirection: 'row',
    gap: wp(3),
  },
  button: {
    flex: 1,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
});

export default DeleteEventScreen;
