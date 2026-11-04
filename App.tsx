import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.title}>FlowCanvas</Text>
          <Text style={styles.subtitle}>Capture ideas naturally.</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0FDFA',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F0FDFA',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#134E4A',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#0D9488',
    fontSize: 16,
  },
});
