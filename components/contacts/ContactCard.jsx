import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';
import { wp } from '../../helpers/common';

const ContactCard = ({ contact, onPress }) => {
  const person = contact.target || {};
  const daysSinceContact = contact.last_contact_date ? Math.floor((new Date() - new Date(contact.last_contact_date)) / (1000 * 60 * 60 * 24)) : null;

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(contact)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {person.first_name?.[0]}{person.last_name?.[0]}
        </Text>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.name}>
          {person.first_name} {person.last_name}
        </Text>
        
        <View style={styles.infoRow}>
          {person.birthday && (
            <Text style={styles.infoText}>
              🎂 {new Date(person.birthday).toLocaleDateString()}
            </Text>
          )}
          {daysSinceContact !== null && (
            <Text style={[
              styles.infoText,
              daysSinceContact > 30 && styles.warningText
            ]}>
              {daysSinceContact === 0 ? "Contacted today" :
               daysSinceContact === 1 ? "Contacted yesterday" :
               `${daysSinceContact} days since last contact`}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    alignItems: 'center',
    ...theme.shadows.small,
  },
  avatarContainer: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  avatarText: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '600',
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  infoText: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  warningText: {
    color: theme.colors.warning,
  },
});

export default ContactCard; 