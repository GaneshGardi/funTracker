
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

type Invitation = {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_user_id: string;
  inviter_username: string;
  inviter_display_name: string | null;
  invitation_created_at: string;
};

export default function FriendsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const router = useRouter();

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setGroups([]);
        setInvitations([]);
        return;
      }

      const [membershipResult, invitationResult] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id),
        supabase.rpc("get_pending_group_invitations"),
      ]);

      if (membershipResult.error) throw membershipResult.error;
      if (invitationResult.error) throw invitationResult.error;

      const groupIds = (membershipResult.data ?? []).map(
        (membership) => membership.group_id,
      );

      const groupsResult =
        groupIds.length > 0
          ? await supabase
              .from("groups")
              .select("id, name, created_by, created_at")
              .in("id", groupIds)
              .order("created_at", { ascending: false })
          : { data: [], error: null };

      if (groupsResult.error) throw groupsResult.error;

      setGroups(groupsResult.data ?? []);
      setInvitations(invitationResult.data ?? []);
    } catch (error) {
      console.error("Error loading Friends screen:", error);
      Alert.alert(
        "Could not load Friends",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleCreateGroup = async () => {
    const name = groupName.trim();

    if (!name) {
      Alert.alert("Group name required", "Enter a name for your group.");
      return;
    }

    if (name.length > 50) {
      Alert.alert("Name too long", "Use 50 characters or fewer.");
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.rpc("create_group", {
        p_name: name,
      });

      if (error) throw error;
      if (!data) throw new Error("No group ID was returned.");

      setGroupName("");
      setModalVisible(false);

      await loadData();

      Alert.alert("Group created!", `${name} is ready.`);
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert(
        "Could not create group",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInvitationResponse = async (
    invitation: Invitation,
    response: "accepted" | "declined",
  ) => {
    setRespondingTo(invitation.invitation_id);

    try {
      const { error } = await supabase.rpc("respond_to_group_invitation", {
        p_invitation_id: invitation.invitation_id,
        p_response: response,
      });

      if (error) throw error;

      await loadData(false);

      Alert.alert(
        response === "accepted" ? "Invitation accepted!" : "Invitation declined",
        response === "accepted"
          ? `You have joined ${invitation.group_name}.`
          : `You declined the invitation to ${invitation.group_name}.`,
      );
    } catch (error) {
      console.error("Error responding to invitation:", error);
      Alert.alert(
        "Could not update invitation",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setRespondingTo(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadData(false);
  };

  const renderInvitation = ({ item }: { item: Invitation }) => {
    const inviter =
      item.inviter_display_name?.trim() || item.inviter_username;

    const isResponding = respondingTo === item.invitation_id;

    return (
      <View style={styles.invitationCard}>
        <View style={styles.invitationTop}>
          <View style={styles.invitationIcon}>
            <Text style={styles.invitationIconText}>✉</Text>
          </View>

          <View style={styles.invitationInfo}>
            <Text style={styles.invitationGroupName}>{item.group_name}</Text>
            <Text style={styles.invitationDescription}>
              Invited by {inviter.startsWith("@") ? inviter : `@${inviter}`}
            </Text>
            <Text style={styles.invitationDate}>
              {new Date(item.invitation_created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.invitationActions}>
          <Pressable
            style={[
              styles.acceptButton,
              isResponding && styles.disabledButton,
            ]}
            onPress={() => void handleInvitationResponse(item, "accepted")}
            disabled={respondingTo !== null}
            accessibilityRole="button"
            accessibilityLabel={`Accept invitation to ${item.group_name}`}
          >
            {isResponding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept</Text>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.declineButton,
              respondingTo !== null && styles.disabledButton,
            ]}
            onPress={() => void handleInvitationResponse(item, "declined")}
            disabled={respondingTo !== null}
            accessibilityRole="button"
            accessibilityLabel={`Decline invitation to ${item.group_name}`}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <Pressable
      style={styles.groupCard}
      onPress={() =>
        router.push({
          pathname: "/group/[id]",
          params: { id: item.id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Open group ${item.name}`}
    >
      <View style={styles.groupIcon}>
        <Text style={styles.groupIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupDate}>
          Created {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.groupArrow}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Stay accountable, together.</Text>
        </View>

        <Pressable
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Create</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading Friends...</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.screenList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563EB"
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Incoming invitations
                </Text>
                <Text style={styles.groupCount}>{invitations.length}</Text>
              </View>

              {invitations.length === 0 ? (
                <View style={styles.noInvitations}>
                  <Text style={styles.noInvitationsText}>
                    No pending invitations. When a friend invites you to a
                    group, it will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.invitationList}>
                  {invitations.map((invitation) => (
                    <View key={invitation.invitation_id}>
                      {renderInvitation({ item: invitation })}
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.sectionHeader, styles.groupsHeader]}>
                <Text style={styles.sectionTitle}>Your groups</Text>
                <Text style={styles.groupCount}>{groups.length}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>+</Text>
              </View>

              <Text style={styles.emptyTitle}>No groups yet</Text>

              <Text style={styles.emptyDescription}>
                Create a group to start tracking your progress with friends.
              </Text>

              <Pressable
                style={styles.emptyButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.emptyButtonText}>
                  Create your first group
                </Text>
              </Pressable>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!creating) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!creating) setModalVisible(false);
            }}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Create a group</Text>

            <Text style={styles.modalDescription}>
              Give your group a name. You’ll be its owner and can invite friends
              next.
            </Text>

            <Text style={styles.inputLabel}>GROUP NAME</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. Fitness buddies"
              placeholderTextColor="#9CA3AF"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void handleCreateGroup()}
              editable={!creating}
              autoFocus
            />

            <Text style={styles.characterCount}>{groupName.length}/50</Text>

            <Pressable
              style={[styles.submitButton, creating && styles.disabledButton]}
              onPress={() => void handleCreateGroup()}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create group</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
              disabled={creating}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: "#F8FAFC",
    paddingTop: 58,
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#6B7280",
  },
  createButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 13,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  sectionHeader: {
    paddingHorizontal: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  groupCount: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#E5E7EB",
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
  },
  groupsHeader: {
    marginTop: 24,
  },
  screenList: {
    paddingHorizontal: 18,
    paddingBottom: 30,
    flexGrow: 1,
  },
  invitationList: {
    gap: 10,
  },
  invitationCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  invitationTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  invitationIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  invitationIconText: {
    color: "#1D4ED8",
    fontSize: 21,
    fontWeight: "800",
  },
  invitationInfo: {
    flex: 1,
  },
  invitationGroupName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  invitationDescription: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 4,
  },
  invitationDate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  invitationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  acceptButton: {
    flex: 1,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  declineButton: {
    flex: 1,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 12,
  },
  declineButtonText: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.65,
  },
  noInvitations: {
    marginHorizontal: 2,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noInvitationsText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginBottom: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  groupIconText: {
    color: "#1D4ED8",
    fontSize: 20,
    fontWeight: "800",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  groupDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 5,
  },
  groupArrow: {
    fontSize: 27,
    color: "#9CA3AF",
    paddingLeft: 8,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 30,
    paddingBottom: 30,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIconText: {
    color: "#2563EB",
    fontSize: 34,
    fontWeight: "400",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "800",
  },
  emptyDescription: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
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
    color: "#111827",
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
  characterCount: {
    alignSelf: "flex-end",
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 7,
  },
  submitButton: {
    height: 51,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    marginTop: 18,
  },
  submitButtonText: {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "800",
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
