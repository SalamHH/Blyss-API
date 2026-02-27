import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable,  StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/types";
import { useAuth } from "../auth/AuthContext";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyOtp">;

export function VerifyOtpScreen({ navigation }: Props) {
  const [otp, setOtp] = useState("");
  const { busy, pendingEmail, debugOtp, verifyPendingOtp } = useAuth();
  const canSubmit = useMemo(() => otp.trim().length >= 4 && pendingEmail.length > 3, [otp, pendingEmail]);

  const handleVerify = useCallback(async () => {
    if (!canSubmit || busy) {
      return;
    }
    await verifyPendingOtp(otp);
  }, [busy, canSubmit, otp, verifyPendingOtp]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("RequestOtp");
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Verify</Text>
        <Text style={styles.subtitle}>{pendingEmail || "No email set. Go back and request OTP."}</Text>

        <Text style={styles.label}>One-Time Code</Text>
        <TextInput
          keyboardType="number-pad"
          placeholder="123456"
          value={otp}
          onChangeText={setOtp}
          style={styles.input}
        />

        {debugOtp ? <Text style={styles.debug}>Dev OTP: {debugOtp}</Text> : null}

        <Pressable
          style={[styles.button, (!canSubmit || busy) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={!canSubmit || busy}
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={handleBack}>
          <Text style={styles.ghostButtonText}>Back</Text>
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
  debug: {
    fontSize: 12,
    color: "#8a7f6d"
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
  ghostButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start"
  },
  ghostButtonText: {
    color: "#4a6b4f",
    fontWeight: "700"
  }
});
