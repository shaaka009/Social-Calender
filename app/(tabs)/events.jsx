import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const Events = () => {
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Events</Text>
        <Text style={styles.subtitle}>Coming soon...</Text>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: wp(6),
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  subtitle: {
    fontSize: wp(4),
    color: theme.colors.textLight,
  },
});

export default Events; 