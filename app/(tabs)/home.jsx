import { router } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import CalendarPreview from "../../components/home/CalendarPreview";
import HeaderGreeting from "../../components/home/HeaderGreeting";
import NotificationList from "../../components/home/NotificationList";
import QuickActions from "../../components/home/QuickActions";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { wp } from "../../helpers/common";
import useDashboard from "../../helpers/useDashboard";

const Home = () => {
  const { data: dashboard, isLoading, refetch, } = useDashboard();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleNotificationPress = useCallback((notification) => {
    if (notification.type === 'UPCOMING_EVENT') {
      router.push(`/events/${notification.eventId}`);
    } else if (notification.type === 'NO_CONTACT') {
      router.push(`/contacts/${notification.contactId}`);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <HeaderGreeting user={dashboard?.user} />
          <NotificationList
            notifications={dashboard?.notifications || []}
            onNotificationPress={handleNotificationPress}
          />
          <CalendarPreview events={dashboard?.events || []} />
          <QuickActions />
        </ScrollView>
      </ScreenWrapper>
    </LoadingState>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
  },
});

export default Home;
