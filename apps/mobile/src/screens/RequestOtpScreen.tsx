import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable,  StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { API_BASE_URL } from "../config";
import { AuthStackParamList } from "../navigation/types";
import { useAuth } from "../auth/AuthContext";

type Props = NativeStackScreenProps<AuthStackParamList, "RequestOtp">;

export function RequestOtpScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const { busy, requestOtpForEmail } = useAuth();
  const canSubmit = useMemo(() => email.trim().length > 4, [email]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || busy) {
      return;
    }
    const ok = await requestOtpForEmail(email);
    if (ok) {
      navigation.navigate("VerifyOtp");
    }
  }, [busy, canSubmit, email, navigation, requestOtpForEmail]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Blyss Mobile</Text>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>API base URL: {API_BASE_URL}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <Pressable
          style={[styles.button, (!canSubmit || busy) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || busy}
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
        </Pressable>

        <Pressable style={styles.giftLink} onPress={() => navigation.navigate("OpenGift")}>
          <Text style={styles.giftLinkText}>Open a Gift Instead</Text>
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
  title: {
    fontSize: 24,
    color: "#2d2a24",
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 14,
    color: "#554f45"
  },
  label: {
    marginTop: 6,
    fontSize: 13,
    color: "#8a7f6d",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d9d2c2",
    borderRadius: 12,
    backgroundColor: "#fbf9f4",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#2d2a24"
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
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700"
  },
  giftLink: {
    marginTop: 2,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  giftLinkText: {
    color: "#4a6b4f",
    fontWeight: "700",
    fontSize: 13
  }
});
