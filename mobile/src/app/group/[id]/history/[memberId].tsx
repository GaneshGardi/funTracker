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
      <Stack.Screen options={{ title: "Weekly history" }} />

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
    backgroundColor: "#F7F8F6",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
  },
});