import { MaterialCommunityIcons } from '@expo/vector-icons';
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
        <View style={styles.nameOrg}>
          <Text style={styles.name}>
            {contact.nickname || `${person.first_name} ${person.last_name}`.trim()}
          </Text>

          {/* Organization */}
          {(contact.effective_organization || person.organization) && (
            <Text style={styles.orgText}>
              {contact.effective_organization || person.organization}
            </Text>
          )}
        </View>
        
        {daysSinceContact !== null && (
          <View style={styles.statusRow}>
            {(() => {
              const size = 12;
              if (daysSinceContact < 30) {
                return <MaterialCommunityIcons name="circle" size={size} color={theme.colors.success} style={styles.statusIcon} />;
              }
              if (daysSinceContact < 182) { // ~6 months
                return <MaterialCommunityIcons name="triangle" size={size} color={theme.colors.warning} style={styles.statusIcon} />;
              }
              return <MaterialCommunityIcons name="square" size={size} color={theme.colors.rose} style={styles.statusIcon} />;
            })()}
            <Text style={styles.infoText}>
              {daysSinceContact === 0 ? "Contacted today" :
               daysSinceContact === 1 ? "Contacted yesterday" :
               `${daysSinceContact} days since last contact`}
            </Text>
          </View>
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
  nameOrg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  name: {
    fontSize: wp(4),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(0.5),
  },
  orgText: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
    marginTop: wp(0.2),
  },
  infoText: {
    fontSize: wp(3.2),
    color: theme.colors.textLight,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.5),
  },
  statusIcon: {
    marginRight: wp(1),
  },
  warningText: {
    color: theme.colors.warning,
  },
});

export default ContactCard; 