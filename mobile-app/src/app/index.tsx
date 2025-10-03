import { View, Text } from "react-native";

export default function Home() {
  return (
    <View style={{
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: "#f8f9fa",
    }}>
      <Text style={{
        fontSize: 32,
        fontWeight: "bold",
        color: "#2c3e50",
        marginBottom: 10,
      }}>Wodates</Text>
      <Text style={{
        fontSize: 18,
        color: "#7f8c8d",
        textAlign: "center",
        marginBottom: 20,
      }}>Encuentra tu pareja de entrenamiento</Text>
      <Text style={{
        fontSize: 16,
        color: "#95a5a6",
        textAlign: "center",
        lineHeight: 24,
      }}>
        Conecta con personas que comparten tu pasión por el fitness
      </Text>
    </View>
  );
}
