import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { wp } from "../../helpers/common";
import useProfile, { useUpdateProfileMutation } from "../../helpers/useProfile";

const ProfileScreen = () => {
  const { data, isLoading, isError } = useProfile();
  const updateMutation = useUpdateProfileMutation();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birthday: "",
    profile_picture: null,
  });

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        birthday: data.birthday || "",
        profile_picture: data.profile_picture || null,
      });
    }
  }, [data]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to change your profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        // Create FormData for the image
        const formData = new FormData();
        formData.append("profile_picture", {
          uri: imageUri,
          type: "image/jpeg",
          name: "profile.jpg",
        });

        updateMutation.mutate(formData, {
          onSuccess: () => {
            handleChange("profile_picture", imageUri);
            Alert.alert("Success", "Profile picture updated successfully");
          },
          onError: (err) => {
            Alert.alert("Error", err.message || "Failed to update profile picture");
          },
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    Object.keys(form).forEach(key => {
      if (key !== "profile_picture" && form[key]) {
        formData.append(key, form[key]);
      }
    });

    updateMutation.mutate(formData, {
      onSuccess: () => {
        Alert.alert("Success", "Profile updated successfully");
      },
      onError: (err) => {
        Alert.alert("Error", err.message || "Failed to update profile");
      },
    });
  };

  if (isLoading) return <LoadingState message="Loading profile..." />;
  if (isError) return <LoadingState message="Failed to load profile" />;

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Profile</Text>

        <Pressable onPress={handleImagePick} style={styles.imageContainer}>
          {form.profile_picture ? (
            <Image
              source={{ uri: form.profile_picture }}
              style={styles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>
                {form.first_name?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </Pressable>

        <CustomInput
          label="First Name"
          value={form.first_name}
          onChangeText={(v) => handleChange("first_name", v)}
        />
        <CustomInput
          label="Last Name"
          value={form.last_name}
          onChangeText={(v) => handleChange("last_name", v)}
        />
        <CustomInput
          label="Email"
          value={form.email}
          keyboardType="email-address"
          onChangeText={(v) => handleChange("email", v)}
        />
        <CustomInput
          label="Phone"
          value={form.phone}
          keyboardType="phone-pad"
          onChangeText={(v) => handleChange("phone", v)}
        />
        <CustomInput
          label="Birthday (YYYY-MM-DD)"
          value={form.birthday}
          onChangeText={(v) => handleChange("birthday", v)}
        />

        <CustomButton
          title={updateMutation.isLoading ? "Saving..." : "Save"}
          onPress={handleSave}
          disabled={updateMutation.isLoading}
        />
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: wp(5),
    gap: wp(5),
  },
  title: {
    fontSize: wp(6),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: wp(5),
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
  changePhotoText: {
    marginTop: wp(2),
    color: theme.colors.primary,
    fontSize: wp(4),
  },
});

export default ProfileScreen;