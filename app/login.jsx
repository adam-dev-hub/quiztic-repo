import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { showToast } from "../lib/toasthelper"
import Toast from 'react-native-toast-message';
import { account } from "../lib/appwrite";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import SmartText from "../components/SmartText";

const { width } = Dimensions.get('window');

const Login = () => {
  const router = useRouter();
  const { login, loading: authLoading } = useUser();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    const { email, password } = formData;

    if (!email || !password) {
      showToast("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      try {
        await account.deleteSession("current");
      } catch (e) {
        console.log("No current session to delete:", e.message);
      }

      const currentUser = await login(email, password);
      const userType = currentUser.prefs?.userType || "student";
      router.replace(`/${userType}Dashboard`);
    } catch (error) {
      console.log("Login Error:", error); 
      if (error.code === 401) {
        showToast("Invalid email or password");
      } else if (error.code === 409) {
        showToast("Email not verified. Please check your inbox.");
      } else {
        showToast("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <LinearGradient colors={["#6c5ce7", "#a29bfe"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={styles.background}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header with Lottie Animation */}
              <LinearGradient colors={["#6c5ce7", "#a29bfe"]} style={styles.headerContainer}>
                <View style={styles.headerContent}>
                  <View style={styles.leftSection}>
                    <View style={styles.textSection}>
                      <SmartText style={styles.headerTitle}>Student Portal Screen</SmartText>
                      <SmartText style={styles.headerSubtitle}>Sign in to continue learning</SmartText>
                    </View>
                  </View>

                  <View style={styles.rightSection}>
                    <View style={styles.lottieContainer}>
                      <LottieView
                        source={require('../animations/signin.json')} // Add your student lottie file
                        autoPlay
                        loop
                        style={styles.lottieAnimation}
                      />
                    </View>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="University Email"
                    placeholderTextColor="#999"
                    value={formData.email}
                    onChangeText={(text) => handleChange("email", text)}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color="#6c5ce7"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#999"
                    value={formData.password}
                    onChangeText={(text) => handleChange("password", text)}
                    secureTextEntry={secureEntry}
                    style={styles.input}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)} style={styles.eyeIcon}>
                    <Ionicons
                      name={secureEntry ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <SmartText style={styles.buttonText}>Sign In</SmartText>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.linksContainer}>
                  <TouchableOpacity onPress={() => router.push("/forgotPassword")}>
                    <SmartText style={styles.linkText}>Forgot password?</SmartText>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.push("/inscription")}>
                    <SmartText style={styles.linkText}>
                      <SmartText style={styles.linkText}>Don't have an account? </SmartText>
                      <SmartText style={styles.linkHighlight}>Sign up</SmartText>
                    </SmartText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Fixed Bottom Section - Similar to index */}
            <View style={styles.fixedBottomSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push("/")}
              >
                <SmartText style={styles.actionButtonText}>I'm not a Student</SmartText>
                <Ionicons name="help-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#6c5ce7",
  },
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Add space for fixed bottom section
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 80,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 15,
  },
  rightSection: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  logoLine: {
    marginTop: 8,
    width: 120,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
    transform: [
      { translateX: -2 },
      { translateY: -35 },
    ],
  },
  textSection: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    width: '100%',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    textAlign: 'left',
  },
  lottieContainer: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  lottieAnimation: {
    width: 100,
    height: 100,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 25,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
    borderColor: "#eee",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#333",
    fontFamily: "Arial",
  },
  eyeIcon: {
    padding: 10,
    marginLeft: 5,
  },
  button: {
    height: 55,
    backgroundColor: "#6c5ce7",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: "row",
  },
  buttonDisabled: {
    backgroundColor: "#b2b2b2",
    shadowColor: "#b2b2b2",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    marginRight: 8,
  },
  linksContainer: {
    marginTop: 25,
    alignItems: "center",
  },
  linkText: {
    color: "#7f8c8d",
    fontSize: 14,
    marginBottom: 15,
  },
  linkHighlight: {
    color: "#6c5ce7",
    fontWeight: "600",
  },
  fixedBottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  actionButton: {
    backgroundColor: '#6c5ce7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 15,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
});

export default Login;