import { Redirect } from 'expo-router';

export default function RegisterIndex() {
  // Ir directo a la pantalla de registro (nombre, email, contraseña)
  return <Redirect href="/(auth)/register/step1" />;
}

