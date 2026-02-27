import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { AppStackParamList } from "../navigation/types";
import { useFlowers } from "../flowers/FlowersContext";
import { getShareTokenHistory, ShareTokenHistoryEntry } from "../flowers/shareTokenHistory";
import { logEvent } from "../lib/analytics";

type Props = NativeStackScreenProps<AppStackParamList, "FlowerDetail">;

export function FlowerDetailScreen({ route, navigation }: Props) {
  const { flowerId } = route.params;
  const {
    getFlowerById,
    getFlowerDetailById,
    loadFlowerDetail,
    waterFlowerById,
    sendFlowerById,
    forceReadyFlowerByIdDev,
    wateringFlowerId,
    sendingFlowerId,
    detailLoadingFlowerId,
    error
  } = useFlowers();

  const [waterMessage, setWaterMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [shareHistory, setShareHistory] = useState<ShareTokenHistoryEntry[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const flower = getFlowerById(flowerId);
  const detail = getFlowerDetailById(flowerId);

  const canWater = useMemo(() => {
    if (!flower) {
      return false;
    }
    return flower.status !== "sent" && flower.status !== "ready";
  }, [flower]);
  const canSend = useMemo(() => flower?.status === "ready", [flower?.status]);

  const isWatering = wateringFlowerId === flowerId;
  const isSending = sendingFlowerId === flowerId;
  const isLoadingDetail = detailLoadingFlowerId === flowerId;

  const refreshShareHistory = useCallback(async () => {
    const history = await getShareTokenHistory(flowerId);
    setShareHistory(history);
  }, [flowerId]);

  useEffect(() => {
    void loadFlowerDetail(flowerId);
    void refreshShareHistory();
  }, [flowerId, loadFlowerDetail, refreshShareHistory]);

  const handleWater = useCallback(async () => {
    if (!canWater || !waterMessage.trim()) {
      return;
    }
    try {
      await waterFlowerById(flowerId, waterMessage);
      setWaterMessage("");
      void loadFlowerDetail(flowerId);
    } catch {
      // Context-level error surface handles messaging.
    }
  }, [canWater, flowerId, loadFlowerDetail, waterFlowerById, waterMessage]);

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    try {
      const shareToken = await sendFlowerById(flowerId, recipientName);
      setSendResult(shareToken ? `Share token: ${shareToken}` : "Flower sent.");
      await refreshShareHistory();
      void loadFlowerDetail(flowerId);
    } catch {
      // Context-level error surface handles messaging.
    }
  }, [canSend, flowerId, loadFlowerDetail, recipientName, refreshShareHistory, sendFlowerById]);

  const handleForceReadyDev = useCallback(async () => {
    try {
      await forceReadyFlowerByIdDev(flowerId);
      void loadFlowerDetail(flowerId);
    } catch {
      // Context-level error surface handles messaging.
    }
  }, [flowerId, forceReadyFlowerByIdDev, loadFlowerDetail]);

  const handleCopyToken = useCallback(
    async (token: string) => {
      try {
        await Clipboard.setStringAsync(token);
        setCopyMessage("Copied token to clipboard.");
        logEvent("flowers.share_token.copied", { flower_id: flowerId, mode: "expo-clipboard" });
        return;
      } catch {
        setCopyMessage("Copy failed on this build. Please copy token manually.");
        logEvent("flowers.share_token.copy_unavailable", { flower_id: flowerId, mode: "expo-clipboard-failed" });
      }
    },
    [flowerId]
  );

  if (!flower && isLoadingDetail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Loading flower...</Text>
          <ActivityIndicator color="#4a6b4f" />
        </View>
      </SafeAreaView>
    );
  }

  if (!flower) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Flower not found</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate("FlowersList")}>
            <Text style={styles.buttonText}>Back to Flowers</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Flower Detail</Text>
          <Text style={styles.title}>{flower.title}</Text>
          <Text style={styles.meta}>{flower.flower_type} • {flower.status}</Text>
          <Text style={styles.meta}>Water count: {flower.water_count}/7</Text>
          <Text style={styles.meta}>
            Delivery: {detail?.delivery_mode ? detail.delivery_mode : "not sent"}
          </Text>
          {detail?.recipient_name ? <Text style={styles.meta}>Recipient: {detail.recipient_name}</Text> : null}
          {detail?.recipient_contact ? <Text style={styles.meta}>Contact: {detail.recipient_contact}</Text> : null}

          <Text style={styles.sectionLabel}>Water Today</Text>
          <TextInput
            placeholder="Write a supportive message"
            value={waterMessage}
            onChangeText={setWaterMessage}
            style={styles.input}
            editable={canWater && !isWatering}
          />
          <Pressable
            style={[styles.button, (!canWater || !waterMessage.trim() || isWatering) && styles.buttonDisabled]}
            onPress={handleWater}
            disabled={!canWater || !waterMessage.trim() || isWatering}
          >
            {isWatering ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Water Flower</Text>}
          </Pressable>

          <Text style={styles.sectionLabel}>Send Gift</Text>
          <TextInput
            placeholder="Recipient name (optional)"
            value={recipientName}
            onChangeText={setRecipientName}
            style={styles.input}
            editable={canSend && !isSending}
          />
          <Pressable
            style={[styles.sendButton, (!canSend || isSending) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!canSend || isSending}
          >
            {isSending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Send Now</Text>}
          </Pressable>
          {__DEV__ ? (
            <Pressable
              style={[styles.devButton, (isSending || isWatering) && styles.buttonDisabled]}
              onPress={handleForceReadyDev}
              disabled={isSending || isWatering}
            >
              <Text style={styles.buttonText}>Force Ready (Dev)</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionLabel}>Share Token History</Text>
          {shareHistory.length === 0 ? (
            <Text style={styles.meta}>No sent gift tokens yet.</Text>
          ) : (
            <View style={styles.historyList}>
              {shareHistory.map((entry) => (
                <View key={`${entry.token}-${entry.created_at}`} style={styles.historyRow}>
                  <Text style={styles.historyToken} numberOfLines={1}>{entry.token}</Text>
                  <Pressable style={styles.copyButton} onPress={() => void handleCopyToken(entry.token)}>
                    <Text style={styles.copyText}>Copy</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>Timeline</Text>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Created</Text>
            <Text style={styles.timelineValue}>{new Date(flower.created_at).toLocaleString()}</Text>
          </View>
          {detail?.sent_at ? (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Sent</Text>
              <Text style={styles.timelineValue}>{new Date(detail.sent_at).toLocaleString()}</Text>
            </View>
          ) : (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Sent</Text>
              <Text style={styles.timelineValue}>Not sent yet</Text>
            </View>
          )}

          {copyMessage ? <Text style={styles.success}>{copyMessage}</Text> : null}
          {sendResult ? <Text style={styles.success}>{sendResult}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("FlowersList")}>
            <Text style={styles.ghostButtonText}>Back to List</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => navigation.navigate("OpenGift")}>
            <Text style={styles.ghostButtonText}>Go to Open Gift</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f4ef",
    padding: 24
  },
  scroll: {
    width: "100%"
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
    paddingBottom: 24
  },
  card: {
    width: "100%",
    maxWidth: 460,
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
  meta: {
    fontSize: 14,
    color: "#554f45"
  },
  sectionLabel: {
    marginTop: 8,
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
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#4a6b4f",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16
  },
  sendButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#7a4f2f",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16
  },
  devButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#6f5f96",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
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
  historyList: {
    gap: 8
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  historyToken: {
    flex: 1,
    fontSize: 12,
    color: "#3d372f"
  },
  copyButton: {
    backgroundColor: "#ece7de",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  copyText: {
    color: "#4b4338",
    fontWeight: "700",
    fontSize: 12
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8e3d8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  timelineLabel: {
    fontSize: 12,
    color: "#6f665a",
    fontWeight: "700"
  },
  timelineValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: "#3d372f"
  },
  ghostButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  ghostButtonText: {
    color: "#4a6b4f",
    fontWeight: "700"
  },
  success: {
    marginTop: 6,
    color: "#2f5b38",
    fontSize: 13
  },
  error: {
    marginTop: 6,
    color: "#a13a2f",
    fontSize: 13
  }
});
