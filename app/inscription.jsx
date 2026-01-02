import React, { useState, useEffect } from "react";
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import SmartText from "../components/SmartText";

const { width } = Dimensions.get('window');

const Inscription = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    stcin: "",
    stmail: "",
    stpass: "",
    confirmPassword: "",
    stname: "",
    stfamilyname: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirmEntry, setSecureConfirmEntry] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    // Check if all fields are filled to enable/disable the button
    const { stcin, stmail, stpass, confirmPassword, stname, stfamilyname } = formData;
    const allFieldsFilled = 
      stcin.trim() !== "" &&
      stmail.trim() !== "" &&
      stpass.trim() !== "" &&
      confirmPassword.trim() !== "" &&
      stname.trim() !== "" &&
      stfamilyname.trim() !== "";
    
    setIsFormValid(allFieldsFilled);
  }, [formData]);

  const validateUCAREmail = (email) => {
    return /^[a-zA-Z0-9._-]+@istic\.ucar\.tn$/.test(email);
  };

  const validateCIN = (cin) => {
    return /^[0-9]{8}$/.test(cin);
  };

  const validateForm = () => {
    const { stcin, stmail, stpass, confirmPassword, stname, stfamilyname } = formData;

    if (!stname.trim()) return "First name is required.";
    if (!stfamilyname.trim()) return "Family name is required.";
    if (!stcin) return "CIN is required.";
    else if (!validateCIN(stcin)) return "CIN must be 8 digits.";
    if (!stmail) return "UCAR email is required.";
    else if (!validateUCAREmail(stmail)) return "Invalid UCAR email format.";
    if (!stpass) return "Password is required.";
    else if (stpass.length < 8) return "Password must be at least 8 characters.";
    if (!confirmPassword) return "Please confirm your password.";
    else if (stpass !== confirmPassword) return "Passwords don't match.";

    return null; // Form is valid
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      showToast(validationMessage);
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        cin: formData.stcin,
        ucarMail: formData.stmail,
        password: formData.stpass,
        name: formData.stname,
        familyName: formData.stfamilyname
      };

      const response = await fetch(
        "https://repo-gamma-ten.vercel.app/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Server Error: ${response.status}`);
      }

      if (!data.success) {
        showToast(data.message || "Registration failed.");
        return;
      }

      showToast(data.message || "Registration successful. Please verify your email.");
      router.replace("/login");
    } catch (error) {
      showToast(error.message || "Registration failed. Please try again.");
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
                      <SmartText style={styles.headerTitle}>Student Registration Screen</SmartText>
                      <SmartText style={styles.headerSubtitle}>Create your account to get started</SmartText>
                    </View>
                  </View>

                  <View style={styles.rightSection}>
                    <View style={styles.lottieContainer}>
                      <LottieView
                        source={require('../animations/verification.json')} // Verification lottie file
                        autoPlay
                        loop
                        style={styles.lottieAnimation}
                      />
                    </View>
                  </View>
                </View>
              </LinearGradient>

              {/* Form Section */}
              <View style={styles.formContainer}>
                {/* Name Inputs */}
                <View style={styles.nameRow}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <TextInput
                      placeholder="First Name"
                      placeholderTextColor="#999"
                      value={formData.stname}
                      onChangeText={(text) => handleChange("stname", text)}
                      style={styles.input}
                    />
                    <SmartText style={styles.requiredStar}>*</SmartText>
                  </View>

                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <TextInput
                      placeholder="Family Name"
                      placeholderTextColor="#999"
                      value={formData.stfamilyname}
                      onChangeText={(text) => handleChange("stfamilyname", text)}
                      style={styles.input}
                    />
                    <SmartText style={styles.requiredStar}>*</SmartText>
                  </View>
                </View>

                {/* CIN Input */}
                <View style={styles.inputContainerSlim}>
                  <Ionicons name="card-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Your ID"
                    placeholderTextColor="#999"
                    value={formData.stcin}
                    onChangeText={(text) => handleChange("stcin", text)}
                    style={styles.inputWithIcon}
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                  <SmartText style={styles.requiredStar}>*</SmartText>
                </View>

                {/* Email Input */}
                <View style={styles.inputContainerSlim}>
                  <Ionicons name="mail-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="University Email"
                    placeholderTextColor="#999"
                    value={formData.stmail}
                    onChangeText={(text) => handleChange("stmail", text)}
                    style={styles.inputWithIcon}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <SmartText style={styles.requiredStar}>*</SmartText>
                </View>

                {/* Password Input */}
                <View style={styles.inputContainerSlim}>
                  <Ionicons name="lock-closed-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#999"
                    value={formData.stpass}
                    onChangeText={(text) => handleChange("stpass", text)}
                    secureTextEntry={secureEntry}
                    style={styles.inputWithIcon}
                  />
                  <SmartText style={styles.requiredStar}>*</SmartText>
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

                {/* Confirm Password Input */}
                <View style={styles.inputContainerSlim}>
                  <Ionicons name="lock-closed-outline" size={22} color="#6c5ce7" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Confirm Password"
                    placeholderTextColor="#999"
                    value={formData.confirmPassword}
                    onChangeText={(text) => handleChange("confirmPassword", text)}
                    secureTextEntry={secureConfirmEntry}
                    style={styles.inputWithIcon}
                    onSubmitEditing={handleRegister}
                  />
                  <SmartText style={styles.requiredStar}>*</SmartText>
                  <TouchableOpacity
                    onPress={() => setSecureConfirmEntry(!secureConfirmEntry)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={secureConfirmEntry ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>

                {/* Register Button */}
                <TouchableOpacity
                  style={[styles.button, (!isFormValid || isLoading) && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <SmartText style={styles.buttonText}>Create Account</SmartText>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Fixed Bottom Section */}
            <View style={styles.fixedBottomSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push("/login")}
              >
                <SmartText style={styles.actionButtonText}>Already have an account? </SmartText>
                <Ionicons name="log-in" size={20} color="#fff" />
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
    paddingBottom: 100, // Add space for fixed bottom section
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
    width: 80,
    height: 80,
  },
  formContainer: {
    paddingHorizontal: 25,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 10, // Reduced margin
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10, // Reduced margin
    height: 55,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#eee",
  },
  inputContainerSlim: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10, // Reduced margin to bring inputs closer
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
  inputWithIcon: {
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
  requiredStar: {
    color: "red",
    fontSize: 18,
    marginLeft: 5,
  },
  button: {
    height: 55,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
    opacity: 0.6,
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

export default Inscription;