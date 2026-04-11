import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import CustomButton from '../../../components/CustomButton';
import LoadingState from '../../../components/LoadingState';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { theme } from '../../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../../helpers/api';
import { getPersonAvatarColors, getPersonInitials } from '../../../helpers/avatar';
import { formatDateForDisplay, parseDateLocal, wp } from '../../../helpers/common';
import useConnection from '../../../helpers/useConnection';
import { useTags } from '../../../helpers/useTags';

function formatInteractionDate(dateStr) {
  if (!dateStr) return '—';
  const parsedDate = parseDateLocal(dateStr);
  return parsedDate ? parsedDate.toLocaleDateString() : '—';
}

const ContactProfileScreen = () => {
  const { id } = useLocalSearchParams();
  const { data: contact, isLoading } = useConnection(id);
  const person = contact?.target || {};
  const avatarColors = getPersonAvatarColors(person);
  const initials = getPersonInitials(person);
  const [region, setRegion] = useState(null);

  const { data: tagsPalette = [] } = useTags();
  const tagColor = (name) => tagsPalette.find((t) => t.name === name)?.color || theme.colors.primary;

  const { data: interactions = [], isLoading: isInteractionsLoading } = useQuery({
    queryKey: ['interactions', person.id],
    queryFn: async () => {
      const response = await apiFetch(`${ENDPOINTS.INTERACTIONS}?target=${person.id}`);
      return response;
    },
    enabled: Boolean(id) && Boolean(person.id),
  });

  const [selectedIndex, setSelectedIndex] = useState(0); // 0 => Info, 1 => Interactions
  const [pagerWidth, setPagerWidth] = useState(0);
  const pagerTranslateX = useRef(new Animated.Value(0)).current;
  const dragStartTranslateX = useRef(0);

  const clampTranslateX = useCallback((value) => {
    if (!pagerWidth) return 0;
    const minX = -1 * pagerWidth;
    return Math.max(minX, Math.min(0, value));
  }, [pagerWidth]);

  const snapToIndex = useCallback((index) => {
    if (!pagerWidth) return;
    const nextIndex = Math.max(0, Math.min(1, index));

    Animated.spring(pagerTranslateX, {
      toValue: -nextIndex * pagerWidth,
      useNativeDriver: false,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
    }).start();

    setSelectedIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [pagerWidth, pagerTranslateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      pagerWidth > 0
      && Math.abs(gesture.dx) > 10
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) + 4
    ),
    onPanResponderGrant: () => {
      pagerTranslateX.stopAnimation((value) => {
        dragStartTranslateX.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const nextTranslateX = clampTranslateX(dragStartTranslateX.current + gesture.dx);
      pagerTranslateX.setValue(nextTranslateX);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!pagerWidth) return;
      const projectedTranslateX = clampTranslateX(
        dragStartTranslateX.current + gesture.dx + (gesture.vx * 35)
      );
      const rawIndex = -projectedTranslateX / pagerWidth;
      const nextIndex = Math.max(0, Math.min(1, Math.round(rawIndex)));
      snapToIndex(nextIndex);
    },
    onPanResponderTerminate: () => {
      snapToIndex(selectedIndex);
    },
  }), [clampTranslateX, pagerWidth, pagerTranslateX, selectedIndex, snapToIndex]);

  useEffect(() => {
    if (!pagerWidth) return;
    snapToIndex(selectedIndex);
  }, [pagerWidth, selectedIndex, snapToIndex]);

  const displayName = contact
    ? contact.nickname || `${person.first_name} ${person.last_name}`.trim()
    : '';

  const legalName = `${person.first_name} ${person.last_name}`.trim();

  const daysSinceContact = contact?.last_contact_date
    ? Math.floor((Date.now() - new Date(contact.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const contactInfoItems = useMemo(() => {
    if (!contact) return [];
    const p = contact.target || {};
    const legal = `${p.first_name} ${p.last_name}`.trim();
    const rows = [
      {
        id: 'name',
        label: 'Name',
        value: contact.nickname ? `${legal} (${contact.nickname})` : legal || '—',
      },
    ];
    if (contact.effective_organization || p.organization) {
      rows.push({
        id: 'org',
        label: 'Organization',
        value: contact.effective_organization || p.organization,
      });
    }
    rows.push(
      { id: 'email', label: 'Email', value: p.email || '—' },
      { id: 'phone', label: 'Phone', value: p.phone || '—' },
      {
        id: 'birthday',
        label: 'Birthday',
        value: p.birthday ? formatDateForDisplay(p.birthday) : '—',
      },
    );
    return rows;
  }, [contact]);

  const lastContactSummary = useMemo(() => {
    if (!contact) return null;
    return contact.last_contact_date
      ? formatInteractionDate(contact.last_contact_date)
      : 'No interactions logged';
  }, [contact]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (person.location) {
        try {
          const geo = await Location.geocodeAsync(person.location);
          if (cancelled || !geo.length) return;
          const { latitude, longitude } = geo[0];
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 1,
            longitudeDelta: 1,
          });
        } catch (e) {
          if (!cancelled) console.warn('Failed to geocode location', e);
        }
      } else {
        if (!cancelled) setRegion(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [person.location]);

  if (isLoading || !contact) {
    return <LoadingState />;
  }

  const handleLogInteraction = () => {
    router.push(`/contacts/${id}/log-interaction`);
  };

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.titleContainer}>
          <View style={styles.titleRowLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.actionButton}>
              <Ionicons name="chevron-back" size={wp(6)} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.screenTitle} numberOfLines={1}>
              Contact
            </Text>
          </View>
          <View style={styles.titleActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/contacts/${id}/edit`)}
            >
              <Ionicons name="pencil" size={wp(6)} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileHeaderRow}>
          <View style={styles.imageContainer}>
            {person.profile_picture_url ? (
              <Image
                source={{ uri: person.profile_picture_url }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: avatarColors.bg }]}>
                <Text style={[styles.placeholderText, { color: avatarColors.fg }]}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.nameValue} numberOfLines={2}>
              {displayName}
            </Text>
            {contact.nickname ? (
              <Text style={styles.nameSubtitle} numberOfLines={1}>
                {legalName}
              </Text>
            ) : null}
            <View style={styles.statsSection}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {isInteractionsLoading ? '...' : interactions.length}
                </Text>
                <Text style={styles.statLabel}>Interactions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{contact.tags?.length ?? 0}</Text>
                <Text style={styles.statLabel}>Tags</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {daysSinceContact !== null ? daysSinceContact : '—'}
                </Text>
                <Text style={styles.statLabel}>Days since</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.segmentContainer}>
          <View style={styles.headingTabs}>
            <Pressable style={styles.headingTab} onPress={() => snapToIndex(0)}>
              <Text style={[styles.headingTabText, selectedIndex === 0 && styles.headingTabTextActive]}>
                Info
              </Text>
              <View style={[styles.headingTabUnderline, selectedIndex === 0 && styles.headingTabUnderlineActive]} />
            </Pressable>

            <Pressable style={styles.headingTab} onPress={() => snapToIndex(1)}>
              <Text style={[styles.headingTabText, selectedIndex === 1 && styles.headingTabTextActive]}>
                Interactions
              </Text>
              <View style={[styles.headingTabUnderline, selectedIndex === 1 && styles.headingTabUnderlineActive]} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.listSwipeArea}
          onLayout={({ nativeEvent }) => {
            const nextWidth = nativeEvent.layout.width;
            if (!nextWidth || Math.abs(nextWidth - pagerWidth) < 1) return;
            setPagerWidth(nextWidth);
            pagerTranslateX.setValue(-selectedIndex * nextWidth);
          }}
        >
          <View style={styles.pagerViewport}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.pagerTrack,
                {
                  width: pagerWidth ? pagerWidth * 2 : '200%',
                  transform: [{ translateX: pagerTranslateX }],
                },
              ]}
            >
              <View style={[styles.pagerPage, pagerWidth ? { width: pagerWidth } : null]}>
                <View style={styles.infoSection}>
                  {contact.tags?.length ? (
                    <>
                      <Text style={styles.subSectionTitle}>Tags</Text>
                      <View style={styles.tagContainer}>
                        {contact.tags.map((tag) => (
                          <View key={tag} style={[styles.tag, { backgroundColor: tagColor(tag) }]}>
                            <Text style={styles.tagTextWhite}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}

                  <Text style={styles.subSectionTitle}>Contact info</Text>
                  <FlatList
                    data={contactInfoItems}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    contentContainerStyle={styles.contactList}
                    renderItem={({ item }) => (
                      <View style={styles.flatInfoRow}>
                        <Text style={styles.label}>{item.label}</Text>
                        <Text style={styles.flatValue}>{item.value}</Text>
                      </View>
                    )}
                  />

                  <View style={styles.lastContactCard}>
                    <View style={styles.lastContactIconWrap}>
                      <Ionicons name="calendar-outline" size={wp(5.2)} color={theme.colors.primary} />
                    </View>
                    <View style={styles.lastContactCopy}>
                      <Text style={styles.lastContactLabel}>Last contact</Text>
                      <Text
                        style={[
                          styles.lastContactValue,
                          !contact.last_contact_date && styles.lastContactValueMuted,
                        ]}
                      >
                        {lastContactSummary}
                      </Text>
                    </View>
                  </View>

                  {person.location ? (
                    <View style={styles.flatInfoRow}>
                      <Text style={styles.subSectionTitle}>Location</Text>
                      <Text style={styles.flatValue}>{person.location}</Text>
                    </View>
                  ) : null}

                  {(contact.notes || person.notes) ? (
                    <>
                      <Text style={[styles.subSectionTitle, styles.notesHeading]}>Notes</Text>
                      <Text style={styles.notesText}>{contact.notes || person.notes}</Text>
                    </>
                  ) : null}
                </View>

                <View style={styles.mapContainer}>
                  {person.location && region ? (
                    <MapView
                      style={styles.map}
                      region={region}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      <Marker coordinate={region} />
                    </MapView>
                  ) : (
                    <View style={styles.mapFallback}>
                      <Ionicons
                        name="map-outline"
                        size={wp(10)}
                        color={theme.colors.primary}
                        style={styles.mapFallbackIcon}
                      />
                      <Text style={styles.mapFallbackTitle}>
                        {person.location ? 'Finding location...' : 'No location added'}
                      </Text>
                      <Text style={styles.mapFallbackSubtitle}>
                        {person.location
                          ? person.location
                          : 'Add a location when editing this contact to see it here.'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.pagerPage, pagerWidth ? { width: pagerWidth } : null]}>
                <View style={styles.infoSection}>
                  <View style={styles.interactionsHeaderRow}>
                    <Text style={styles.subSectionTitle}>Recent interactions</Text>
                    <CustomButton
                      title="Log interaction"
                      variant="outline"
                      onPress={handleLogInteraction}
                      style={styles.quickActionButton}
                      icon={
                        <Ionicons
                          name="add-circle-outline"
                          size={wp(5)}
                          color={theme.colors.primary}
                          style={styles.buttonIcon}
                        />
                      }
                    />
                  </View>

                  {interactions.length > 0 ? (
                    interactions.map((interaction) => (
                      <View key={interaction.id} style={styles.interactionCard}>
                        <View style={styles.interactionHeader}>
                          <Text style={styles.interactionType}>
                            {interaction.type_display}
                            {interaction.is_mirrored && (
                              <Text style={styles.loggedBy}> (logged by {person.first_name})</Text>
                            )}
                          </Text>
                          <Text style={styles.interactionDate}>
                            {formatInteractionDate(interaction.date)}
                          </Text>
                        </View>
                        {interaction.notes ? (
                          <Text style={styles.interactionNotes}>{interaction.notes}</Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No interactions logged yet</Text>
                  )}
                </View>
              </View>
            </Animated.View>
          </View>
        </View>

        <CustomButton
          title="Delete Contact"
          variant="text"
          onPress={() => router.push(`/contacts/${id}/delete`)}
          style={styles.deleteButton}
          textStyle={{ color: theme.colors.danger }}
        />

        <View style={{ height: wp(10) }} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: wp(5),
    paddingBottom: wp(30),
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(4),
    paddingHorizontal: wp(5),
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: wp(0.5),
    marginRight: wp(2),
  },
  screenTitle: {
    fontSize: wp(9),
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
  },
  titleActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    borderRadius: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileHeaderRow: {
    marginHorizontal: wp(5),
    marginBottom: wp(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  imageContainer: {
    width: wp(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
  },
  placeholderImage: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: wp(12),
    fontWeight: '700',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'space-between',
    gap: wp(1),
    left: wp(2),
    top: wp(0.5),
  },
  nameValue: {
    fontSize: wp(6),
    color: theme.colors.text,
    fontWeight: '700',
  },
  nameSubtitle: {
    fontSize: wp(3.2),
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: -wp(0.5),
  },
  statsSection: {
    flexDirection: 'row',
    gap: wp(2),
    left: -wp(1.5),
    marginTop: wp(1),
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(2),
    paddingHorizontal: wp(1.5),
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: wp(0.5),
  },
  statValue: {
    fontSize: wp(4.5),
    left: wp(0.5),
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  statLabel: {
    fontSize: wp(2.3),
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'left',
    left: wp(0.5),
  },
  segmentContainer: {
    paddingTop: wp(2),
    marginBottom: wp(2),
  },
  headingTabs: {
    marginHorizontal: wp(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: wp(2),
  },
  headingTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: wp(1.5),
  },
  headingTabText: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  headingTabTextActive: {
    color: theme.colors.primary,
  },
  headingTabUnderline: {
    marginTop: wp(1.5),
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  headingTabUnderlineActive: {
    backgroundColor: theme.colors.primary,
  },
  listSwipeArea: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pagerViewport: {
    width: '100%',
    overflow: 'hidden',
  },
  pagerTrack: {
    flexDirection: 'row',
  },
  pagerPage: {
    flex: 1,
  },
  infoSection: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(4),
    gap: wp(3),
    marginHorizontal: wp(5),
  },
  contactList: {
    gap: 0,
  },
  lastContactCard: {
    marginTop: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    paddingVertical: wp(2.8),
    paddingHorizontal: wp(3),
    borderRadius: wp(2.5),
    backgroundColor: theme.colors.primaryLight,
    borderLeftWidth: wp(0.6),
    borderLeftColor: theme.colors.primary,
  },
  lastContactIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastContactCopy: {
    flex: 1,
    gap: wp(0.4),
  },
  lastContactLabel: {
    fontSize: wp(3),
    lineHeight: wp(3.4),
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lastContactValue: {
    fontSize: wp(3.6),
    lineHeight: wp(4.2),
    color: theme.colors.text,
    fontWeight: '600',
  },
  lastContactValueMuted: {
    color: theme.colors.textLight,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  subSectionTitle: {
    fontSize: wp(4.6),
    color: theme.colors.text,
    fontWeight: '600',
  },
  notesHeading: {
    marginTop: wp(1),
  },
  flatInfoRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: wp(0.6),
    paddingVertical: wp(1.4),
  },
  label: {
    fontSize: wp(3),
    lineHeight: wp(3.4),
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  flatValue: {
    fontSize: wp(2.8),
    lineHeight: wp(3.4),
    color: theme.colors.text,
    fontWeight: '500',
    textAlign: 'left',
    flexShrink: 1,
    maxWidth: '100%',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  tag: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
  },
  tagTextWhite: {
    color: '#fff',
    fontSize: wp(3.5),
  },
  notesText: {
    fontSize: wp(2.8),
    lineHeight: wp(4),
    color: theme.colors.text,
    fontWeight: '500',
  },
  mapContainer: {
    marginTop: wp(2),
    marginHorizontal: wp(5),
    borderRadius: wp(3),
    overflow: 'hidden',
    height: wp(60),
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(6),
  },
  mapFallbackIcon: {
    marginBottom: wp(2),
  },
  mapFallbackTitle: {
    fontSize: wp(4.3),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(1),
    textAlign: 'center',
  },
  mapFallbackSubtitle: {
    fontSize: wp(3.6),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: wp(5),
  },
  quickActionButton: {
    minWidth: wp(28),
    paddingVertical: wp(1.5),
  },
  buttonIcon: {
    marginRight: wp(2),
  },
  interactionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: wp(2),
  },
  interactionCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginTop: wp(1),
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: wp(1),
  },
  interactionType: {
    fontSize: wp(3.8),
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
    marginRight: wp(2),
  },
  interactionDate: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
  interactionNotes: {
    fontSize: wp(3.5),
    color: theme.colors.text,
    marginTop: wp(1),
  },
  emptyText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: wp(3),
  },
  loggedBy: {
    fontSize: wp(3),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  deleteButton: {
    alignSelf: 'center',
    marginTop: wp(6),
    minWidth: wp(50),
  },
});

export default ContactProfileScreen;
