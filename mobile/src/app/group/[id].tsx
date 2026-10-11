import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

type GroupInfo = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

type Member = {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroup = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, created_by, created_at')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;

      setGroup(groupData);

      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at')
        .eq('group_id', id)
        .order('joined_at', { ascending: true });

      if (memberError) throw memberError;

      const memberList = (memberData ?? []) as Member[];
      setMembers(memberList);

      const userIds = [...new Set(memberList.map((member) => member.user_id))];

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', userIds);

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
      console.error('Error loading group details:', error);
      Alert.alert(
        'Unable to load group',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadGroup();
    }, [loadGroup])
  );

  const refresh = () => {
    setRefreshing(true);
    loadGroup();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: group?.name ?? 'Group details' }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.muted}>Loading group...</Text>
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <Text style={styles.heading}>Group not found</Text>
          <Text style={styles.muted}>
            You may not have access to this group.
          </Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
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
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.count}>{members.length}</Text>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.muted}>No members found yet.</Text>
            </View>
          ) : (
            members.map((member) => {
              const profile = profiles[member.user_id];
              const displayName =
                profile?.display_name?.trim() || profile?.username || 'Member';

              return (
                <View key={member.user_id} style={styles.memberCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.username}>
                      {profile?.username
                        ? `@${profile.username}`
                        : 'Username unavailable'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      member.role === 'owner' && styles.ownerBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        member.role === 'owner' && styles.ownerText,
                      ]}
                    >
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <Pressable
            style={styles.button}
            onPress={() =>
              Alert.alert(
                'Coming next',
                'We will add friend invitations here next.'
              )
            }
          >
            <Text style={styles.buttonText}>+ Invite friends</Text>
          </Pressable>

          <Text style={styles.footer}>
            Your group’s shared progress will appear here as we build the next
            features. Individual food logs will remain private.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  groupIconText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  groupName: {
    fontSize: 23,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  muted: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
  },
  count: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    color: '#334155',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  username: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ownerBadge: {
    backgroundColor: '#DBEAFE',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ownerText: {
    color: '#1D4ED8',
  },
  emptyCard: {
    padding: 22,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 18,
  },
});
