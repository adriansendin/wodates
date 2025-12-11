import { Redirect } from 'expo-router';

export default function RegisterIndex() {
  // Redirigir automáticamente al primer paso
  return <Redirect href="/(auth)/register/step1" />;
}

