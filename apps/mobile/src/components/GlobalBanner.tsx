import { Pressable, StyleSheet, Text, View } from "react-native";

export function GlobalBanner({
  notice,
  error,
  onDismiss
}: {
  notice: string | null;
  error: string | null;
  onDismiss: () => void;
}) {
  if (!notice && !error) {
    return null;
  }

  const isError = Boolean(error);
  return (
    <View style={[styles.banner, isError ? styles.errorBanner : styles.noticeBanner]}>
      <Text style={[styles.text, isError ? styles.errorText : styles.noticeText]}>{error ?? notice}</Text>
      <Pressable onPress={onDismiss}>
        <Text style={[styles.dismiss, isError ? styles.errorText : styles.noticeText]}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  noticeBanner: {
    backgroundColor: "#eef8ef",
    borderColor: "#b7d4bc"
  },
  errorBanner: {
    backgroundColor: "#fff3f0",
    borderColor: "#e7b4ab"
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600"
  },
  noticeText: {
    color: "#2f5b38"
  },
  errorText: {
    color: "#8a352b"
  },
  dismiss: {
    fontSize: 12,
    fontWeight: "700"
  }
});
