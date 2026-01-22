import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { showToast } from "../lib/toasthelper"
import Toast from 'react-native-toast-message';
import { account } from "../lib/appwrite"; 
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import SmartText from "../components/SmartText";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      showToast("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      // ⭐ CORRECTED: Define resetUrl and fallbackUrl BEFORE using them ⭐
      const resetUrl = `${process.env.EXPO_PUBLIC_APP_URL}/reset-password`;
      const fallbackUrl = `${process.env.EXPO_PUBLIC_APP_URL}/login`;

      // Now it's safe to log resetUrl
      console.log("URL being sent to Appwrite createRecovery:", resetUrl);

      await account.createRecovery(
        email,
        resetUrl, // Use the defined variable
        fallbackUrl // Use the defined variable
      );

      showToast("A password reset link has been sent to your email.");
      router.push("/login");
    } catch (e) {
      console.log("Forgot password error:", e);
      if (e.code === 404) {
        showToast("Email not found. Please check your email or register a new account.");
      } else {
        showToast("Failed to send reset link. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient
        colors={['#f5f5f5', '#e0e0e0']}
        style={styles.background}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <LinearGradient
                colors={['#6c5ce7', '#a29bfe']}
                style={styles.headerContainer}
              >
                <SmartText style={styles.headerTitle}>Forgot Password</SmartText>
                <SmartText style={styles.headerSubtitle}>
                  Enter your email to receive a password reset link.
                </SmartText>
              </LinearGradient>

              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color="#6c5ce7"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Your Email Address"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleResetPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <SmartText style={styles.buttonText}>Send Reset Link</SmartText>
                      <Ionicons name="send" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.push("/login")}
                >
                  <Ionicons name="arrow-back-outline" size={20} color="#6c5ce7" />
                  <SmartText style={styles.backToLoginText}>Back to Login</SmartText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6c5ce7',
  },
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 30,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 25,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 55,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontFamily: 'Arial',
  },
  button: {
    height: 55,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: 'row',
  },
  buttonDisabled: {
    backgroundColor: '#b2b2b2',
    shadowColor: "#b2b2b2",
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginRight: 8,
  },
  backToLoginButton: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  backToLoginText: {
    color: '#6c5ce7',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});
