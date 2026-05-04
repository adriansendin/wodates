import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AFFINITY_MESSAGE_PRIMARY =
  'El sistema está buscando perfiles con afinidad real a partir de todo lo que nos has contado.';
const AFFINITY_MESSAGE_SECONDARY =
  'Cuanta más información completes, mejor podremos afinar tu búsqueda.';
const AFFINITY_MESSAGE_EMAIL =
  'Te avisaremos por email cuando haya una afinidad compatible.';

export default function AffinityScreen() {
  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.messageCard}>
          <Text style={styles.messagePrimary}>{AFFINITY_MESSAGE_PRIMARY}</Text>
          <Text style={styles.messageSecondary}>{AFFINITY_MESSAGE_SECONDARY}</Text>
          <Text style={styles.messageSecondary}>{AFFINITY_MESSAGE_EMAIL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 14,
  },
  messagePrimary: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  messageSecondary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6e6e6e',
    letterSpacing: -0.1,
  },
});
