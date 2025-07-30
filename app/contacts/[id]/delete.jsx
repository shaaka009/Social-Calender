import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-root-toast';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { wp } from '../../../helpers/common';
import useContact from '../../../helpers/useContact';

const DeleteContactScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useContact(id);
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`${ENDPOINTS.CONTACTS}${id}/`, {
        method: 'DELETE',
      });
      
      // Invalidate contacts queries to refresh the list
      queryClient.invalidateQueries(['contacts']);
      
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

      // Navigate back to contacts list with a slight delay to allow toast to be seen
      setTimeout(() => {
        router.replace('/contacts');
      }, 500);
    } catch (error) {
      console.error('Failed to delete contact:', error);
      Alert.alert('Error', error.message || 'Failed to delete contact');
      setIsDeleting(false);
    }
  };

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  const isAppUser = Boolean(contact.contact_user);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Delete Contact</Text>
      </View>

      <View style={styles.container}>
        {/* Warning Icon */}
        <View style={styles.warningIcon}>
          <Text style={styles.warningText}>⚠️</Text>
        </View>

        {/* Confirmation Message */}
        <Text style={styles.message}>
          Are you sure you want to delete {contact.first_name} {contact.last_name} from your contacts?
        </Text>

        {isAppUser ? (
          <>
            <Text style={styles.submessage}>
              This action will:
            </Text>
            <View style={styles.bulletPoints}>
              <Text style={styles.bulletPoint}>• Remove {contact.first_name} from your contacts</Text>
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
            onPress={() => router.back()}
            style={styles.button}
            disabled={isDeleting}
          />
          <CustomButton
            title={isDeleting ? "Deleting..." : "Delete"}
            variant="danger"
            onPress={handleDelete}
            style={styles.button}
            disabled={isDeleting}
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
  },
  warningText: {
    fontSize: wp(15),
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