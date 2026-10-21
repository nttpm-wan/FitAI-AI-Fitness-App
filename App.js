import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { subscribeAuth } from "./firebase/auth";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { installGlobalErrorHandler, trackScreen } from "./services/telemetry";
import CameraAIScreen from "./screens/CameraAIScreen";
import ChallengesScreen from "./screens/ChallengesScreen";
import CommunityScreen from "./screens/CommunityScreen";
import ExerciseLibraryScreen from "./screens/ExerciseLibraryScreen";
import GoalsScreen from "./screens/GoalsScreen";
import HomeScreen from "./screens/HomeScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import LoginScreen from "./screens/LoginScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import NutritionScreen from "./screens/NutritionScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProgressScreen from "./screens/ProgressScreen";
import RegisterScreen from "./screens/RegisterScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SleepTrackerScreen from "./screens/SleepTrackerScreen";
import WorkoutDetailScreen from "./screens/WorkoutDetailScreen";
import WorkoutHistoryScreen from "./screens/WorkoutHistoryScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const palette = {
  background: "#0D0D0F",
  card: "#171719",
  text: "#F4F4F5",
  border: "#29292D",
  primary: "#FF6B1A",
  muted: "#8B8B91",
};

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.background, card: palette.card, text: palette.text, border: palette.border, primary: palette.primary },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.card, borderTopColor: palette.border, height: 62, paddingTop: 5, paddingBottom: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarIcon: ({ focused }) => {
          const icons = { Home: "⌂", Nutrition: "◉", Progress: "↗", Community: "◎", Profile: "●" };
          return <Text style={{ color: focused ? palette.primary : palette.muted, fontSize: 19 }}>{icons[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "หน้าแรก" }} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} options={{ title: "อาหาร" }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: "ความคืบหน้า" }} />
      <Tab.Screen name="Community" component={CommunityScreen} options={{ title: "ชุมชน" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "โปรไฟล์" }} />
    </Tab.Navigator>
  );
}

function AppNavigator({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
          <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="SleepTracker" component={SleepTrackerScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="CameraAI" component={CameraAIScreen} />
          <Stack.Screen name="Challenges" component={ChallengesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const routeNameRef = useRef(null);

  useEffect(() => {
    const uninstallErrorHandler = installGlobalErrorHandler();
    const unsubscribe = subscribeAuth((nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
    return () => {
      uninstallErrorHandler();
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        {ready ? (
          <NavigationContainer
            ref={navigationRef}
            theme={theme}
            onReady={() => {
              routeNameRef.current = navigationRef.getCurrentRoute()?.name || null;
              if (routeNameRef.current) void trackScreen(routeNameRef.current);
            }}
            onStateChange={() => {
              const nextRoute = navigationRef.getCurrentRoute()?.name || null;
              if (nextRoute && nextRoute !== routeNameRef.current) void trackScreen(nextRoute);
              routeNameRef.current = nextRoute;
            }}
          >
          <AppNavigator user={user} />
          </NavigationContainer>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.background }}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
