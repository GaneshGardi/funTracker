import { useState } from 'react';
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
import { router } from 'expo-router';

import { supabase } from '../lib/supabase';

const goals = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

export default function OnboardingScreen() {
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');

  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!birthDate || !gender || !height || !weight || !goal) {
      Alert.alert(
        'Missing information',
        'Please complete all fields.'
      );
      return;
    }

    const heightCm = Number(height);
    const weightKg = Number(weight);

    if (Number.isNaN(heightCm) || heightCm <= 0) {
      Alert.alert('Invalid height', 'Please enter a valid height in cm.');
      return;
    }

    if (Number.isNaN(weightKg) || weightKg <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Session expired',
          'Please log in again.'
        );

        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          birth_date: birthDate,
          gender,
          height_cm: heightCm,
          weight_kg: weightKg,
          goal,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);

        Alert.alert(
          'Could not save profile',
          error.message
        );

        return;
      }

      router.replace('/calorie-goal');
    } catch (error) {
      console.error('Onboarding error:', error);

      Alert.alert(
        'Something went wrong',
        'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>Complete your profile</Text>

          <Text style={styles.subtitle}>
            We’ll use this information to personalize your calorie goals.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Date of birth</Text>

          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#888"
            value={birthDate}
            onChangeText={setBirthDate}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Gender</Text>

          <View style={styles.options}>
            <Pressable
              style={[
                styles.option,
                gender === 'male' && styles.optionSelected,
              ]}
              onPress={() => setGender('male')}
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  gender === 'male' && styles.optionTextSelected,
                ]}
              >
                Male
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.option,
                gender === 'female' && styles.optionSelected,
              ]}
              onPress={() => setGender('female')}
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  gender === 'female' && styles.optionTextSelected,
                ]}
              >
                Female
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.option,
                gender === 'other' && styles.optionSelected,
              ]}
              onPress={() => setGender('other')}
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  gender === 'other' && styles.optionTextSelected,
                ]}
              >
                Other
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.option,
                gender === 'prefer_not_to_say' &&
                  styles.optionSelected,
              ]}
              onPress={() =>
                setGender('prefer_not_to_say')
              }
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  gender === 'prefer_not_to_say' &&
                    styles.optionTextSelected,
                ]}
              >
                Prefer not to say
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Height</Text>

          <View style={styles.inputWithUnit}>
            <TextInput
              style={styles.unitInput}
              placeholder="e.g. 173"
              placeholderTextColor="#888"
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              editable={!loading}
            />

            <Text style={styles.unit}>cm</Text>
          </View>

          <Text style={styles.label}>Weight</Text>

          <View style={styles.inputWithUnit}>
            <TextInput
              style={styles.unitInput}
              placeholder="e.g. 68"
              placeholderTextColor="#888"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              editable={!loading}
            />

            <Text style={styles.unit}>kg</Text>
          </View>

          <Text style={styles.label}>Your goal</Text>

          <View style={styles.goalContainer}>
            {goals.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.goalOption,
                  goal === item.value &&
                    styles.optionSelected,
                ]}
                onPress={() => setGoal(item.value)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.optionText,
                    goal === item.value &&
                      styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Continue
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  header: {
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    color: '#666',
  },

  form: {
    width: '100%',
  },

  label: {
    marginBottom: 8,
    marginTop: 18,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },

  options: {
    gap: 10,
  },

  option: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },

  optionSelected: {
    borderColor: '#111',
    backgroundColor: '#111',
  },

  optionText: {
    fontSize: 15,
    color: '#333',
  },

  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },

  unitInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
  },

  unit: {
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#666',
  },

  goalContainer: {
    gap: 10,
  },

  goalOption: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },

  button: {
    height: 52,
    marginTop: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});