import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { formatDateForDisplay, wp } from "../../helpers/common";
import useProfile from "../../helpers/useProfile";

const ProfileScreen = () => {
  const router = useRouter();
  const { data, isLoading, isError } = useProfile();

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
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: wp(5),
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
    padding: wp(4),
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
});

export default ProfileScreen;