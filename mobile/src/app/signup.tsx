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

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanEmail || !cleanUsername || !password || !confirmPassword) {
      Alert.alert('Missing information', 'Please fill in all fields.');
      return;
    }

    if (cleanUsername.length < 3) {
      Alert.alert(
        'Invalid username',
        'Username must be at least 3 characters.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Invalid password',
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords do not match',
        'Please make sure both passwords are the same.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
            data: {
                username: cleanUsername,
            },
        },
      });

      if (error) {
        Alert.alert('Signup failed', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert(
          'Signup failed',
          'The account could not be created.'
        );
        return;
      }

      Alert.alert(
        'Account created',
        `Welcome, ${cleanUsername}!`,
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      console.error('Signup error:', error);

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
          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.subtitle}>
            Start tracking your calories with FunTracker.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.label}>Username</Text>

          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.helper}>
            This is the name your friends will see.
          </Text>

          <Text style={styles.label}>Password</Text>

          <TextInput
            style={styles.input}
            placeholder="Create a password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Confirm password</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter password again"
            placeholderTextColor="#888"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.loginText}>
              Already have an account? Log in
            </Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  header: {
    marginBottom: 32,
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

  helper: {
    marginTop: 6,
    fontSize: 13,
    color: '#777',
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

  loginText: {
    marginTop: 22,
    textAlign: 'center',
    fontSize: 15,
    color: '#333',
  },
});