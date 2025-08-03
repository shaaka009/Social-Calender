import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const HeaderGreeting = ({ user }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {getGreeting()}, {user?.first_name || 'there'}!
      </Text>
      <Text style={styles.subtitle}>Here&apos;s what&apos;s happening in your social circle</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: wp(5),
  },
  greeting: {
    fontSize: wp(6),
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  subtitle: {
    fontSize: wp(4),
    color: theme.colors.textLight,
  },
});

export default HeaderGreeting; 