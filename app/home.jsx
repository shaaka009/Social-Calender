import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoadingState from "../components/LoadingState";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";
import useLoading from "../helpers/useLoading";

const Home = () => {
  const { isLoading, withLoading } = useLoading();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fetch user data when component mounts
    withLoading(async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/user/", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        console.error("Error fetching user data:", err);
        // If we can't get user data, redirect to welcome
        router.replace("/welcome");
      }
    });
  }, []);

  const handleLogout = () => {
    withLoading(async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/signout/", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Logout failed");
        }

        router.replace("/welcome");
      } catch (err) {
        console.error("Logout error:", err);
        // Still redirect to welcome page even if logout fails
        router.replace("/welcome");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Calendar</Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {user ? (
              <Text style={styles.welcomeText}>
                Welcome {user.first_name} {user.last_name}!
              </Text>
            ) : (
              <Text style={styles.welcomeText}>Loading...</Text>
            )}
            <Text style={styles.subText}>
              Your calendar is under construction.
            </Text>
          </View>
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: wp(5),
  },
  title: {
    fontSize: wp(6),
    fontWeight: "bold",
    color: theme.colors.text,
  },
  logoutButton: {
    padding: wp(2),
  },
  logoutText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: wp(2),
  },
  welcomeText: {
    fontSize: wp(5),
    fontWeight: "600",
    color: theme.colors.text,
    textAlign: "center",
  },
  subText: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: "center",
  },
});

export default Home;
