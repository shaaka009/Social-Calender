import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { ENDPOINTS, apiFetch } from "../../helpers/api";
import { clearTokens } from "../../helpers/auth";
import { formatDateForDisplay, wp } from "../../helpers/common";
import useProfile from "../../helpers/useProfile";

const ProfileScreen = () => {
  const router = useRouter();
  const { data, isLoading, isError } = useProfile();
  const [region, setRegion] = React.useState(null);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(ENDPOINTS.SIGN_OUT, { method: "POST" }).catch(() => {});
          } finally {
            await clearTokens();
            router.replace("/welcome");
          }
        },
      },
    ]);
  };

  // Geocode the user's location string to coordinates
  React.useEffect(() => {
    (async () => {
      if (data?.location) {
        try {
          const geo = await Location.geocodeAsync(data.location);
          if (geo.length) {
            const { latitude, longitude } = geo[0];
            setRegion({
              latitude,
              longitude,
              latitudeDelta: 1,
              longitudeDelta: 1,
            });
          }
        } catch (e) {
          console.warn("Failed to geocode location", e);
        }
      }
    })();
  }, [data?.location]);

  if (isLoading) return <LoadingState message="Loading profile..." />;
  if (isError) return <LoadingState message="Failed to load profile" />;

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.titleActions}>
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

        <View style={styles.imageContainer}>
          {data.profile_picture ? (
            <Image
              source={{ uri: data.profile_picture }}
              style={styles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>
                {data.first_name?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>
              {data.first_name && data.last_name
                ? `${data.first_name} ${data.last_name}`
                : data.first_name || data.last_name || "-"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{data.email || "-"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{data.phone || "-"}</Text>
          </View>

          {/* Extra contact methods */}
          {data.extra_contacts?.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Other Contacts</Text>
              <View style={{ gap: wp(2) }}>
                {data.extra_contacts.map((c, idx) => (
                  <Text key={idx} style={styles.value}>{c.type}: {c.value}</Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.label}>Birthday</Text>
            <Text style={styles.value}>
              {data.birthday ? formatDateForDisplay(data.birthday) : "-"}
            </Text>
          </View>
          <View style={styles.inforow}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{data.location}</Text>
          </View>
        </View>

        {/* Map showing user's location */}
        {data.location && (
          <View style={styles.mapContainer}>
            {region ? (
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
              <Text style={styles.loadingMap}>Locating {data.location}...</Text>
            )}
          </View>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={wp(5)} color={theme.colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => {
            Alert.alert(
              "Delete Account",
              "This will permanently delete your account and all data. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await apiFetch(ENDPOINTS.DELETE_ACCOUNT, { method: "DELETE" });
                    } catch {
                      // even if server fails, clear local state
                    } finally {
                      await clearTokens();
                      router.replace("/welcome");
                    }
                  },
                },
              ],
            );
          }}
        >
          <Ionicons name="trash-outline" size={wp(5)} color={theme.colors.error} />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* Extra bottom padding lets user scroll enough to center the map */}
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
  imageContainer: {
    alignItems: "center",
    marginBottom: wp(8),
    paddingHorizontal: wp(5),
  },
  profileImage: {
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
  },
  placeholderImage: {
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: wp(12),
    color: theme.colors.text,
    fontWeight: "600",
  },
  infoSection: {
    backgroundColor: theme.colors.card,
    borderRadius: wp(3),
    paddingVertical: wp(4),
    gap: wp(4),
    marginHorizontal: wp(5),
  },
  infoRow: {
    flexDirection: "column",
    gap: wp(1),
  },
  label: {
    fontSize: wp(3.5),
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  value: {
    fontSize: wp(4.5),
    color: theme.colors.text,
    fontWeight: "500",
  },
  mapContainer: {
    marginTop: wp(1),
    marginHorizontal: wp(5),
    borderRadius: wp(3),
    overflow: "hidden",
    height: wp(60),
  },
  map: {
    flex: 1,
  },
  loadingMap: {
    textAlign: "center",
    padding: wp(4),
    color: theme.colors.textSecondary,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(2),
    marginTop: wp(6),
    marginHorizontal: wp(5),
    paddingVertical: wp(4),
    borderRadius: wp(3),
    backgroundColor: theme.colors.card,
  },
  signOutText: {
    fontSize: wp(4),
    fontWeight: "600",
    color: theme.colors.error,
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(2),
    marginTop: wp(3),
    marginHorizontal: wp(5),
    paddingVertical: wp(4),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  deleteAccountText: {
    fontSize: wp(4),
    fontWeight: "600",
    color: theme.colors.error,
  },
  locationText: {
    paddingVertical: wp(3),
    color: theme.colors.text,
    fontWeight: "500",
    marginHorizontal: wp(5),
  },
});

export default ProfileScreen;