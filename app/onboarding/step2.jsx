import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import CustomButton from "../../components/CustomButton";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";

const OnboardingStep2 = () => {
  const { isLoading, withLoading } = useLoading();
  const params = useLocalSearchParams();
  const [profilePicture, setProfilePicture] = useState(null);

  const handleImagePick = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow photo library access to continue.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleContinue = () => {
    withLoading(async () => {
      try {
        router.push({
          pathname: "/onboarding/step3",
          params: {
            ...params,
            profile_picture: profilePicture || "",
          },
        });
      } catch (err) {
        Alert.alert("Error", "Failed to proceed to next step");
      }
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: "/onboarding/step3",
      params,
    });
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Add a Profile Picture</Text>
            <Text style={styles.description}>
              Help your contacts recognize you with a profile picture. You can always change this later.
            </Text>

            <Pressable onPress={handleImagePick} style={styles.imageContainer}>
              {profilePicture ? (
                <Image
                  source={{ uri: profilePicture }}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={styles.placeholderText}>Tap to upload</Text>
                </View>
              )}
            </Pressable>

            {profilePicture && (
              <Pressable onPress={handleImagePick}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.bottomContainer}>
            <CustomButton
              title="Continue"
              onPress={handleContinue}
              style={styles.button}
            />
            <CustomButton
              title="Skip for now"
              onPress={handleSkip}
              style={styles.skipButton}
              textStyle={styles.skipButtonText}
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
    alignItems: "center",
    justifyContent: "center",
    padding: wp(5),
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
    marginBottom: wp(8),
    textAlign: "center",
    lineHeight: wp(6),
    paddingHorizontal: wp(5),
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: wp(3),
  },
  profileImage: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(20),
  },
  placeholderImage: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(20),
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  placeholderIcon: {
    fontSize: wp(12),
    marginBottom: wp(2),
  },
  placeholderText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  changePhotoText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
  bottomContainer: {
    padding: wp(5),
    gap: wp(3),
  },
  button: {
    width: "100%",
  },
  skipButton: {
    backgroundColor: "transparent",
  },
  skipButtonText: {
    color: theme.colors.textLight,
  },
});

export default OnboardingStep2;

