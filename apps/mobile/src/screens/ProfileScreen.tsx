import { useCallback } from "react";
import { ActivityIndicator, Pressable,  StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { useAuth } from "../auth/AuthContext";

type Props = NativeStackScreenProps<AppStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { currentUser, busy, signOut } = useAuth();

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Profile</Text>
        <Text style={styles.subtitle}>Email: {currentUser?.email ?? "Unknown"}</Text>
        <Text style={styles.subtitle}>Handle: {currentUser?.handle ?? "Not set"}</Text>

        <Pressable style={styles.button} onPress={() => navigation.navigate("FlowersList")}> 
          <Text style={styles.buttonText}>Back to Flowers</Text>
        </Pressable>

        <Pressable style={[styles.signOutButton, busy && styles.buttonDisabled]} onPress={handleSignOut}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign Out</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f4ef",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e8e3d8"
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#8a7f6d",
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 14,
    color: "#554f45"
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#4a6b4f",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  signOutButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#8a352b",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700"
  }
});
