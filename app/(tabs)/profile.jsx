import { Ionicons } from '@expo/vector-icons';
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { apiFetch, ENDPOINTS } from "../../helpers/api";
import { getPersonAvatarColors, getPersonInitials } from "../../helpers/avatar";
import { formatDateForDisplay, wp } from "../../helpers/common";
import useContacts from "../../helpers/useContacts";
import useDashboard from "../../helpers/useDashboard";
import useProfile from "../../helpers/useProfile";
import { useTags } from "../../helpers/useTags";

const TAG_PREVIEW_ROWS = 3;
const EST_CHIP_WIDTH_PCT = 22;

const ProfileScreen = () => {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { data, isLoading, isError } = useProfile();
  const { data: tags = [], isLoading: isTagsLoading } = useTags();
  const { data: connections = [], isLoading: isConnectionsLoading } = useContacts();
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboard();
  const { data: interactions = [], isLoading: isInteractionsLoading } = useQuery({
    queryKey: ["interactions", "profile-stats"],
    queryFn: () => apiFetch(ENDPOINTS.INTERACTIONS),
    staleTime: 30 * 1000,
  });
  const [region, setRegion] = React.useState(null);
  const [showContactEmailInfo, setShowContactEmailInfo] = React.useState(false);
  const avatarColors = getPersonAvatarColors(data || {});
  const initials = getPersonInitials(data || {});
  const connectionsCount = Array.isArray(connections)
    ? connections.filter((connection) => connection.status === "accepted").length
    : 0;
  const totalInteractionsCount = Array.isArray(interactions) ? interactions.length : 0;
  const allEventsCount = React.useMemo(() => {
    if (!Array.isArray(dashboard?.events)) return 0;
    return dashboard.events.length;
  }, [dashboard?.events]);
  const contactInfoItems = React.useMemo(() => {
    const items = [
      { id: "contact_email", label: "Contact Email", value: data?.contact_email || "-", isContactEmail: true },
      { id: "phone", label: "Phone", value: data?.phone || "-" },
    ];

    if (Array.isArray(data?.extra_contacts)) {
      data.extra_contacts.forEach((c, idx) => {
        items.push({
          id: `extra_${idx}`,
          label: c?.type || "Other Contact",
          value: c?.value || "-",
        });
      });
    }

    items.push({
      id: "birthday",
      label: "Birthday",
      value: data?.birthday ? formatDateForDisplay(data.birthday) : "-",
    });

    return items;
  }, [data]);

  // Geocode the user's location string to coordinates
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (data?.location) {
        try {
          const geo = await Location.geocodeAsync(data.location);
          if (cancelled || !geo.length) return;
          const { latitude, longitude } = geo[0];
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 1,
            longitudeDelta: 1,
          });
        } catch (e) {
          if (!cancelled) console.warn("Failed to geocode location", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.location]);

  const { tagsPreview, tagsPreviewOverflow } = React.useMemo(() => {
    const sectionMargin = wp(5) * 2;
    const sectionPad = wp(4) * 2;
    const innerW = Math.max(0, windowWidth - sectionMargin - sectionPad);
    const estChipW = wp(EST_CHIP_WIDTH_PCT);
    const chipsPerRow = Math.max(2, Math.floor(innerW / estChipW));
    const maxVisible = chipsPerRow * TAG_PREVIEW_ROWS;
    if (!Array.isArray(tags) || tags.length === 0) {
      return { tagsPreview: [], tagsPreviewOverflow: 0 };
    }
    return {
      tagsPreview: tags.slice(0, maxVisible),
      tagsPreviewOverflow: Math.max(0, tags.length - maxVisible),
    };
  }, [tags, windowWidth]);

  if (isLoading) return <LoadingState message="Loading profile..." />;
  if (isError) return <LoadingState message="Failed to load profile" />;

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.titleActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/profile/settings")}
            >
              <Ionicons
                name="settings-outline"
                size={wp(6)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/profile/edit")}
            >
              <Ionicons
                name="pencil"
                size={wp(6)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileHeaderRow}>
          <View style={styles.imageContainer}>
            {data.profile_picture ? (
              <Image
                source={{ uri: data.profile_picture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: avatarColors.bg }]}>
                <Text style={[styles.placeholderText, { color: avatarColors.fg }]}>
                  {initials}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.nameContainer}>
            <View>
              <Text style={styles.nameValue}>
                {data.first_name && data.last_name
                  ? `${data.first_name} ${data.last_name}`
                  : data.first_name || data.last_name || "-"}
              </Text>
            </View>

            <View style={styles.statsSection}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {isConnectionsLoading ? "..." : connectionsCount}
                </Text>
                <Text style={styles.statLabel}>Connections</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {isInteractionsLoading ? "..." : totalInteractionsCount}
                </Text>
                <Text style={styles.statLabel}>Interactions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {isDashboardLoading ? "..." : allEventsCount}
                </Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.organizeSection}>
          <TouchableOpacity
            style={styles.tagsSectionHeader}
            onPress={() => router.push("/profile/tags")}
            accessibilityRole="button"
            accessibilityLabel="Open tags"
          >
            <Text style={styles.subSectionTitle}>Tags</Text>
            <Ionicons name="chevron-forward" size={wp(5)} color={theme.colors.textLight} />
          </TouchableOpacity>

          {isTagsLoading ? (
            <Text style={styles.tagsPreviewHint}>Loading tags…</Text>
          ) : tags.length === 0 ? (
            <Text style={styles.tagsPreviewHint}>No tags yet. Tap to create some.</Text>
          ) : (
            <>
              <View
                style={[
                  styles.tagsPreviewGrid,
                  { maxHeight: (wp(8) + wp(2)) * TAG_PREVIEW_ROWS },
                ]}
              >
                {tagsPreview.map((tag) => (
                  <Pressable
                    key={tag.id}
                    onPress={() => router.push(`/profile/tags/${tag.id}`)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: "transparent",
                        borderColor: tag.color || theme.colors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.tagChipText} numberOfLines={1}>
                      {` ${tag.name} `}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tagsPreviewOverflow > 0 ? (
                <TouchableOpacity onPress={() => router.push("/profile/tags")} style={styles.tagsMoreRow}>
                  <Text style={styles.tagsMoreText}>+{tagsPreviewOverflow} more</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.subSectionTitle}>Contact Info</Text>
          <FlatList
            data={contactInfoItems}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.contactList}
            renderItem={({ item }) => (
              <View style={styles.flatInfoRow}>
                {item.isContactEmail ? (
                  <View style={styles.contactEmailHeaderRow}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Pressable onPress={() => setShowContactEmailInfo(true)} style={styles.infoIconButton}>
                      <Ionicons name="information-circle-outline" size={wp(3.5)} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.label}>{item.label}</Text>
                )}
                <Text style={styles.flatValue}>{item.value}</Text>
              </View>
            )}
          />

          <View style={styles.flatInfoRow}>
            <Text style={styles.subSectionTitle}>Location</Text>
            <Text style={styles.flatValue}>{data.location || "-"}</Text>
          </View>
        </View>

        {/* Map / Location card */}
        <View style={styles.mapContainer}>
          {data.location && region ? (
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
                {data.location ? "Finding your location..." : "No location added"}
              </Text>
              <Text style={styles.mapFallbackSubtitle}>
                {data.location
                  ? data.location
                  : "Add your city in Edit Profile to see it here."}
              </Text>
            </View>
          )}
        </View>

        {/* Extra bottom padding lets user scroll enough to center the map */}
        <View style={{ height: wp(10) }} />
      </ScrollView>

      <Modal
        visible={showContactEmailInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactEmailInfo(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowContactEmailInfo(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Contact Email</Text>
            <Text style={styles.modalBody}>
              This email is visible to your connections, by default it is your login email. Changing this does not affect login information.
            </Text>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowContactEmailInfo(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  title: {
    fontSize: wp(9),
    fontWeight: '600',
    color: theme.colors.text,
  },
  titleActions: {
    flexDirection: 'row',
    gap: wp(0),
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
    marginBottom: wp(2),
    flexDirection: "row",
    alignItems: "center",
    gap: wp(3),
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: wp(5),
    marginBottom: wp(3),
  },
  imageContainer: {
    width: wp(30),
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: wp(12),
    fontWeight: "700",
  },
  nameContainer: {
    flex: 1,
    justifyContent: "space-between",
    gap: wp(2),
    left: wp(2),
    top: wp(0.5),
  },
  nameValue: {
    fontSize: wp(6),
    color: theme.colors.text,
    fontWeight: "700",
  },
  organizeSection: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(4),
    paddingHorizontal: wp(4),
    gap: wp(2),
    marginHorizontal: wp(5),
    marginBottom: wp(3),
  },
  tagsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: wp(0.5),
    gap: wp(2),
  },
  tagsPreviewHint: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginTop: wp(1),
  },
  tagsPreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp(2),
    marginTop: wp(2),
    overflow: "hidden",
  },
  tagChip: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    borderWidth: 1,
    minHeight: wp(8),
    justifyContent: "center",
    maxWidth: "100%",
  },
  tagChipText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  tagsMoreRow: {
    marginTop: wp(2),
    alignSelf: "flex-start",
  },
  tagsMoreText: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: theme.colors.primary,
  },
  infoSection: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(4),
    gap: wp(4),
    marginHorizontal: wp(5),
  },
  contactList: {
    gap: 0,
  },
  subSectionTitle: {
    fontSize: wp(4.6),
    color: theme.colors.text,
    fontWeight: "600",
  },
  subSectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  statsSection: {
    flexDirection: "row",
    gap: wp(2),
    left: -wp(1.5),
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(2),
    paddingHorizontal: wp(1.5),
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: wp(0.5),
  },
  statValue: {
    fontSize: wp(4.5),
    left: wp(0.5),
    fontWeight: "700",
    color: theme.colors.textSecondary,
  },
  statLabel: {
    fontSize: wp(2.3),
    color: theme.colors.textSecondary,
    fontWeight: "500",
    textAlign: "left",
    left: wp(0.5),
  },
  infoRow: {
    flexDirection: "column",
    gap: wp(1),
  },
  flatInfoRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: wp(0.6),
    paddingVertical: wp(1.4),
  },
  label: {
    fontSize: wp(3),
    lineHeight: wp(3.4),
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  flatValue: {
    fontSize: wp(2.8),
    lineHeight: wp(3.4),
    color: theme.colors.text,
    fontWeight: "500",
    textAlign: "left",
    flexShrink: 1,
    maxWidth: "100%",
  },
  contactEmailHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: wp(1.5),
  },
  infoIconButton: {
    paddingVertical: 0,
    paddingHorizontal: wp(0.5),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: wp(6),
  },
  modalCard: {
    backgroundColor: theme.colors.background,
    borderRadius: wp(4),
    padding: wp(5),
    gap: wp(3),
  },
  modalTitle: {
    fontSize: wp(5),
    fontWeight: "700",
    color: theme.colors.text,
  },
  modalBody: {
    fontSize: wp(3.8),
    lineHeight: wp(5.5),
    color: theme.colors.textSecondary,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    paddingVertical: wp(1),
    paddingHorizontal: wp(2),
  },
  modalCloseText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
  mapContainer: {
    marginTop: wp(1),
    marginHorizontal: wp(5),
    borderRadius: wp(3),
    overflow: "hidden",
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: wp(6),
  },
  mapFallbackIcon: {
    marginBottom: wp(2),
  },
  mapFallbackTitle: {
    fontSize: wp(4.3),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(1),
    textAlign: "center",
  },
  mapFallbackSubtitle: {
    fontSize: wp(3.6),
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: wp(5),
  },
  locationText: {
    paddingVertical: wp(3),
    color: theme.colors.text,
    fontWeight: "500",
    marginHorizontal: wp(5),
  },
});

export default ProfileScreen;