import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from "expo-router";
import { UserProvider } from "../contexts/UserContext";
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Text as DefaultText, TextInput as DefaultTextInput, LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { toastConfig } from '../lib/toast';
import { useEffect } from 'react';
import React from 'react';

// Import LanguageProvider
import { LanguageProvider } from "../contexts/LanguageContext";

LogBox.ignoreLogs([
  'Text strings must be rendered',
  'Realtime got disconnected. Reconnect will be attempted in 1 seconds. null',
  'VirtualizedLists should never be nested inside plain ScrollViews with the same orientation because it can break windowing and other functionality - use another VirtualizedList-backed container instead.',
  'Error: INVALID_STATE_ERR, js engine: hermes',
]);

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  useEffect(() => {
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
  }, []);

  const [fontsLoaded] = useFonts({
    'Ubuntu': require('../assets/fonts/Ubuntu-Regular.ttf'),
    'Ubuntu-Bold': require('../assets/fonts/Ubuntu-Bold.ttf'),
    'Ubuntu-Italic': require('../assets/fonts/Ubuntu-Italic.ttf'),
    'Ubuntu-Light': require('../assets/fonts/Ubuntu-Light.ttf'),
  });

  // Set global font for all Text and TextInput
  if (fontsLoaded) {
    DefaultText.defaultProps = {
      ...(DefaultText.defaultProps || {}),
      style: [{ fontFamily: 'Ubuntu' }, DefaultText.defaultProps?.style],
    };

    DefaultTextInput.defaultProps = {
      ...(DefaultTextInput.defaultProps || {}),
      style: [{ fontFamily: 'Ubuntu' }, DefaultTextInput.defaultProps?.style],
    };
  }

  if (!fontsLoaded) return null;

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <UserProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="studentFiles/quizQuestionScreen" />
              <Stack.Screen name="login" />
              <Stack.Screen name="inscription" />
              <Stack.Screen name="forgotPassword" />
              <Stack.Screen name="professor-login" />
              <Stack.Screen name="reset-password" />
              <Stack.Screen name="studentDashboard" />
              <Stack.Screen name="professorDashboard" />
              <Stack.Screen name="studentFiles/studentProfile" />
              <Stack.Screen name="studentFiles/studentQuizs" />
              <Stack.Screen name="professorFiles/professorCourses" />
              <Stack.Screen name="professorFiles/professorProfile" />
              <Stack.Screen name="studentFiles/studentCourses" />
              <Stack.Screen name="studentFiles/takeQuiz" />
              <Stack.Screen name="studentFiles/quizSummary" />
              <Stack.Screen name="studentFiles/quizResultsReview" />
              <Stack.Screen name="professorFiles/configureQuiz" />
              <Stack.Screen name="professorFiles/beginQuiz" />
              <Stack.Screen name="professorFiles/liveQuiz" />
              <Stack.Screen name="professorFiles/professorClassrooms" />
              <Stack.Screen name="professorFiles/professorAttendance" />
              <Stack.Screen name="professorFiles/quiz-history" />
              <Stack.Screen name="professorFiles/create-class" />
              <Stack.Screen name="professorFiles/planify-class" />
            </Stack>
          </UserProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
      <Toast config={toastConfig} />
    </>
  );
}