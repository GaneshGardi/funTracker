
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const genders = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const goals = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

type ProfileData = {
  username: string;
  display_name: string;
  birth_date: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  goal: string;
};

const emptyProfile: ProfileData = {
  username: '',
  display_name: '',
  birth_date: '',
  gender: '',
  height_cm: '',
  weight_kg: '',
  goal: '',
};

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [dailyCalories, setDailyCalories] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCalories, setSavingCalories] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          'username, display_name, birth_date, gender, height_cm, weight_kg, goal'
        )
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile({
        username: profileData.username ?? '',
        display_name: profileData.display_name ?? '',
        birth_date: profileData.birth_date ?? '',
        gender: profileData.gender ?? '',
        height_cm:
          profileData.height_cm == null
            ? ''
            : String(profileData.height_cm),
        weight_kg:
          profileData.weight_kg == null
            ? ''
            : String(profileData.weight_kg),
        goal: profileData.goal ?? '',
      });

      const { data: goalData, error: goalError } = await supabase
        .from('calorie_goals')
        .select('daily_calories')
        .eq('user_id', user.id)
        .order('effective_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goalError) throw goalError;

      setDailyCalories(
        goalData?.daily_calories == null
          ? ''
          : String(goalData.daily_calories)
      );
    } catch (error) {
      console.error('Profile loading error:', error);
      Alert.alert(
        'Could not load settings',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (savingProfile) return;

    const username = profile.username.trim().toLowerCase();
    const displayName = profile.display_name.trim();
    const height = profile.height_cm.trim();
    const weight = profile.weight_kg.trim();
    const birthDate = profile.birth_date.trim();

    if (!username) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      Alert.alert(
        'Invalid username',
        'Use 3–24 characters: lowercase letters, numbers, and underscores only.'
      );
      return;
    }

    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert(
        'Invalid date',
        'Enter your date of birth in YYYY-MM-DD format.'
      );
      return;
    }

    if (height && (!Number.isFinite(Number(height)) || Number(height) <= 0)) {
      Alert.alert('Invalid height', 'Enter a valid height in centimetres.');
      return;
    }

    if (weight && (!Number.isFinite(Number(weight)) || Number(weight) <= 0)) {
      Alert.alert('Invalid weight', 'Enter a valid weight in kilograms.');
      return;
    }

    if (profile.gender && !genders.some((item) => item.value === profile.gender)) {
      Alert.alert('Invalid gender', 'Please select a valid option.');
      return;
    }

    if (profile.goal && !goals.some((item) => item.value === profile.goal)) {
      Alert.alert('Invalid goal', 'Please select a valid option.');
      return;
    }

    setSavingProfile(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          display_name: displayName || null,
          birth_date: birthDate || null,
          gender: profile.gender || null,
          height_cm: height ? Number(height) : null,
          weight_kg: weight ? Number(weight) : null,
          goal: profile.goal || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((current) => ({
        ...current,
        username,
        display_name: displayName,
      }));

      Alert.alert('Profile saved', 'Your personal details have been updated.');
    } catch (error) {
      console.error('Profile save error:', error);
      const message =
        error instanceof Error ? error.message : 'Please try again.';

      Alert.alert(
        'Could not save profile',
        message.includes('profiles_username')
          ? 'That username may already be taken. Try another one.'
          : message
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCalories = async () => {
    if (savingCalories) return;

    const calories = Number(dailyCalories);

    if (
      !dailyCalories.trim() ||
      !Number.isInteger(calories) ||
      calories < 500 ||
      calories > 10000
    ) {
      Alert.alert(
        'Invalid calorie goal',
        'Enter a whole number between 500 and 10,000 calories.'
      );
      return;
    }

    setSavingCalories(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase.from('calorie_goals').insert({
        user_id: user.id,
        daily_calories: calories,
        effective_at: new Date().toISOString(),
      });

      if (error) throw error;

      setDailyCalories(String(calories));
      Alert.alert(
        'Calorie goal updated',
        `Your daily target is now ${calories.toLocaleString()} calories.`
      );
    } catch (error) {
      console.error('Calorie goal update error:', error);
      Alert.alert(
        'Could not update calorie goal',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSavingCalories(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(
        'Could not log out',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading your settings…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.title}>Profile & Settings</Text>
          <Text style={styles.subtitle}>
            Manage your account and calorie targets.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal details</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={profile.username}
            onChangeText={(value) => updateField('username', value)}
            placeholder="your_username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            editable={!savingProfile}
          />

          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={profile.display_name}
            onChangeText={(value) => updateField('display_name', value)}
            placeholder="How your name appears"
            maxLength={60}
            editable={!savingProfile}
          />

          <Text style={styles.label}>Date of birth</Text>
          <TextInput
            style={styles.input}
            value={profile.birth_date}
            onChangeText={(value) => updateField('birth_date', value)}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            editable={!savingProfile}
          />

          <Text style={styles.label}>Gender</Text>
          <View style={styles.options}>
            {genders.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.option,
                  profile.gender === item.value && styles.optionSelected,
                ]}
                onPress={() => updateField('gender', item.value)}
                disabled={savingProfile}
              >
                <Text
                  style={[
                    styles.optionText,
                    profile.gender === item.value && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={profile.height_cm}
                onChangeText={(value) => updateField('height_cm', value)}
                placeholder="172"
                keyboardType="decimal-pad"
                editable={!savingProfile}
              />
            </View>

            <View style={styles.column}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={profile.weight_kg}
                onChangeText={(value) => updateField('weight_kg', value)}
                placeholder="68"
                keyboardType="decimal-pad"
                editable={!savingProfile}
              />
            </View>
          </View>

          <Text style={styles.label}>Fitness goal</Text>
          <View style={styles.options}>
            {goals.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.option,
                  profile.goal === item.value && styles.optionSelected,
                ]}
                onPress={() => updateField('goal', item.value)}
                disabled={savingProfile}
              >
                <Text
                  style={[
                    styles.optionText,
                    profile.goal === item.value && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.primaryButton, savingProfile && styles.disabledButton]}
            onPress={() => void handleSaveProfile()}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save personal details</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily calorie goal</Text>
          <Text style={styles.description}>
            Update your daily calorie target whenever your plan changes.
          </Text>

          <Text style={styles.label}>Calories per day</Text>
          <TextInput
            style={styles.input}
            value={dailyCalories}
            onChangeText={setDailyCalories}
            placeholder="e.g. 2000"
            keyboardType="number-pad"
            editable={!savingCalories}
          />

          <Pressable
            style={[styles.primaryButton, savingCalories && styles.disabledButton]}
            onPress={() => void handleSaveCalories()}
            disabled={savingCalories}
          >
            {savingCalories ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Update calorie goal</Text>
            )}
          </Pressable>

          <Text style={styles.helperText}>
            Your previous calorie targets are retained in your goal history.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.description}>
            You are signed in to FunTracker.
          </Text>

          <Pressable
            style={[styles.logoutButton, loggingOut && styles.disabledButton]}
            onPress={() => void handleLogout()}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out of FunTracker"
          >
            {loggingOut ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.logoutButtonText}>Log out</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          fun tracker · your calorie tracking app
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 7,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    padding: 18,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  optionTextSelected: {
    color: '#1D4ED8',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  helperText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    marginTop: 14,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    marginTop: 4,
    marginBottom: 12,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
});
