import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";
import { useFlowers } from "../flowers/FlowersContext";
import { useAuthGuard } from "../hooks/useAuthGuard";

type Props = NativeStackScreenProps<AppStackParamList, "FlowersList">;

export function FlowersListScreen({ navigation }: Props) {
  const user = useAuthGuard();
  const { flowers, loading, refreshing, error, loadFlowers } = useFlowers();

  useEffect(() => {
    void loadFlowers();
  }, [loadFlowers]);

  const handleRefresh = useCallback(() => {
    void loadFlowers();
  }, [loadFlowers]);

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Flowers</Text>
        <Text style={styles.subtitle}>Signed in as {user.email}</Text>

        <View style={styles.row}>
          <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("CreateFlower")}>
            <Text style={styles.ghostButtonText}>Create</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.ghostButtonText}>Profile</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="#4a6b4f" />
        ) : (
          <FlatList
            data={flowers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.itemCard}
                onPress={() => navigation.navigate("FlowerDetail", { flowerId: item.id })}
              >
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>
                  {item.flower_type} • {item.status} • watered {item.water_count}/7
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No flowers yet.</Text>}
          />
        )}

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
    padding: 18
  },
  card: {
    width: "100%",
    maxWidth: 460,
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  listContent: {
    gap: 8,
    paddingBottom: 8
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e8e3d8",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fffdf9"
  },
  itemTitle: {
    fontSize: 15,
    color: "#2d2a24",
    fontWeight: "700"
  },
  itemMeta: {
    marginTop: 4,
    color: "#6a6258",
    fontSize: 13
  },
  emptyText: {
    color: "#6a6258",
    fontSize: 14,
    marginTop: 12
  },
  ghostButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd8c3"
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
