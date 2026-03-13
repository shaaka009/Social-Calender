import { router } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import MonthDayYearPicker from "../../components/MonthDayYearPicker";
import ProgressIndicator from "../../components/ProgressIndicator";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { formatDateLocal, parseDateLocal, wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";

const OnboardingStep1 = () => {
  const { isLoading, withLoading } = useLoading();
  const [form, setForm] = useState({
    birthday: null,
    phone: "",
    location: "",
    organization: "",
  });

  // Contact rows for additional contact methods
  const [contactRows, setContactRows] = useState([]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleContinue = () => {
    // Store form data in a way we can access in step2
    // We'll save all onboarding data at the end of step3
    withLoading(async () => {
      try {
        // Store in route params
        router.push({
          pathname: "/onboarding/step2",
          params: {
            ...form,
            birthday: form.birthday || "",
            extra_contacts: JSON.stringify(contactRows.filter(r => r.type && r.value)),
          },
        });
      } catch (err) {
        Alert.alert("Error", "Failed to proceed to next step");
      }
    });
  };

  const handleSkip = () => {
    router.push("/onboarding/step2");
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <ProgressIndicator totalSteps={3} currentStep={1} />

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.description}>
              Help us personalize your experience. You can skip this and complete it later.
            </Text>

            <View style={styles.form}>
              <MonthDayYearPicker
                label="Birthday (Optional)"
                date={form.birthday ? parseDateLocal(form.birthday) : new Date()}
                onChange={(d) =>
                  setForm((prev) => ({ ...prev, birthday: formatDateLocal(d) }))
                }
              />

              <CustomInput
                label="Phone (Optional)"
                placeholder="Phone number"
                value={form.phone}
                onChangeText={(v) => handleChange("phone", v)}
                keyboardType="phone-pad"
              />

              <CustomInput
                label="Location (Optional)"
                placeholder="City, Country"
                value={form.location}
                onChangeText={(v) => handleChange("location", v)}
              />

              <CustomInput
                label="Organization (Optional)"
                placeholder="Company or school name"
                value={form.organization}
                onChangeText={(v) => handleChange("organization", v)}
              />

              {/* Additional contact methods */}
              {contactRows.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Additional Contacts</Text>
                  {contactRows.map((row, idx) => (
                    <View key={idx} style={styles.contactRow}>
                      <TextInput
                        style={styles.contactTypeInput}
                        value={row.type}
                        onChangeText={(text) =>
                          setContactRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, type: text } : r))
                          )
                        }
                        placeholder="Type (e.g., LinkedIn)"
                        placeholderTextColor={theme.colors.textLight + "90"}
                      />
                      <TextInput
                        style={styles.contactValueInput}
                        value={row.value}
                        onChangeText={(text) =>
                          setContactRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, value: text } : r))
                          )
                        }
                        placeholder="URL or handle"
                        placeholderTextColor={theme.colors.textLight + "90"}
                      />
                    </View>
                  ))}
                </>
              )}

              <CustomButton
                title="+ Add Social Media / Website"
                onPress={() => setContactRows((prev) => [...prev, { type: "", value: "" }])}
                style={styles.addButton}
                textStyle={styles.addButtonText}
              />
            </View>
          </ScrollView>

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
    flexGrow: 1,
    padding: wp(5),
    paddingBottom: wp(10),
  },
  title: {
    fontSize: wp(7),
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  description: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    marginBottom: wp(6),
    lineHeight: wp(6),
  },
  form: {
    gap: wp(4),
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: wp(2),
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(3),
    padding: wp(4),
    gap: wp(2),
  },
  contactTypeInput: {
    flex: 1,
    fontSize: wp(4),
    color: theme.colors.text,
    paddingVertical: 0,
  },
  contactValueInput: {
    flex: 2,
    fontSize: wp(4),
    color: theme.colors.text,
    paddingVertical: 0,
  },
  addButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
  },
  addButtonText: {
    color: theme.colors.primary,
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

export default OnboardingStep1;

