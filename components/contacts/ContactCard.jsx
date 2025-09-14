import { Image } from 'expo-image';
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
        {person.profile_picture_url ? (
          <Image
            source={{ uri: person.profile_picture_url }}
            style={styles.avatarImage}
            contentFit="cover"
          />
        ) : (
          <Text style={styles.avatarText}>
            {person.first_name?.[0]}{person.last_name?.[0]}
          </Text>
        )}
      </View>
      
      <View style={styles.details}>
        <Text style={styles.name}>
          {person.first_name} {person.last_name}
        </Text>
        
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: wp(3),
    paddingHorizontal: wp(5),
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: wp(5),
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(0.5),
  },
  infoText: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
  },
  warningText: {
    color: theme.colors.warning,
  },
});

export default ContactCard; 