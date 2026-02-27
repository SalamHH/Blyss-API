import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable,  StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { useFlowers } from "../flowers/FlowersContext";

type Props = NativeStackScreenProps<AppStackParamList, "CreateFlower">;

export function CreateFlowerScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const { creating, error, createFlowerOptimistic } = useFlowers();
  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || creating) {
      return;
    }

    try {
      await createFlowerOptimistic(title);
      setTitle("");
      navigation.navigate("FlowersList");
    } catch {
      // Error text is already managed by context.
    }
  }, [canSubmit, createFlowerOptimistic, creating, navigation, title]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Create</Text>
        <Text style={styles.subtitle}>Start a new flower for someone you care about.</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          placeholder="Flower title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <Pressable
          style={[styles.button, (!canSubmit || creating) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || creating}
        >
          {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Create Flower</Text>}
        </Pressable>

        <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("FlowersList")}>
          <Text style={styles.ghostButtonText}>Back to List</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  },
  error: {
    marginTop: 8,
    color: "#a13a2f",
    fontSize: 13
  }
});
