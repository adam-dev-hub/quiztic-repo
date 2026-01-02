// app/reset-password.jsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { toast } from '../lib/toast';
import { account } from '../lib/appwrite';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import SmartText from "../components/SmartText";

export default function ResetPassword() {
  const router = useRouter();
  const { userId, secret } = useLocalSearchParams(); // Gets userId and secret from the deep link URL
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirmEntry, setSecureConfirmEntry] = useState(true);

  useEffect(() => {
    // Basic check to ensure params are present, though Appwrite handles link validity
    if (!userId || !secret) {
      showToast("Invalid or missing reset link parameters. Please try again.");
      router.replace('/login'); // Redirect if params are missing
    }
  }, [userId, secret]);

  const handlePasswordUpdate = async () => {
    if (!newPassword || !confirmPassword) {
      showToast("Please fill in both password fields.");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      // Call Appwrite's updateRecovery function
      await account.updateRecovery(
        userId,
        secret,
        newPassword,
        confirmPassword // Appwrite expects confirmation for consistency
      );
      showToast("Password successfully reset! You can now log in with your new password.");
      router.replace('/login'); // Go to login after successful reset
    } catch (e) {
      console.error("Password reset error:", e);
      let errorMessage = "Failed to reset password. The link might be expired or invalid.";
      if (e.message && e.message.includes('Invalid credentials') || e.message.includes('User not found')) {
        errorMessage = "Invalid or expired reset link. Please request a new one.";
      }
      showToast(errorMessage);
      // Optionally redirect to forgot password or login on error
      router.replace('/forgotPassword');
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId || !secret) {
    // Show a loading or error state while checking parameters
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <SmartText style={styles.loadingText}>Verifying reset link...</SmartText>
      </View>
    );
  }

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
                <SmartText style={styles.headerTitle}>Set New Password</SmartText>
                <SmartText style={styles.headerSubtitle}>
                  Enter your new password below.
                </SmartText>
              </LinearGradient>

              <View style={styles.formContainer}>
                {/* New Password Input */}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="New Password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={secureEntry}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureEntry(!secureEntry)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={secureEntry ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm New Password Input */}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Confirm New Password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={secureConfirmEntry}
                    style={styles.input}
                    onSubmitEditing={handlePasswordUpdate}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureConfirmEntry(!secureConfirmEntry)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={secureConfirmEntry ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handlePasswordUpdate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <SmartText style={styles.buttonText}>Reset Password</SmartText>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
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
    justifyContent: 'center',
    paddingBottom: 40,
  },
  headerContainer: {
    padding: 30,
    paddingTop: 25,
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
  eyeIcon: {
    padding: 10,
    marginLeft: 5,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#7f8c8d',
    fontSize: 16,
  },
});