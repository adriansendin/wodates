import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation('common');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('notFound.title')}</Text>
      <Link href="/" style={styles.link}>
        {t('notFound.returnHome')}
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
