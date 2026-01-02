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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { showToast } from "../lib/toasthelper"
import { Databases, Query, Account } from "react-native-appwrite";
import { client } from "../lib/appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import SmartText from "../components/SmartText";

const { width } = Dimensions.get('window');

export default function ProfessorLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  // Initialisation des services Appwrite
  const databases = new Databases(client);
  const account = new Account(client);
  const DATABASE_ID = "685ae2ba0012dcb2feda";
  const PROFESSORS_COLLECTION_ID = "685ae2d80031c0e9b7f3";

  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  /**
   * Gère la connexion sécurisée du professeur.
   */
  const handleLogin = async () => {
    const { email, password } = formData;
    if (!email || !password) {
      showToast("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      // Always log out any existing session before login
      try {
        await account.deleteSession('current');
      } catch (logoutErr) {
        // Ignore if no session exists
      }
      // 1. Vérifier si l'utilisateur est bien un professeur autorisé
      const professorCheck = await databases.listDocuments(
        DATABASE_ID,
        PROFESSORS_COLLECTION_ID,
        [Query.equal("profmail", email)]
      );

      if (professorCheck.total === 0) {
        showToast("Access denied: You are not listed as a professor.");
        setIsLoading(false);
        return;
      }

      // 2. Tenter de créer une session sécurisée avec Appwrite
      // Appwrite gère le hachage et la comparaison des mots de passe.
      await account.createEmailPasswordSession(email, password);

      // Si la connexion réussit :
      showToast("Login successful!");
      router.replace("/professorDashboard");

    } catch (e) {
      console.log("Login error:", e);
      // Gérer les erreurs spécifiques d'Appwrite
      if (e.code === 401) { // 401: Invalid credentials
        showToast("Invalid email or password.");
      } else if (e.code === 429) { // 429: Too many requests
        showToast("Too many login attempts. Please try again later.");
      }
       else {
        showToast("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6366f1" barStyle="light-content" />
      <LinearGradient colors={['#f5f5f5', '#e0e0e0']} style={styles.background}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header with Lottie Animation */}
              <LinearGradient colors={["#4f46e5", "#7b84f0"]} style={styles.headerContainer}>
                <View style={styles.headerContent}>
                  <View style={styles.leftSection}>
                    <View style={styles.textSection}>
                      <SmartText style={styles.headerTitle}>Professor Portal Screen</SmartText>
                      <SmartText style={styles.headerSubtitle}>Sign in to access your dashboard</SmartText>
                    </View>
                  </View>

                  <View style={styles.rightSection}>
                    <View style={styles.lottieContainer}>
                      <LottieView
                        source={require('../animations/signin.json')} // Professor lottie file
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
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color="#6366f1"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Institutional Email"
                    placeholderTextColor="#999"
                    value={formData.email}
                    onChangeText={(t) => handleChange("email", t)}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleLogin}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color="#6366f1"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#999"
                    value={formData.password}
                    onChangeText={(t) => handleChange("password", t)}
                    secureTextEntry={secureEntry}
                    style={styles.input}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureEntry(!secureEntry)}
                    style={styles.eyeIcon}
                  >
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

                <SmartText style={styles.infoText}>
                  Contact the administrator if you need access
                </SmartText>
              </View>
            </ScrollView>

            {/* Fixed Bottom Section */}
            <View style={styles.fixedBottomSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push("/")}
              >
                <SmartText style={styles.actionButtonText}>I'm not a Professor</SmartText>
                <Ionicons name="help-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6366f1',
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
  headerContainer: {
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 30,
    shadowColor: "#6366f1",
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
    backgroundColor: '#6366f1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: "#6366f1",
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
  infoText: {
    marginTop: 25,
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 15,
    shadowColor: "#6366f1",
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