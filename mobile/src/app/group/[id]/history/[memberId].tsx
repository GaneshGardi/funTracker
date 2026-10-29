import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import GroupWeeklyHistory from "../../../../components/GroupWeeklyHistory";

export default function GroupMemberHistoryScreen() {
  const params = useLocalSearchParams<{
    id: string | string[];
    memberId: string | string[];
  }>();

  const groupId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const memberId = Array.isArray(params.memberId)
    ? params.memberId[0]
    : params.memberId;

  if (!groupId || !memberId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Unable to open member history.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Weekly history",
          headerStyle: { backgroundColor: "#101010" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "700",
          },
          contentStyle: {
            backgroundColor: "#101010",
          },
        }}
      />

      <GroupWeeklyHistory
        groupId={groupId}
        memberId={memberId}
        refreshToken={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101010",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#101010",
  },
  errorText: {
    color: "#B6F36B",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});