import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FunTracker</Text>

      <Text style={styles.subtitle}>
        Your calorie tracking app
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/signup')}
      >
        <Text style={styles.buttonText}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },

  button: {
    marginTop: 30,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#111',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});