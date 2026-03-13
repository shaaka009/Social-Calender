import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  
  // For older notifications (more than 4 weeks), show months or date
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;
  
  return past.toLocaleDateString();
};

const NotificationCard = ({ notification, onPress }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'UPCOMING_EVENT':
        return 'calendar';
      case 'NO_CONTACT':
        return 'chatbubble-ellipses-outline';
      default:
        return 'notifications';
    }
  };

  // Check if notification is related to a person
  const person = notification.person;
  const hasProfilePic = person && person.profile_picture_url;
  const hasPerson = person && person.first_name;

  const renderAvatar = () => {
    if (hasProfilePic) {
      // Show profile picture
      return (
        <Image 
          source={{ uri: person.profile_picture_url }} 
          style={styles.profilePicture}
        />
      );
    } else if (hasPerson) {
      // Show initials with colored background
      const initials = `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`;
      return (
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      );
    } else {
      // Show icon for non-person notifications
      return (
        <View style={styles.iconContainer}>
          <Ionicons name={getIcon()} size={wp(6)} color={theme.colors.primary} />
        </View>
      );
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(notification)}>
      {renderAvatar()}
      <View style={styles.content}>
        <Text style={styles.message}>{notification.message}</Text>
        {notification.type === 'NO_CONTACT' && (
          <Text style={styles.details}>
            {notification.daysSince} days since last contact
          </Text>
        )}
        {notification.type === 'UPCOMING_EVENT' && notification.date && (
          <Text style={styles.details}>{notification.date}</Text>
        )}
      </View>
      {notification.created_at && (
        <Text style={styles.timeAgo}>{formatTimeAgo(notification.created_at)}</Text>
      )}
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
      <Text style={styles.title}>Notifications</Text>
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
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  avatarContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  avatarText: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
  },
  profilePicture: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    marginRight: wp(3),
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(0.5),
  },
  details: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  timeAgo: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginLeft: wp(2),
    paddingTop: wp(0.5),
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