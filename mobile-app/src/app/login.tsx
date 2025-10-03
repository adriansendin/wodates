import { View, Text, TouchableOpacity } from "react-native";

export default function Login() {
  return (
    <View style={{
      flex: 1,
      padding: 20,
      backgroundColor: "#f8f9fa",
      justifyContent: "center",
    }}>
      <Text style={{
        fontSize: 28,
        fontWeight: "bold",
        color: "#2c3e50",
        textAlign: "center",
        marginBottom: 10,
      }}>Iniciar Sesión</Text>
      <Text style={{
        fontSize: 16,
        color: "#7f8c8d",
        textAlign: "center",
        marginBottom: 40,
      }}>Accede a tu cuenta de Wodates</Text>
      
      <View style={{ width: "100%" }}>
        <Text style={{
          fontSize: 16,
          fontWeight: "600",
          color: "#2c3e50",
          marginBottom: 8,
          marginTop: 16,
        }}>Email</Text>
        <View style={{
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: "#e1e8ed",
        }}>
          <Text style={{
            color: "#95a5a6",
            fontSize: 16,
          }}>tu@email.com</Text>
        </View>
        
        <Text style={{
          fontSize: 16,
          fontWeight: "600",
          color: "#2c3e50",
          marginBottom: 8,
          marginTop: 16,
        }}>Contraseña</Text>
        <View style={{
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: "#e1e8ed",
        }}>
          <Text style={{
            color: "#95a5a6",
            fontSize: 16,
          }}>••••••••</Text>
        </View>
        
        <TouchableOpacity style={{
          backgroundColor: "#3498db",
          borderRadius: 8,
          padding: 16,
          marginTop: 24,
          alignItems: "center",
        }}>
          <Text style={{
            color: "white",
            fontSize: 16,
            fontWeight: "600",
          }}>Iniciar Sesión</Text>
        </TouchableOpacity>
        
        <Text style={{
          color: "#3498db",
          textAlign: "center",
          marginTop: 20,
          fontSize: 16,
        }}>¿No tienes cuenta? Regístrate</Text>
      </View>
    </View>
  );
}
