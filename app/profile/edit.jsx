import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import MonthDayYearPicker from '../../components/MonthDayYearPicker';
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { getPersonAvatarColors, getPersonInitials } from "../../helpers/avatar";
import { formatDateLocal, parseDateLocal, wp } from "../../helpers/common";
import useProfile, { useUpdateProfileMutation } from "../../helpers/useProfile";
import { useOneShot, useSubmitGuard } from "../../helpers/useSubmitGuard";

const EditProfileScreen = () => {
  const router = useRouter();
  const { data, isLoading, isError } = useProfile();
  const updateMutation = useUpdateProfileMutation();
  const { isSubmitting, run } = useSubmitGuard();
  const goOnce = useOneShot();

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birthday: null,
    profile_picture: null,
    location: "",
    contact_email: "",
  });
  const avatarColors = getPersonAvatarColors({
    id: data?.id,
    email: data?.login_email || data?.email,
    first_name: form.first_name,
    last_name: form.last_name,
  });
  const initials = getPersonInitials({
    first_name: form.first_name,
    last_name: form.last_name,
  });

  // Contact rows table
  const [contactRows, setContactRows] = useState([
    { type: "Phone", value: "" },
  ]);
  const [showContactEmailInfo, setShowContactEmailInfo] = useState(false);
  const allContactRows = React.useMemo(() => (
    [
      {
        key: "contact_email",
        type: "Contact Email",
        value: form.contact_email || "",
        isContactEmail: true,
      },
      ...contactRows.map((row, idx) => ({
        ...row,
        key: `contact_${idx}`,
        contactRowIndex: idx,
      })),
    ]
  ), [form.contact_email, contactRows]);

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        birthday: data.birthday || null,
        profile_picture: data.profile_picture || null,
        location: data.location || "",
        contact_email: data.contact_email || "",
      });

      setContactRows([
        { type: "Phone", value: data.phone || "" },
        ...(Array.isArray(data.extra_contacts) ? data.extra_contacts : []),
      ]);
    }
  }, [data]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImagePick = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow photo library access to choose a profile photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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

  const handleSave = () => run(async () => {
    // build payload from form and contactRows
    const payload = { ...form };
    contactRows.forEach(({ type, value }) => {
      const key = type.trim().toLowerCase();
      if (!value.trim()) return;
      if (key === "phone") payload.phone = value.trim();
      else {
        if (!payload.extra_contacts) payload.extra_contacts = [];
        payload.extra_contacts.push({ type: type.trim(), value: value.trim() });
      }
    });

    const hasLocalImage =
      typeof form.profile_picture === "string" &&
      (form.profile_picture.startsWith("file://") ||
        form.profile_picture.startsWith("content://"));

    let requestPayload = payload;
    if (hasLocalImage) {
      const fd = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "profile_picture") return;
        if (typeof value === "object") {
          fd.append(key, JSON.stringify(value));
        } else {
          fd.append(key, String(value));
        }
      });
      const uri = form.profile_picture;
      const extMatch = /\.([a-zA-Z0-9]+)(\?|$)/.exec(uri);
      const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      fd.append("profile_picture", {
        uri,
        name: `profile.${ext}`,
        type: mime,
      });
      requestPayload = fd;
    } else {
      delete payload.profile_picture;
    }

    try {
      await updateMutation.mutateAsync(requestPayload);
      Alert.alert("Success", "Profile updated successfully");
      goOnce(() => router.back());
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <LoadingState message="Failed to load profile" />;

  return (
    <ScreenWrapper bg={theme.colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goOnce(() => router.back())} disabled={isSubmitting}>
          <Text style={styles.backButtonText}>←</Text>
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          style={[styles.saveButtonHeader, isSubmitting && styles.saveButtonHeaderDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Text style={styles.saveButtonHeaderText}>{isSubmitting ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >

        <Pressable onPress={handleImagePick} style={styles.imageContainer}>
          {form.profile_picture ? (
            <Image
              source={{ uri: form.profile_picture }}
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
        <Text style={styles.sectionTitle}>Contact Information</Text>
        {allContactRows.map((row) => (
          <View key={row.key} style={styles.contactRow}>
            <TextInput
              style={[
                styles.contactTypeInput,
                row.isContactEmail && styles.contactEmailHeaderTextInput,
              ]}
              value={row.type}
              onChangeText={(text) => {
                if (row.isContactEmail) return;
                setContactRows((prev) => prev.map((r, i) => (
                  i === row.contactRowIndex ? { ...r, type: text } : r
                )));
              }}
              editable={!row.isContactEmail}
              placeholder="Type"
              placeholderTextColor={theme.colors.textLight + "90"}
            />
            {row.isContactEmail && (
              <Pressable onPress={() => setShowContactEmailInfo(true)} style={styles.infoIconButton}>
                <Ionicons name="information-circle-outline" size={wp(5)} color={theme.colors.textSecondary} />
              </Pressable>
            )}
            <TextInput
              style={styles.contactValueInput}
              value={row.value}
              onChangeText={(text) => {
                if (row.isContactEmail) {
                  handleChange("contact_email", text);
                  return;
                }
                setContactRows((prev) => prev.map((r, i) => (
                  i === row.contactRowIndex ? { ...r, value: text } : r
                )));
              }}
              placeholder="Enter info"
              keyboardType={
                row.isContactEmail
                  ? "email-address"
                  : row.type.toLowerCase() === "phone"
                  ? "phone-pad"
                  : "default"
              }
              autoCapitalize={row.isContactEmail ? "none" : "sentences"}
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

        <View style={styles.section}>
          <CustomInput
            label="Location (City, Region)"
            value={form.location}
            onChangeText={(v)=>handleChange("location", v)}
          />
        </View>

        <View style={{ height: wp(20) }} />

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
              This is your contact email, not your login email. Changing this will not affect sign-in.
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
  saveButtonHeaderDisabled: {
    opacity: 0.5,
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
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  contactEmailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    flex: 1,
  },
  contactEmailHeaderText: {
    fontSize: wp(3.5),
    fontWeight: "500",
    color: theme.colors.text,
  },
  contactEmailHeaderTextInput: {
    color: theme.colors.text,
  },
  infoIconButton: {
    paddingVertical: wp(0.5),
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
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: wp(2),
  },
  contactTypeInput: {
    flex: 1,
    fontSize: wp(3.5),
    fontWeight: "500",
    color: theme.colors.text,
    paddingVertical: 0,
    textAlign: "left",
  },
  contactValueInput: {
    flex: 2,
    fontSize: wp(3.5),
    color: theme.colors.text,
    paddingVertical: 0,
    textAlign: "right",
  },
  addContactBtn: {
    alignSelf: "center",
    marginTop: wp(2),
    paddingVertical: wp(2),
    paddingHorizontal: wp(4),
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.background,
  },
  addContactBtnText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "500",
  },
});

// Attach header options directly to the component so the module only exports the component (improves fast-refresh)
EditProfileScreen.options = {
  headerShown: false,
};

export default EditProfileScreen;
