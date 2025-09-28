import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birthday: null,
    profile_picture: null,
  });

  // Contact rows table
  const [contactRows, setContactRows] = useState([
    { type: "Phone", value: "" },
    { type: "Email", value: "" },
  ]);

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        birthday: data.birthday || null,
        profile_picture: data.profile_picture || null,
      });

      setContactRows([
        { type: "Phone", value: data.phone || "" },
        { type: "Email", value: data.email || "" },
        ...(Array.isArray(data.extra_contacts) ? data.extra_contacts : []),
      ]);
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
    // build payload from form and contactRows
    const payload = { ...form };
    contactRows.forEach(({ type, value }) => {
      const key = type.trim().toLowerCase();
      if (!value.trim()) return;
      if (key === "phone") payload.phone = value.trim();
      else if (key === "email") payload.email = value.trim();
      else {
        if (!payload.extra_contacts) payload.extra_contacts = [];
        payload.extra_contacts.push({ type: type.trim(), value: value.trim() });
      }
    });

    // If profile_picture is null or just an existing remote URL, omit it so backend isn't sent a plain string
    if (!form.profile_picture || (typeof form.profile_picture === 'string' && !form.profile_picture.startsWith('file://'))) {
      delete payload.profile_picture;
    }

    try {
      await updateMutation.mutateAsync(payload);
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable style={styles.saveButtonHeader} onPress={handleSave} disabled={updateMutation.isLoading}>
          <Text style={styles.saveButtonHeaderText}>{updateMutation.isLoading ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>

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

        {/* Name Row */}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: wp(2) }}>
            <CustomInput
              label="First Name"
              value={form.first_name}
              onChangeText={(v)=>handleChange("first_name", v)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CustomInput
              label="Last Name"
              value={form.last_name}
              onChangeText={(v)=>handleChange("last_name", v)}
            />
          </View>
        </View>

        {/* Contact Information */}
        <Text style={styles.sectionLabel}>Contact Information</Text>
        {contactRows.map((row, idx) => (
          <View key={idx} style={styles.contactRow}>
            <TextInput
              style={[styles.contactTypeInput, idx < 2 && styles.readOnlyInput]}
              value={row.type}
              onChangeText={(text) =>
                setContactRows((prev) => prev.map((r, i) => (i === idx ? { ...r, type: text } : r)))
              }
              editable={idx >= 2}
              placeholder="Type"
              placeholderTextColor={theme.colors.textLight + "90"}
            />
            <TextInput
              style={styles.contactValueInput}
              value={row.value}
              onChangeText={(text) =>
                setContactRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: text } : r)))
              }
              placeholder="Enter info"
              keyboardType={
                row.type.toLowerCase() === "phone"
                  ? "phone-pad"
                  : row.type.toLowerCase() === "email"
                  ? "email-address"
                  : "default"
              }
              placeholderTextColor={theme.colors.textLight + "90"}
            />
          </View>
        ))}

        <Pressable
          style={styles.addContactBtn}
          onPress={() => setContactRows((prev) => [...prev, { type: "", value: "" }])}
        >
          <Text style={styles.addContactBtnText}>＋ Add another contact method</Text>
        </Pressable>

        <View style={styles.section}>
          <MonthDayYearPicker
            label="Birthday"
            date={form.birthday ? parseDateLocal(form.birthday) : new Date()}
            onChange={(d)=>setForm(prev=>({...prev,birthday:formatDateLocal(d)}))}
          />
        </View>

        <View style={{ height: wp(20) }} />

      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(5),
    paddingVertical: wp(3),
  },
  headerTitle: {
    fontSize: wp(4.5),
    fontWeight: "600",
    color: theme.colors.text,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: wp(15),
  },
  backButtonText: {
    fontSize: wp(7),
    color: theme.colors.primary,
    marginRight: wp(1),
    marginTop: -wp(1),
  },
  backButtonLabel: {
    fontSize: wp(4),
    color: theme.colors.primary,
  },
  saveButtonHeader: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1),
  },
  saveButtonHeaderText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
  container: {
    flexGrow: 1,
    padding: wp(5),
    gap: wp(4),
    backgroundColor: theme.colors.background,
    paddingBottom: wp(60),
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
  rowInputs: {
    flexDirection: "row",
    gap: wp(2),
    marginBottom: wp(2),
  },
  sectionLabel: {
    fontSize: wp(4),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  contactRow: {
    flexDirection: "row",
    gap: wp(2),
    marginBottom: wp(2),
  },
  contactTypeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    padding: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  contactValueInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    padding: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  readOnlyInput: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  addContactBtn: {
    alignSelf: "center",
    marginTop: wp(2),
    paddingVertical: wp(2),
    paddingHorizontal: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addContactBtnText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "500",
  },
});

// Hide default header for Expo Router (v2) by exporting options at module level
export const options = {
  headerShown: false,
};

export default EditProfileScreen;
