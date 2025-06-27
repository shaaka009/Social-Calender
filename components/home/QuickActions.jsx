import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { wp } from '../../helpers/common';
import CustomButton from '../CustomButton';

const QuickActions = () => {
  const actions = [
    {
      label: 'Add Contact',
      onPress: () => router.push('/contacts/new'),
      icon: '👤',
    },
    {
      label: 'Log Interaction',
      onPress: () => router.push('/interactions/new'),
      icon: '📝',
    },
    {
      label: 'Create Event',
      onPress: () => router.push('/events/new'),
      icon: '📅',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {actions.map((action, index) => (
          <View key={action.label} style={styles.buttonWrapper}>
            <CustomButton
              title={action.label}
              onPress={action.onPress}
              leftIcon={action.icon}
              style={styles.button}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: wp(5),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -wp(1),
  },
  buttonWrapper: {
    width: '33.33%',
    padding: wp(1),
  },
  button: {
    height: wp(12),
  },
});

export default QuickActions; 