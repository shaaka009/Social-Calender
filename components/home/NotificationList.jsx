import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const NotificationCard = ({ notification, onPress }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'UPCOMING_EVENT':
        return '🎉';
      case 'NO_CONTACT':
        return '💭';
      default:
        return '📌';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(notification)}>
      <Text style={styles.icon}>{getIcon()}</Text>
      <View style={styles.content}>
        <Text style={styles.message}>{notification.message}</Text>
        <Text style={styles.timestamp}>
          {notification.type === 'NO_CONTACT' 
            ? `${notification.daysSince} days since last contact`
            : notification.date}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const NotificationList = ({ notifications = [], onNotificationPress }) => {
  if (!notifications.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No notifications at the moment</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upcoming Dates</Text>
      <View style={styles.list}>
        {notifications.map((notification) => (
          <React.Fragment key={notification.id}>
            <NotificationCard
              notification={notification}
              onPress={onNotificationPress}
            />
            {/* Add separator if not the last item */}
            {notification.id !== notifications[notifications.length - 1].id && (
              <View style={styles.separator} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: wp(5),
  },
  title: {
    fontSize: wp(5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  list: {
    gap: wp(2),
  },
  card: {
    flexDirection: 'row',
    padding: wp(4),
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    alignItems: 'center',
  },
  icon: {
    fontSize: wp(6),
    marginRight: wp(3),
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  timestamp: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  separator: {
    height: wp(2),
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textLight,
    fontSize: wp(4),
    fontStyle: 'italic',
  },
});

export default NotificationList; 