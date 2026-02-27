import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { openFlowerByToken } from "@blyss/shared";
import { API_BASE_URL } from "../config";
import { getUserErrorMessage } from "../lib/errorMessages";

type OpenGiftOnlyParamList = {
  OpenGift: undefined;
};

type Props = NativeStackScreenProps<OpenGiftOnlyParamList, "OpenGift">;

export function OpenGiftScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<Awaited<ReturnType<typeof openFlowerByToken>> | null>(null);
  const [dropIndex, setDropIndex] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  const currentDrop = useMemo(() => {
    if (!gift || gift.drops.length === 0) {
      return null;
    }
    return gift.drops[dropIndex];
  }, [dropIndex, gift]);

  const openGift = useCallback(async () => {
    if (!token.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await openFlowerByToken(token.trim(), API_BASE_URL);
      setGift(data);
      setDropIndex(0);

      Animated.sequence([
        Animated.timing(panelOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(panelOpacity, { toValue: 1, duration: 420, useNativeDriver: true })
      ]).start();
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not open gift. Check the token and try again."));
      setGift(null);
    } finally {
      setLoading(false);
    }
  }, [panelOpacity, token]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 8,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const max = (gift?.drops.length ?? 1) - 1;
        const current = dropIndex;

        if (gestureState.dx < -70 && current < max) {
          setDropIndex(current + 1);
        } else if (gestureState.dx > 70 && current > 0) {
          setDropIndex(current - 1);
        }

        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 90
        }).start();
      }
    })
  ).current;

  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [headerOpacity]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[StyleSheet.absoluteFill, styles.backdropBase]} pointerEvents="none">
        <View style={[styles.blobA, { left: width * 0.04, top: height * 0.18 }]} />
        <View style={[styles.blobB, { left: width * 0.58, top: height * 0.16 }]} />
        <View style={[styles.blobC, { left: width * 0.24, top: height * 0.62 }]} />
      </View>

      <Animated.View style={[styles.headerWrap, { opacity: headerOpacity }]}>
        <Text style={styles.kicker}>Blyss Gift</Text>
        <Text style={styles.title}>Open Your Flower</Text>
        <Text style={styles.subtitle}>Paste a gift token to reveal a private bloom message.</Text>
      </Animated.View>

      <View style={styles.tokenCard}>
        <TextInput
          placeholder="Paste share token"
          placeholderTextColor="#c5b9df"
          value={token}
          onChangeText={setToken}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={[styles.openButton, loading && styles.disabled]} onPress={() => void openGift()} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.openButtonText}>Open Gift</Text>}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {gift ? (
        <Animated.View style={[styles.giftPanel, { opacity: panelOpacity }]}> 
          <Text style={styles.sender}>From {gift.sender_name}</Text>
          <Text style={styles.flowerTitle}>{gift.title}</Text>

          <Animated.View style={[styles.dropCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
            {currentDrop ? (
              <>
                <Text style={styles.day}>Day {currentDrop.day_number}</Text>
                <Text style={styles.message}>{currentDrop.message || "A quiet bloom."}</Text>
              </>
            ) : (
              <Text style={styles.message}>No drops yet.</Text>
            )}
          </Animated.View>

          <View style={styles.controls}>
            <Text style={styles.controlText}>Swipe left/right</Text>
            <Text style={styles.controlText}>
              {gift.drops.length === 0 ? 0 : dropIndex + 1}/{gift.drops.length}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Pressable
        style={styles.backButton}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      >
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12
  },
  backdropBase: {
    backgroundColor: "#210c3f"
  },
  blobA: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,190,214,0.18)"
  },
  blobB: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(140,230,255,0.12)"
  },
  blobC: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,235,168,0.10)"
  },
  headerWrap: {
    marginTop: 8,
    gap: 6
  },
  kicker: {
    color: "#f6d8ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800"
  },
  subtitle: {
    color: "#e5d9f7",
    fontSize: 14,
    lineHeight: 20
  },
  tokenCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(26,18,52,0.62)",
    gap: 10
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  openButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff7a94"
  },
  openButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.6
  },
  error: {
    color: "#ffd4d4",
    fontSize: 13
  },
  giftPanel: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(16,11,33,0.68)",
    gap: 12,
    marginTop: 4
  },
  sender: {
    color: "#efd9ff",
    fontSize: 13,
    fontWeight: "700"
  },
  flowerTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800"
  },
  dropCard: {
    borderRadius: 18,
    minHeight: 180,
    padding: 18,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  day: {
    color: "#ffe3f1",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  message: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600"
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  controlText: {
    color: "#decff4",
    fontSize: 12,
    fontWeight: "700"
  },
  backButton: {
    marginTop: "auto",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backText: {
    color: "#f7e7ff",
    fontWeight: "700",
    fontSize: 13
  }
});
