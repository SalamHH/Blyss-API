import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { openFlowerByToken } from "@blyss/shared";
import { API_BASE_URL } from "../config";
import { getUserErrorMessage } from "../lib/errorMessages";

let LottieView: React.ComponentType<{
  source: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: object;
  colorFilters?: Array<{ keypath: string; color: string }>;
}> | null = null;
try {
  LottieView = require("lottie-react-native").default;
} catch {
  LottieView = null;
}

type OpenGiftOnlyParamList = {
  OpenGift: undefined;
};

type Props = NativeStackScreenProps<OpenGiftOnlyParamList, "OpenGift">;

type Palette = {
  bg: string;
  panel: string;
  accent: string;
  text: string;
  subtext: string;
};

type FlowerDropNodeProps = {
  day: number;
  x: number;
  y: number;
  viewed: boolean;
  onPress: () => void;
};

const BOUQUET_CANVAS_SIZE = 980;
const FLOWER_SIZE = 88;
const MIN_SCALE = 0.68;
const MAX_SCALE = 1.95;

const palettes: Palette[] = [
  { bg: "#15162d", panel: "#2c1f58", accent: "#ff8fab", text: "#ffffff", subtext: "#ded9ff" },
  { bg: "#102022", panel: "#18373c", accent: "#ffbe5c", text: "#ecfffb", subtext: "#bee8df" },
  { bg: "#1d1321", panel: "#40224d", accent: "#7ce8f3", text: "#f9f2ff", subtext: "#d9caef" },
  { bg: "#17231d", panel: "#274a32", accent: "#ffd670", text: "#f1fff5", subtext: "#d0ead8" },
  { bg: "#0f1f37", panel: "#203d67", accent: "#ff9f7d", text: "#f2f7ff", subtext: "#c8d6f6" }
];

function clampValue(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

function FlowerDropNode({ day, x, y, viewed, onPress }: FlowerDropNodeProps) {
  const viewedProgress = useSharedValue(viewed ? 1 : 0);
  const bloom = useSharedValue(0);

  useEffect(() => {
    viewedProgress.value = withTiming(viewed ? 1 : 0, { duration: 320 });
  }, [viewed, viewedProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      viewedProgress.value,
      [0, 1],
      ["rgba(255,155,201,0.36)", "rgba(160,244,228,0.34)"]
    );
    const borderColor = interpolateColor(
      viewedProgress.value,
      [0, 1],
      ["rgba(255,238,246,0.78)", "rgba(205,255,248,0.9)"]
    );
    const scale = 1 + bloom.value * 0.22 + viewedProgress.value * 0.06;
    return {
      backgroundColor,
      borderColor,
      transform: [{ scale }]
    };
  });

  const handlePress = () => {
    bloom.value = withSequence(
      withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 9, stiffness: 140 })
    );
    onPress();
  };

  return (
    <Pressable
      style={[
        styles.flowerNodeTouch,
        {
          left: x - FLOWER_SIZE / 2,
          top: y - FLOWER_SIZE / 2,
          width: FLOWER_SIZE,
          height: FLOWER_SIZE
        }
      ]}
      onPress={handlePress}
      hitSlop={8}
    >
      <Animated.View style={[styles.flowerNode, animatedStyle]}>
        <Text style={styles.flowerNodeDay}>DAY {day}</Text>
        <Text style={styles.flowerNodePetal}>{viewed ? "✿" : "❀"}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function OpenGiftScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<Awaited<ReturnType<typeof openFlowerByToken>> | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [viewedDropIds, setViewedDropIds] = useState<Record<number, true>>({});

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const bouquetReveal = useSharedValue(0);
  const storyProgress = useSharedValue(0);

  const playFeedback = useCallback(async (kind: "tap" | "success") => {
    try {
      const Haptics = require("expo-haptics");
      if (kind === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics package optional.
    }

  }, []);

  const bouquetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bouquetReveal.value,
    transform: [
      { translateY: interpolate(bouquetReveal.value, [0, 1], [24, 0]) }
    ]
  }));

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }]
  }));

  const storyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: storyProgress.value,
    transform: [{ translateY: interpolate(storyProgress.value, [0, 1], [40, 0]) }]
  }));

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = clampValue(pinchStartScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      scale.value = next;
    });

  const bouquetGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const openGift = useCallback(async () => {
    if (!token.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await openFlowerByToken(token.trim(), API_BASE_URL);
      setGift(data);
      setActiveDropIndex(null);
      setViewedDropIds({});

      translateX.value = withTiming(0, { duration: 280 });
      translateY.value = withTiming(0, { duration: 280 });
      scale.value = withTiming(1, { duration: 280 });
      bouquetReveal.value = 0;
      bouquetReveal.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });

      void playFeedback("success");
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not open gift. Check the token and try again."));
      setGift(null);
    } finally {
      setLoading(false);
    }
  }, [bouquetReveal, playFeedback, scale, token, translateX, translateY]);

  const openDrop = useCallback(
    (index: number) => {
      if (!gift || index < 0 || index >= gift.drops.length) {
        return;
      }
      setActiveDropIndex(index);
      setViewedDropIds((prev) => ({ ...prev, [gift.drops[index].id]: true }));
      storyProgress.value = 0;
      storyProgress.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
      void playFeedback("tap");
    },
    [gift, playFeedback, storyProgress]
  );

  const closeDropStory = useCallback(() => {
    storyProgress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(setActiveDropIndex)(null);
      }
    });
  }, [storyProgress]);

  const moveStoryIndex = useCallback(
    (delta: number) => {
      if (!gift || activeDropIndex === null) {
        return;
      }
      const next = activeDropIndex + delta;
      if (next < 0 || next >= gift.drops.length) {
        return;
      }
      setActiveDropIndex(next);
      setViewedDropIds((prev) => ({ ...prev, [gift.drops[next].id]: true }));
      storyProgress.value = 0;
      storyProgress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      void playFeedback("tap");
    },
    [activeDropIndex, gift, playFeedback, storyProgress]
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (activeDropIndex === null) {
        return;
      }
      event.preventDefault();
      closeDropStory();
    });
    return unsubscribe;
  }, [activeDropIndex, closeDropStory, navigation]);

  useEffect(() => {
    bouquetReveal.value = withTiming(1, { duration: 360 });
  }, [bouquetReveal]);

  const flowerPositions = useMemo(() => {
    if (!gift) {
      return [] as Array<{ x: number; y: number }>;
    }

    const center = BOUQUET_CANVAS_SIZE / 2;
    return gift.drops.map((_, index) => {
      const angle = (index * 137.5 * Math.PI) / 180;
      const radius = 72 + Math.sqrt(index + 1) * 58;
      return {
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius
      };
    });
  }, [gift]);

  const activeDrop = useMemo(() => {
    if (!gift || activeDropIndex === null) {
      return null;
    }
    return gift.drops[activeDropIndex] ?? null;
  }, [activeDropIndex, gift]);

  const activePalette = useMemo(() => {
    if (activeDropIndex === null) {
      return palettes[0];
    }
    return palettes[activeDropIndex % palettes.length];
  }, [activeDropIndex]);

  const progress = useMemo(() => {
    if (!gift || activeDropIndex === null || gift.drops.length === 0) {
      return 0;
    }
    return (activeDropIndex + 1) / gift.drops.length;
  }, [activeDropIndex, gift]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[StyleSheet.absoluteFill, styles.backdropBase]} pointerEvents="none">
        {LottieView ? (
          <>
            <View style={[styles.lottieBloomWrap, { left: width * 0.01, top: height * 0.12 }]}>
              <LottieView
                source={require("../../assets/lottie/flower-bloom.json")}
                autoPlay
                loop
                speed={0.46}
                style={styles.lottieBloom}
                colorFilters={[
                  { keypath: "Petal Fill", color: "#fcb7d5" },
                  { keypath: "Center Fill", color: "#ffe38e" }
                ]}
              />
            </View>
            <View style={[styles.lottieBloomWrap, { left: width * 0.57, top: height * 0.08 }]}>
              <LottieView
                source={require("../../assets/lottie/flower-bloom.json")}
                autoPlay
                loop
                speed={0.38}
                style={styles.lottieBloom}
                colorFilters={[
                  { keypath: "Petal Fill", color: "#b2e8ff" },
                  { keypath: "Center Fill", color: "#ffe29b" }
                ]}
              />
            </View>
            <View style={[styles.lottieBloomWrap, { left: width * 0.22, top: height * 0.6 }]}>
              <LottieView
                source={require("../../assets/lottie/flower-bloom.json")}
                autoPlay
                loop
                speed={0.52}
                style={styles.lottieBloom}
                colorFilters={[
                  { keypath: "Petal Fill", color: "#d4b8ff" },
                  { keypath: "Center Fill", color: "#ffdd7f" }
                ]}
              />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.blobA, { left: width * 0.02, top: height * 0.12 }]} />
            <View style={[styles.blobB, { left: width * 0.56, top: height * 0.1 }]} />
            <View style={[styles.blobC, { left: width * 0.2, top: height * 0.58 }]} />
          </>
        )}
      </View>

      <View style={styles.headerWrap}>
        <Text style={styles.kicker}>Blyss Gift</Text>
        <Text style={styles.title}>Wrapped Bouquet</Text>
        <Text style={styles.subtitle}>Pinch to zoom and glide around each memory flower.</Text>
      </View>

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
        <Animated.View style={[styles.bouquetPanel, bouquetAnimatedStyle]}>
          <View style={styles.bouquetHeader}>
            <View>
              <Text style={styles.sender}>From {gift.sender_name}</Text>
              <Text style={styles.flowerTitle}>{gift.title}</Text>
            </View>
            <View style={styles.counterChip}>
              <Text style={styles.counterText}>{gift.drops.length} drops</Text>
            </View>
          </View>

          <GestureDetector gesture={bouquetGesture}>
            <View style={styles.viewport}>
              <Animated.View
                style={[
                  styles.bouquetCanvas,
                  {
                    width: BOUQUET_CANVAS_SIZE,
                    height: BOUQUET_CANVAS_SIZE
                  },
                  canvasAnimatedStyle
                ]}
              >
                {gift.drops.map((drop, index) => {
                  const pos = flowerPositions[index];
                  return (
                    <FlowerDropNode
                      key={drop.id}
                      day={drop.day_number}
                      x={pos.x}
                      y={pos.y}
                      viewed={viewedDropIds[drop.id] === true}
                      onPress={() => openDrop(index)}
                    />
                  );
                })}
              </Animated.View>
            </View>
          </GestureDetector>

          <Text style={styles.controlHint}>Pinch to zoom • Drag to explore • Tap any flower to reveal</Text>
        </Animated.View>
      ) : null}

      {activeDrop ? (
        <Animated.View style={[styles.storyOverlay, { backgroundColor: activePalette.bg }, storyAnimatedStyle]}>
          <View style={[styles.storyPanel, { backgroundColor: activePalette.panel }]}> 
            <View style={styles.storyTopRow}>
              <Text style={[styles.storyKicker, { color: activePalette.subtext }]}>Day {activeDrop.day_number}</Text>
              <Text style={[styles.storyKicker, { color: activePalette.subtext }]}>Wrapped</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: activePalette.accent }]} />
            </View>
            <Text style={[styles.storyTitle, { color: activePalette.text }]}>{gift?.title}</Text>
            <Text style={[styles.storyMessage, { color: activePalette.text }]}>
              {activeDrop.message || "A quiet bloom."}
            </Text>

            <View style={styles.storyActions}>
              <Pressable
                style={[styles.storyButton, activeDropIndex === 0 && styles.storyButtonDisabled]}
                onPress={() => moveStoryIndex(-1)}
                disabled={activeDropIndex === 0}
              >
                <Text style={styles.storyButtonText}>Previous</Text>
              </Pressable>
              <Pressable style={styles.storyButton} onPress={closeDropStory}>
                <Text style={styles.storyButtonText}>Bouquet</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.storyButton,
                  gift && activeDropIndex === gift.drops.length - 1 && styles.storyButtonDisabled
                ]}
                onPress={() => moveStoryIndex(1)}
                disabled={gift ? activeDropIndex === gift.drops.length - 1 : true}
              >
                <Text style={styles.storyButtonText}>Next</Text>
              </Pressable>
            </View>
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
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(140,230,255,0.12)"
  },
  blobC: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(255,235,168,0.10)"
  },
  lottieBloomWrap: {
    position: "absolute",
    width: 180,
    height: 180,
    opacity: 0.62
  },
  lottieBloom: {
    width: "100%",
    height: "100%"
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
  bouquetPanel: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(16,11,33,0.68)",
    gap: 10,
    flex: 1,
    minHeight: 300
  },
  bouquetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sender: {
    color: "#efd9ff",
    fontSize: 13,
    fontWeight: "700"
  },
  flowerTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "800"
  },
  counterChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  counterText: {
    color: "#fff4ff",
    fontWeight: "700",
    fontSize: 12
  },
  viewport: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  bouquetCanvas: {
    position: "relative"
  },
  flowerNodeTouch: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  flowerNode: {
    width: FLOWER_SIZE,
    height: FLOWER_SIZE,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  flowerNodeDay: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7
  },
  flowerNodePetal: {
    fontSize: 22,
    color: "#ffffff",
    marginTop: 2
  },
  controlHint: {
    color: "#d6c7ee",
    fontSize: 12,
    fontWeight: "700"
  },
  storyOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 18,
    paddingTop: 90,
    paddingBottom: 30,
    justifyContent: "flex-start"
  },
  storyPanel: {
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)"
  },
  storyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  storyKicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999
  },
  storyTitle: {
    fontSize: 32,
    fontWeight: "800"
  },
  storyMessage: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    minHeight: 120
  },
  storyActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  storyButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center"
  },
  storyButtonDisabled: {
    opacity: 0.38
  },
  storyButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  backButton: {
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
