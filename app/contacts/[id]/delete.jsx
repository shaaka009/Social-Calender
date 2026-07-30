import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';
import { useOneShot, useSubmitGuard } from '../../../helpers/useSubmitGuard';

const DeleteContactScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};
  const queryClient = useQueryClient();
  const { isSubmitting, run } = useSubmitGuard();
  const goOnce = useOneShot();

  const handleDelete = () => run(async () => {
    try {
      await apiFetch(`${ENDPOINTS.CONNECTIONS}${id}/`, {
        method: 'DELETE',
      });
      
      // Remove the specific contact query from cache
      queryClient.removeQueries(['connection', id]);
      
      // Invalidate contacts queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      
      // Show success toast
      Toast.show('Contact deleted successfully', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: theme.colors.success,
        shadow: true,
        animation: true,
        hideOnPress: true,
        delay: 0,
      });

      // Navigate back to contacts list immediately
      goOnce(() => router.replace('/contacts'));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to delete contact');
    }
  });

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  const isAppUser = Boolean(contact.target?.is_app_user);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Delete Contact</Text>
      </View>

      <View style={styles.container}>
        {/* Warning Icon */}
        <View style={styles.warningIcon}>
          <Ionicons name="warning" size={wp(20)} color={theme.colors.error} />
        </View>

        {/* Confirmation Message */}
        <Text style={styles.message}>
          Are you sure you want to delete {person.first_name} {person.last_name} from your contacts?
        </Text>

        {isAppUser ? (
          <>
            <Text style={styles.submessage}>
              This action will:
            </Text>
            <View style={styles.bulletPoints}>
              <Text style={styles.bulletPoint}>• Remove {person.first_name} from your contacts</Text>
              <Text style={styles.bulletPoint}>• Remove you from their contacts list</Text>
              <Text style={styles.bulletPoint}>• Delete all associated notes and reminders</Text>
            </View>
            <Text style={styles.submessage}>
              This action cannot be undone.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.submessage}>
              This action will:
            </Text>
            <View style={styles.bulletPoints}>
              <Text style={styles.bulletPoint}>• Remove this contact from your list</Text>
              <Text style={styles.bulletPoint}>• Delete all associated notes and reminders</Text>
            </View>
            <Text style={styles.submessage}>
              This action cannot be undone.
            </Text>
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <CustomButton
            title="Cancel"
            variant="outline"
            onPress={() => goOnce(() => router.back())}
            style={styles.button}
            disabled={isSubmitting}
          />
          <CustomButton
            title={isSubmitting ? "Deleting..." : "Delete"}
            variant="danger"
            onPress={handleDelete}
            style={styles.button}
            disabled={isSubmitting}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    padding: wp(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIcon: {
    marginBottom: wp(5),
    alignItems: 'center',
  },
  message: {
    fontSize: wp(4.5),
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: wp(4),
    fontWeight: '600',
  },
  submessage: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginVertical: wp(2),
  },
  bulletPoints: {
    alignSelf: 'stretch',
    paddingHorizontal: wp(5),
    marginVertical: wp(2),
  },
  bulletPoint: {
    fontSize: wp(4),
    color: theme.colors.text,
    marginVertical: wp(1),
  },
  actions: {
    flexDirection: 'row',
    gap: wp(3),
    width: '100%',
    marginTop: wp(8),
  },
  button: {
    flex: 1,
  },
});

export default DeleteContactScreen; 