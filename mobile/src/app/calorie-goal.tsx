import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../lib/supabase';

export default function CalorieGoalScreen() {
  const [calories, setCalories] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const dailyCalories = Number(calories);

    if (!dailyCalories || dailyCalories <= 0) {
      Alert.alert(
        'Invalid calorie goal',
        'Please enter a valid daily calorie goal.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Session error',
          'Please log in again.'
        );
        return;
      }

      const { error } = await supabase
        .from('calorie_goals')
        .insert({
          user_id: user.id,
          daily_calories: dailyCalories,
          effective_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to save calorie goal:', error);

        Alert.alert(
          'Could not save goal',
          error.message
        );
        return;
      }

      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          Set your daily calorie goal
        </Text>

        <Text style={styles.subtitle}>
          Choose how many calories you want to eat each day.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. 2200"
          keyboardType="numeric"
          value={calories}
          onChangeText={setCalories}
          editable={!saving}
        />

        <Text style={styles.unit}>kcal / day</Text>

        <TouchableOpacity
          style={[
            styles.button,
            saving && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Save & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },

  subtitle: {
    marginTop: 10,
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    color: '#111',
  },

  unit: {
    marginTop: 8,
    fontSize: 14,
    color: '#777',
  },

  button: {
    marginTop: 32,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});