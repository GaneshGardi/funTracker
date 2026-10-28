import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { supabase } from "../../lib/supabase";

type GroupInfo = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

type Member = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

type SearchUser = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type DailyProgress = {
  user_id: string;
  username: string;
  display_name: string | null;
  calories_consumed: number | string;
  daily_calorie_goal: number | string | null;
};

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const groupId = Array.isArray(id) ? id[0] : id;

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progressError, setProgressError] = useState("");

  const [inviteVisible, setInviteVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchError, setSearchError] = useState("");

  const loadGroup = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("id, name, created_by, created_at")
        .eq("id", groupId)
        .single();

      if (groupError) throw groupError;

      setGroup(groupData);

      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });

      if (memberError) throw memberError;

      const memberList = (memberData ?? []) as Member[];
      setMembers(memberList);

      // Use the device's local calendar date, not UTC.
      const now = new Date();

      const localDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      try {
        const { data: progressData, error: progressFetchError } =
          await supabase.rpc("get_group_daily_progress", {
            p_group_id: groupId,
            p_log_date: localDate,
          });

        if (progressFetchError) throw progressFetchError;

        setDailyProgress((progressData ?? []) as DailyProgress[]);
        setProgressError("");
      } catch (error) {
        console.error("Error loading group calorie progress:", error);

        setDailyProgress([]);
        setProgressError(
          "Could not load calorie progress. Pull down to retry.",
        );
      }

      const userIds = [
        ...new Set(memberList.map((member) => member.user_id)),
      ];

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", userIds);

        if (profileError) throw profileError;

        const profileMap: Record<string, Profile> = {};

        (profileData ?? []).forEach((profile) => {
          profileMap[profile.id] = profile as Profile;
        });

        setProfiles(profileMap);
      } else {
        setProfiles({});
      }
    } catch (error) {
      console.error("Error loading group details:", error);

      Alert.alert(
        "Unable to load group",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadGroup();
    }, [loadGroup]),
  );

  const refresh = () => {
    setRefreshing(true);
    void loadGroup();
  };

  // Search while typing, with a short delay to avoid querying
  // on every keystroke.
  useEffect(() => {
    const searchTerm = username.trim();

    setSearchError("");
    setSearchResults([]);

    if (searchTerm.length < 2 || !inviteVisible) {
      setSearching(false);
      return;
    }

    let cancelled = false;

    setSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc(
          "search_users_for_invites",
          {
            p_search: searchTerm,
          },
        );

        if (error) throw error;

        if (!cancelled) {
          setSearchResults((data ?? []) as SearchUser[]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Username search failed:", error);

          setSearchError(
            "Search is temporarily unavailable. You can still enter a username directly.",
          );
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [username, inviteVisible]);

  const closeInviteModal = () => {
    if (sending) return;

    setInviteVisible(false);
    setUsername("");
    setSearchResults([]);
    setSearchError("");
  };

  const sendInvitation = async () => {
    const targetUsername = username.trim().replace(/^@/, "");

    if (!targetUsername) {
      Alert.alert(
        "Username required",
        "Enter the username of the person you want to invite.",
      );
      return;
    }

    if (!groupId) {
      Alert.alert(
        "Group unavailable",
        "Reopen the group and try again.",
      );
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.rpc("send_group_invitation", {
        p_group_id: groupId,
        p_username: targetUsername,
      });

      if (error) throw error;

      setInviteVisible(false);
      setUsername("");
      setSearchResults([]);
      setSearchError("");

      Alert.alert(
        "Invitation sent!",
        `Your invitation to @${targetUsername} has been sent.`,
      );
    } catch (error) {
      console.error("Error sending invitation:", error);

      const message =
        error instanceof Error ? error.message : "Please try again.";

      Alert.alert("Could not send invitation", message);
    } finally {
      setSending(false);
    }
  };

  // Open the selected member's individual weekly history screen.
  const openMemberHistory = (memberId: string) => {
    if (!groupId || !memberId) return;

    router.push({
      pathname: "/group/[id]/history/[memberId]",
      params: {
        id: groupId,
        memberId,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: group?.name ?? "Group details" }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#729580" />
          <Text style={styles.muted}>Loading group...</Text>
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <Text style={styles.heading}>Group not found</Text>

          <Text style={styles.muted}>
            You may not have access to this group.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.groupIcon}>
              <Text style={styles.groupIconText}>
                {group.name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.groupName}>{group.name}</Text>

            <Text style={styles.muted}>
              {members.length}{" "}
              {members.length === 1 ? "member" : "members"}
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.count}>{members.length}</Text>
          </View>

          {!!progressError && (
            <Text style={styles.progressError}>
              {progressError}
            </Text>
          )}

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.muted}>
                No members found yet.
              </Text>
            </View>
          ) : (
            members.map((member) => {
              const profile = profiles[member.user_id];

              const progress = dailyProgress.find(
                (item) => item.user_id === member.user_id,
              );

              const memberUsername =
                progress?.username || profile?.username || "";

              const displayName =
                progress?.display_name?.trim() ||
                profile?.display_name?.trim() ||
                memberUsername ||
                "Member";

              const consumed =
                Number(progress?.calories_consumed) || 0;

              const goal =
                progress?.daily_calorie_goal == null
                  ? null
                  : Number(progress.daily_calorie_goal);

              const percentage =
                goal !== null && goal > 0
                  ? Math.round((consumed / goal) * 100)
                  : null;

              return (
                <Pressable
                  key={member.user_id}
                  style={({ pressed }) => [
                    styles.memberCard,
                    pressed && styles.memberCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `View weekly history for ${displayName}`
                  }
                  onPress={() =>
                    openMemberHistory(member.user_id)
                  }
                >
                  <View style={styles.memberTopRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {displayName}
                      </Text>

                      <Text style={styles.usernameLabel}>
                        {memberUsername
                          ? `@${memberUsername}`
                          : "Username unavailable"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.roleBadge,
                        member.role === "owner" &&
                          styles.ownerBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          member.role === "owner" &&
                            styles.ownerText,
                        ]}
                      >
                        {member.role === "owner"
                          ? "Owner"
                          : "Member"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.memberProgress}>
                    <View style={styles.calorieNumbers}>
                      <Text style={styles.caloriesConsumed}>
                        {Math.round(consumed).toLocaleString()}
                      </Text>

                      <Text style={styles.calorieGoal}>
                        {goal !== null && goal > 0
                          ? `/ ${Math.round(goal).toLocaleString()} kcal`
                          : "kcal · Goal not set"}
                      </Text>

                      {percentage !== null && (
                        <Text style={styles.progressPercentage}>
                          {percentage}%
                        </Text>
                      )}
                    </View>

                    {goal !== null && goal > 0 && (
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                percentage ?? 0,
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}

                    {percentage !== null && percentage >= 100 && (
                      <Text style={styles.goalReached}>
                        Daily goal reached
                      </Text>
                    )}
                  </View>

                  <Text style={styles.historyHint}>
                    Tap to view weekly history ›
                  </Text>
                </Pressable>
              );
            })
          )}

          <Pressable
            style={styles.button}
            onPress={() => setInviteVisible(true)}
          >
            <Text style={styles.buttonText}>
              + Invite friends
            </Text>
          </Pressable>

          <Text style={styles.footer}>
            Only daily calorie progress is shared. Individual food
            logs remain private.
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={inviteVisible}
        transparent
        animationType="slide"
        onRequestClose={closeInviteModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeInviteModal}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Invite a friend
            </Text>

            <Text style={styles.modalDescription}>
              Search by username or display name, or enter an exact
              username.
            </Text>

            <Text style={styles.inputLabel}>USERNAME</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. fitness_friend"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => void sendInvitation()}
              editable={!sending}
              autoFocus
            />

            {searching && (
              <View style={styles.searchStatus}>
                <ActivityIndicator
                  size="small"
                  color="#729580"
                />
                <Text style={styles.searchStatusText}>
                  Searching users...
                </Text>
              </View>
            )}

            {!!searchError && (
              <Text style={styles.errorText}>
                {searchError}
              </Text>
            )}

            {username.trim().length >= 2 &&
              !searching &&
              !searchError &&
              searchResults.length === 0 && (
                <Text style={styles.searchStatusText}>
                  No matches. You can still invite by exact username.
                </Text>
              )}

            {searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>
                  Matching users
                </Text>

                {searchResults.map((user) => {
                  const displayName =
                    user.display_name?.trim() || user.username;

                  return (
                    <Pressable
                      key={user.user_id}
                      style={styles.resultRow}
                      onPress={() => setUsername(user.username)}
                      disabled={sending}
                    >
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>
                          {displayName}
                        </Text>

                        <Text style={styles.usernameLabel}>
                          @{user.username}
                        </Text>
                      </View>

                      <Text style={styles.selectLabel}>
                        Select
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              style={[
                styles.button,
                sending && styles.disabledButton,
              ]}
              onPress={() => void sendInvitation()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  Send invitation
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={closeInviteModal}
              disabled={sending}
            >
              <Text style={styles.cancelButtonText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8F6",
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  hero: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#E9EDE9",
  },
  groupIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EAF0EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  groupIconText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#557361",
  },
  groupName: {
    fontSize: 23,
    fontWeight: "700",
    color: "#202923",
    textAlign: "center",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#202923",
  },
  muted: {
    color: "#849087",
    fontSize: 14,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#202923",
  },
  count: {
    overflow: "hidden",
    backgroundColor: "#EAF0EB",
    color: "#557361",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: "600",
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E9EDE9",
  },
  memberCardPressed: {
    opacity: 0.78,
    borderColor: "#729580",
  },
  historyHint: {
    color: "#557361",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    textAlign: "right",
  },
  memberTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF0EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#557361",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#202923",
  },
  usernameLabel: {
    fontSize: 13,
    color: "#879189",
    marginTop: 3,
  },
  roleBadge: {
    backgroundColor: "#F1F3F0",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ownerBadge: {
    backgroundColor: "#EAF0EB",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#68756C",
  },
  ownerText: {
    color: "#557361",
  },
  memberProgress: {
    marginTop: 15,
  },
  calorieNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  caloriesConsumed: {
    color: "#202923",
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  calorieGoal: {
    color: "#879189",
    fontSize: 13,
  },
  progressPercentage: {
    color: "#557361",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: "auto",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#EDF1ED",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#729580",
    borderRadius: 6,
  },
  goalReached: {
    color: "#557361",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  progressError: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 22,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#557361",
    padding: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 22,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "#879189",
    marginTop: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 22,
  },
  modalTitle: {
    color: "#202923",
    fontSize: 24,
    fontWeight: "800",
  },
  modalDescription: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  inputLabel: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    height: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  searchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  searchStatusText: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    marginTop: 10,
  },
  resultsContainer: {
    marginTop: 18,
  },
  resultsTitle: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAF0EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  resultAvatarText: {
    color: "#557361",
    fontWeight: "700",
    fontSize: 15,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: "#202923",
    fontSize: 14,
    fontWeight: "600",
  },
  selectLabel: {
    color: "#557361",
    fontSize: 12,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
});