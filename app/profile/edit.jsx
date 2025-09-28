import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import MonthDayYearPicker from '../../components/MonthDayYearPicker';
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { formatDateLocal, parseDateLocal, wp } from "../../helpers/common";
import useProfile, { useUpdateProfileMutation } from "../../helpers/useProfile";

const EditProfileScreen = () => {
  const router = useRouter();
  const { data, isLoading, isError } = useProfile();
  const updateMutation = useUpdateProfileMutation();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birthday: null,
    profile_picture: null,
  });

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        birthday: data.birthday || null,
        profile_picture: data.profile_picture || null,
      });
    }
  }, [data]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        handleChange("profile_picture", result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(form);
      Alert.alert("Success", "Profile updated successfully");
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <LoadingState message="Failed to load profile" />;

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>

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
        <View style={styles.section}>
          <MonthDayYearPicker
            label="Birthday"
            date={form.birthday ? parseDateLocal(form.birthday) : new Date()}
            onChange={(d)=>setForm(prev=>({...prev,birthday:formatDateLocal(d)}))}
          />
        </View>

        <View style={styles.buttonContainer}>
          <CustomButton
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.button}
          />
          <CustomButton
            title={updateMutation.isLoading ? "Saving..." : "Save"}
            onPress={handleSave}
            disabled={updateMutation.isLoading}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: wp(5),
  },
  title: {
    fontSize: wp(6),
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: wp(5),
    textAlign: "center",
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
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "white",
    fontSize: wp(12),
    fontWeight: "bold",
  },
  changePhotoText: {
    marginTop: wp(2),
    color: theme.colors.primary,
    fontSize: wp(3.5),
  },
  section: {
    marginBottom: wp(4),
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: wp(4),
  },
  button: {
    flex: 1,
  },
});

export default EditProfileScreen;
