import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { FlowersProvider } from "./src/flowers/FlowersContext";
import { AuthStackParamList, AppStackParamList } from "./src/navigation/types";
import { RequestOtpScreen } from "./src/screens/RequestOtpScreen";
import { VerifyOtpScreen } from "./src/screens/VerifyOtpScreen";
import { OpenGiftScreen } from "./src/screens/OpenGiftScreen";
import { FlowersListScreen } from "./src/screens/FlowersListScreen";
import { CreateFlowerScreen } from "./src/screens/CreateFlowerScreen";
import { FlowerDetailScreen } from "./src/screens/FlowerDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { GlobalBanner } from "./src/components/GlobalBanner";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppNavigation() {
  const { initializing, currentUser, notice, error, clearBanner } = useAuth();

  if (initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCard}>
          <Text style={styles.title}>Loading...</Text>
          <ActivityIndicator color="#4a6b4f" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <NavigationContainer>
        {currentUser ? (
          <FlowersProvider>
            <AppStack.Navigator>
              <AppStack.Screen name="FlowersList" component={FlowersListScreen} options={{ title: "Flowers" }} />
              <AppStack.Screen name="CreateFlower" component={CreateFlowerScreen} options={{ title: "Create" }} />
              <AppStack.Screen name="FlowerDetail" component={FlowerDetailScreen} options={{ title: "Flower" }} />
              <AppStack.Screen name="OpenGift" component={OpenGiftScreen} options={{ title: "Open Gift" }} />
              <AppStack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
            </AppStack.Navigator>
          </FlowersProvider>
        ) : (
          <AuthStack.Navigator>
            <AuthStack.Screen name="RequestOtp" component={RequestOtpScreen} options={{ title: "Sign In" }} />
            <AuthStack.Screen
              name="VerifyOtp"
              component={VerifyOtpScreen}
              options={{ title: "Verify OTP", headerBackVisible: false, gestureEnabled: false }}
            />
            <AuthStack.Screen name="OpenGift" component={OpenGiftScreen} options={{ title: "Open Gift" }} />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
      <GlobalBanner notice={notice} error={error} onDismiss={clearBanner} />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: "#f6f4ef",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  loadingCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    gap: 12
  },
  title: {
    fontSize: 24,
    color: "#2d2a24",
    fontWeight: "700"
  }
});
