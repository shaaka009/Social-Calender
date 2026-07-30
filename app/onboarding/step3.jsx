import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CustomButton from "../../components/CustomButton";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { ENDPOINTS, apiFetch } from "../../helpers/api";
import { wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";
import { useOneShot } from "../../helpers/useSubmitGuard";

const OnboardingStep3 = () => {
  const { isLoading, withLoading } = useLoading();
  const goOnce = useOneShot();
  const params = useLocalSearchParams();
  const profilePicture = Array.isArray(params.profile_picture)
    ? params.profile_picture[0]
    : params.profile_picture;
  const birthday = Array.isArray(params.birthday) ? params.birthday[0] : params.birthday;
  const phone = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const location = Array.isArray(params.location) ? params.location[0] : params.location;
  const organization = Array.isArray(params.organization) ? params.organization[0] : params.organization;

  const saveOnboardingData = async () => {
    try {
      // Check if we have a profile picture to upload
      const hasProfilePicture = typeof profilePicture === "string" && profilePicture.startsWith("file://");
      
      let body;
      let headers = {};

      if (hasProfilePicture) {
        // Use FormData for file upload
        const formData = new FormData();
        
        if (birthday) formData.append("birthday", birthday);
        if (phone) formData.append("phone", phone);
        if (location) formData.append("location", location);
        if (organization) formData.append("organization", organization);
        
        // Handle extra contacts
        if (params.extra_contacts) {
          try {
            const rawExtra = Array.isArray(params.extra_contacts)
              ? params.extra_contacts[0]
              : params.extra_contacts;
            const extraContacts = JSON.parse(rawExtra);
            if (extraContacts.length > 0) {
              formData.append("extra_contacts", JSON.stringify(extraContacts));
            }
          } catch (e) {
            console.error("Failed to parse extra_contacts", e);
          }
        }

        // Handle profile picture
        const uriParts = profilePicture.split(".");
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append("profile_picture", {
          uri: profilePicture,
          name: `profile.${fileType}`,
          type: `image/${fileType}`,
        });

        body = formData;
      } else {
        // Use JSON for text-only updates
        const jsonData = {};
        
        if (birthday) jsonData.birthday = birthday;
        if (phone) jsonData.phone = phone;
        if (location) jsonData.location = location;
        if (organization) jsonData.organization = organization;
        
        // Handle extra contacts
        if (params.extra_contacts) {
          try {
            const rawExtra = Array.isArray(params.extra_contacts)
              ? params.extra_contacts[0]
              : params.extra_contacts;
            const extraContacts = JSON.parse(rawExtra);
            if (extraContacts.length > 0) {
              jsonData.extra_contacts = extraContacts;
            }
          } catch (e) {
            console.error("Failed to parse extra_contacts", e);
          }
        }

        body = JSON.stringify(jsonData);
        headers["Content-Type"] = "application/json";
      }

      await apiFetch(ENDPOINTS.PROFILE, {
        method: "PATCH",
        headers,
        body,
      });

      return true;
    } catch (error) {
      console.error("Error saving onboarding data:", error);
      return false;
    }
  };

  const handleGetStarted = () => {
    withLoading(async () => {
      const saved = await saveOnboardingData();
      if (saved) {
        // Redirect to main app
        goOnce(() => router.replace("/(tabs)"));
      } else {
        Alert.alert(
          "Error",
          "Failed to save your profile. You can complete it later from settings.",
          [
            {
              text: "Continue Anyway",
              onPress: () => goOnce(() => router.replace("/(tabs)")),
            },
          ]
        );
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Image
              source={require("../../assets/images/logo.svg")}
              style={styles.logo}
              contentFit="contain"
            />
            
            <Text style={styles.title}>You&apos;re All Set!</Text>
            <Text style={styles.description}>
              Welcome to your social calendar. Here&apos;s what you can do:
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="calendar-outline" size={wp(8)} color={theme.colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Track Events</Text>
                  <Text style={styles.featureDescription}>
                    Never miss birthdays, meetings, or important dates
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="people-outline" size={wp(8)} color={theme.colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Manage Contacts</Text>
                  <Text style={styles.featureDescription}>
                    Keep track of your connections and stay in touch
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="notifications-outline" size={wp(8)} color={theme.colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Get Reminders</Text>
                  <Text style={styles.featureDescription}>
                    Receive notifications when you haven&apos;t contacted someone in a while
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="stats-chart-outline" size={wp(8)} color={theme.colors.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Stay Organized</Text>
                  <Text style={styles.featureDescription}>
                    Use tags and notes to organize your social life
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <CustomButton
              title="Get Started"
              onPress={handleGetStarted}
              style={styles.button}
              disabled={isLoading}
            />
          </View>
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: wp(5),
    paddingTop: wp(8),
  },
  logo: {
    width: wp(30),
    height: wp(20),
    alignSelf: "center",
    marginBottom: wp(4),
  },
  title: {
    fontSize: wp(7),
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: wp(2),
    textAlign: "center",
  },
  description: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    marginBottom: wp(6),
    textAlign: "center",
    lineHeight: wp(6),
  },
  featureList: {
    gap: wp(4),
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: wp(3),
  },
  featureIconContainer: {
    width: wp(10),
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: wp(4.5),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  featureDescription: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    lineHeight: wp(5),
  },
  bottomContainer: {
    padding: wp(5),
    bottom: wp(8),
  },
  button: {
    width: "100%",
  },
});

export default OnboardingStep3;

