import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>404 — Not found</Text>
      <Link href="/" style={styles.link}>
        Return to Home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  link: {
    fontSize: 16,
    color: '#e91e63',
  },
});
