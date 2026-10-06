import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

export default function ProfileButton() {
  return (
    <Pressable
      style={styles.button}
      onPress={() => router.push('/profile')}
    >
      <Text style={styles.icon}>👤</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eaeaea',
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    fontSize: 20,
  },
});