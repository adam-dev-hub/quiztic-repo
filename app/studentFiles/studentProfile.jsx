import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput as RNTextInput,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { account, client } from "../../lib/appwrite";
import { Databases, Query } from "react-native-appwrite";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import LottieView from 'lottie-react-native';
import { showToast } from "../../lib/toasthelper"
import { useLanguage } from "../../contexts/LanguageContext";
import SmartText from "../../components/SmartText";


const DATABASE_ID = "685ae2ba0012dcb2feda";
const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254";

const { width } = Dimensions.get('window');

export default function StudentProfile() {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "jp", label: "日本語" },
];


  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stats, setStats] = useState({
    quizzesCompleted: 0,
    averageScore: 0,
    totalStudyTime: 0,
    accountAge: 0
  });
  const router = useRouter();

  // Move fetchStudent to component scope
  async function fetchStudent() {
    try {
      const user = await account.get();
      const email = user.email;
      const databases = new Databases(client);
      const response = await databases.listDocuments(
        DATABASE_ID,
        STUDENTS_COLLECTION_ID,
        [Query.equal("stmail", email)]
      );
      if (response.total > 0) {
        const s = response.documents[0];
        setStudent({
          stcin: s.stcin || "--",
          stname: s.stname || "--",
          stfamilyname: s.stfamilyname || "--",
          stmail: s.stmail || "--",
          stphone: s.stphone || "--",
          stdob: s.stdob || "--",
          stadress: s.stadress || "--",
          stavatar: s.stavatar || null,
        });
        
        // Fetch student stats (mock data for now)
        await fetchStudentStats();
      } else {
        setStudent(null);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }

  const fetchStudentStats = async () => {
    try {
      // Mock stats calculation
      const accountAge = Math.floor(Math.random() * 24) + 1; // 1-24 months
      
      setStats({
        quizzesCompleted: Math.floor(Math.random() * 50) + 10, // 10-60 quizzes
        averageScore: Math.floor(Math.random() * 30) + 70, // 70-100%
        totalStudyTime: Math.floor(Math.random() * 100) + 20, // 20-120 hours
        accountAge: accountAge
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, []);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast("Permission required: Permission to access media library is required!");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        setEditData((d) => ({ ...d, stavatar: pickerResult.assets[0].uri }));
      } else {
        showToast("Image selection was cancelled.");
      }
    } catch (error) {
      console.error("Error picking avatar:", error);
      showToast("Failed to pick an image.");
    }
  };

  const handleEditProfile = () => {
    setEditData({
      stcin: student.stcin !== "--" ? student.stcin : "",
      stname: student.stname !== "--" ? student.stname : "",
      stfamilyname: student.stfamilyname !== "--" ? student.stfamilyname : "",
      stphone: student.stphone !== "--" ? student.stphone : "",
      stdob: student.stdob !== "--" ? student.stdob : "",
      stadress: student.stadress !== "--" ? student.stadress : "",
      stavatar: student.stavatar || null,
    });
    setShowDatePicker(false);
    setEditModalVisible(true);
  };

  const handlePhoneChange = (v) => {
    const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
    setEditData((d) => ({ ...d, stphone: cleaned }));
  };

  const handleSaveProfile = async () => {
    if (editData.stphone.length !== 8) {
      showToast("Phone number must be exactly 8 digits.");
      return;
    }
    if (!editData.stdob) {
      showToast("Date of birth is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        update: true,
        stmail: student.stmail,
        stphone: editData.stphone,
        stdob: editData.stdob,
        stadress: editData.stadress,
        stavatar: editData.stavatar,
      };

      const response = await fetch("https://editstudent.vercel.app/api/hello.ts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error("Server error: " + text);
      }

      if (!response.ok || !data.success) {
        showToast(data.message || "Update failed");
      } else {
        setEditModalVisible(false);
        setLoading(true);
        await fetchStudent();
        showToast("Profile updated successfully!");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      showToast(error.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await account.deleteSessions();
              router.replace('/login');
            } catch (err) {
              console.error("Logout error:", err);
            }
          }
        }
      ]
    );
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const formatAccountAge = (months) => {
    if (months < 12) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
    return `${years}y ${remainingMonths}m`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe']}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <LottieView
              source={require('../../animations/loading_animation.json')}
              autoPlay
              loop
              style={styles.loadingAnimation}
            />
            <SmartText style={styles.loadingText}>Loading Profile...</SmartText>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
        <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="account-alert" size={80} color="#e74c3c" />
            <SmartText style={styles.errorText}>Student profile not found</SmartText>
            <SmartText style={styles.errorSubtext}>Unable to load your profile information</SmartText>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStudent}>
              <SmartText style={styles.retryBtnText}>Try Again</SmartText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <SmartText style={styles.logoutBtnText}>Logout</SmartText>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const profileStats = [
    {
      title: "Quizzes Completed",
      value: stats.quizzesCompleted,
      icon: "clipboard-check",
      color: "#6c5ce7"
    },
    {
      title: "Average Score",
      value: `${stats.averageScore}%`,
      icon: "trophy",
      color: "#f39c12"
    },
    {
      title: "Study Hours",
      value: `${stats.totalStudyTime}h`,
      icon: "clock",
      color: "#27ae60"
    },
    {
      title: "Account Age",
      value: formatAccountAge(stats.accountAge),
      icon: "calendar-clock",
      color: "#3498db"
    }
  ];

  const profileSections = [
    {
      title: "Personal Information",
      items: [
        { label: "Full Name", value: `${student.stname} ${student.stfamilyname}`, icon: "account" },
        { label: "Email", value: student.stmail, icon: "email" },
        { label: "CIN", value: student.stcin, icon: "card-account-details" },
        { label: "Phone", value: student.stphone, icon: "phone" }
      ]
    },
    {
      title: "Additional Details",
      items: [
        { label: "Date of Birth", value: student.stdob !== "--" ? student.stdob.split('T')[0] : "--", icon: "cake-variant" },
        { label: "Address", value: student.stadress, icon: "map-marker" }
      ]
    }
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false}} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
        <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>

          {/* Header */}
          <LinearGradient colors={["#6c5ce7", "#a29bfe"]} style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace('/studentDashboard')}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <SmartText style={styles.headerTitle}>Profile</SmartText>
              <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <MaterialCommunityIcons name="pencil" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri: student.stavatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        student.stname || "Avatar"
                      )}${
                        student.stfamilyname
                          ? "+" + encodeURIComponent(student.stfamilyname)
                          : ""
                      }&background=6c5ce7&color=fff&size=256`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.onlineIndicator} />
              </View>
              
              <View style={styles.profileInfo}>
                <SmartText style={styles.profileName}>
                  {student.stname} {student.stfamilyname}
                </SmartText>
                <SmartText style={styles.profileEmail}>{student.stmail}</SmartText>
                <SmartText style={styles.profileRole}>Student • Learning Journey</SmartText>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsContainer}>
              <SmartText style={styles.sectionTitle}>Overview</SmartText>
              <View style={styles.statsGrid}>
                {profileStats.map((stat, index) => (
                  <View key={index} style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                      <MaterialCommunityIcons name={stat.icon} size={24} color={stat.color} />
                    </View>
                    <SmartText style={styles.statValue}>{stat.value}</SmartText>
                    <SmartText style={styles.statTitle}>{stat.title}</SmartText>
                  </View>
                ))}
              </View>
            </View>

            {/* Information Sections */}
            {profileSections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={styles.infoSection}>
                <SmartText style={styles.sectionTitle}>{section.title}</SmartText>
                <View style={styles.infoCard}>
                  {section.items.map((item, itemIndex) => (
                    <View key={itemIndex}>
                      <View style={styles.infoItem}>
                        <View style={styles.infoIcon}>
                          <MaterialCommunityIcons name={item.icon} size={20} color="#6c5ce7" />
                        </View>
                        <View style={styles.infoDetails}>
                          <SmartText style={styles.infoLabel}>{item.label}</SmartText>
                          <SmartText style={styles.infoValue}>{item.value}</SmartText>
                        </View>
                      </View>
                      {itemIndex < section.items.length - 1 && <View style={styles.infoDivider} />}
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
                <MaterialCommunityIcons name="account-edit" size={20} color="#6c5ce7" />
                <SmartText style={styles.actionButtonText}>Edit Profile</SmartText>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#bdc3c7" />
              </TouchableOpacity>
              
              <TouchableOpacity
  style={styles.actionButton}
  onPress={() => setLanguageMenuVisible(true)}
>
  <MaterialCommunityIcons name="translate" size={20} color="#6c5ce7" />
  <SmartText style={styles.actionButtonText}>
    <SmartText>Language</SmartText>
    {": "}
    <SmartText>
      {currentLanguage === 'en' ? 'English' : 
       currentLanguage === 'fr' ? 'Français' : 
       currentLanguage === 'jp' ? '日本語' : 'العربية'}
    </SmartText>
  </SmartText>
  <MaterialCommunityIcons name="chevron-right" size={20} color="#bdc3c7" />
</TouchableOpacity>

              
              <TouchableOpacity style={styles.actionButton}>
                <MaterialCommunityIcons name="help-circle" size={20} color="#6c5ce7" />
                <SmartText style={styles.actionButtonText}>Help & Support</SmartText>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#bdc3c7" />
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View style={styles.logoutSection}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                <SmartText style={styles.logoutButtonText}>Logout</SmartText>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </LinearGradient>

        {/* Edit Modal */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <SmartText style={styles.modalTitle}>Edit Profile</SmartText>
              
              <View style={styles.avatarEditContainer}>
                <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7} style={styles.avatarEditButton}>
                  <Image
                    source={{
                      uri: editData.stavatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          editData.stname || "Avatar"
                        )}${
                          editData.stfamilyname
                            ? "+" + encodeURIComponent(editData.stfamilyname)
                            : ""
                        }&background=6c5ce7&color=fff&size=256`,
                    }}
                    style={styles.avatarEdit}
                  />
                  <View style={styles.cameraIcon}>
                    <Ionicons name="camera" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
                <SmartText style={styles.avatarEditText}>
                  {editData.stavatar ? "Change Avatar" : "Pick Avatar"}
                </SmartText>
              </View>

              <View style={styles.inputContainer}>
                <RNTextInput
                  placeholder="CIN"
                  value={editData.stcin}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                />
                <RNTextInput
                  placeholder="First Name"
                  value={editData.stname}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                />
                <RNTextInput
                  placeholder="Family Name"
                  value={editData.stfamilyname}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                />
                <RNTextInput
                  placeholder="Phone"
                  value={editData.stphone}
                  onChangeText={handlePhoneChange}
                  keyboardType="numeric"
                  maxLength={8}
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateInput}
                >
                  <SmartText style={[styles.dateText, { color: editData.stdob ? "#2c3e50" : "#bdc3c7" }]}>
                    {editData.stdob ? editData.stdob.split('T')[0] : "Date of Birth"}
                  </SmartText>
                  <MaterialCommunityIcons name="calendar" size={20} color="#6c5ce7" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={editData.stdob ? new Date(editData.stdob) : new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setEditData((d) => ({
                          ...d,
                          stdob: selectedDate.toISOString().split("T")[0],
                        }));
                      }
                    }}
                  />
                )}
                <RNTextInput
                  placeholder="Address"
                  value={editData.stadress}
                  onChangeText={(v) => setEditData((d) => ({ ...d, stadress: v }))}
                  style={styles.input}
                  multiline
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.cancelButton}
                >
                  <SmartText style={styles.cancelButtonText}>Cancel</SmartText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  style={styles.saveButton}
                  disabled={saving}
                >
                  <SmartText style={styles.saveButtonText}>
                    {saving ? "Saving..." : "Save"}
                  </SmartText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
  transparent
  visible={languageMenuVisible}
  animationType="fade"
  onRequestClose={() => setLanguageMenuVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <SmartText style={styles.modalTitle}>Select Language</SmartText>

      {languages.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={styles.languageOption}
          onPress={() => {
            changeLanguage(lang.code);
            setLanguageMenuVisible(false);
          }}
        >
          <SmartText style={styles.languageOptionText}>
            {lang.label}
          </SmartText>
        </TouchableOpacity>
      ))}
    </View>
  </View>
</Modal>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#6c5ce7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: "#eee",
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27ae60',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#6c5ce7',
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    width: (width - 60) / 2,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    fontWeight: '500',
  },
  infoSection: {
    marginBottom: 25,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoDetails: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f1f3f4',
    marginLeft: 55,
  },
  actionSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
    marginLeft: 15,
  },
  logoutSection: {
    marginBottom: 25,
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#e74c3c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutBtn: {
    backgroundColor: '#e74c3c',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  bottomSpacer: {
    height: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 25,
    textAlign: 'center',
  },
  avatarEditContainer: {
    alignItems: "center",
    marginBottom: 25,
  },
  avatarEditButton: {
    position: "relative",
    marginBottom: 10,
  },
  avatarEdit: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#6c5ce7",
    backgroundColor: "#eee",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6c5ce7",
    borderRadius: 15,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEditText: {
    color: "#6c5ce7",
    fontWeight: "600",
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 25,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  disabledInput: {
    backgroundColor: "#f0f0f0",
    color: "#888",
    borderColor: '#ddd',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  cancelButtonText: {
    color: "#6c757d",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#6c5ce7",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.4)",
  justifyContent: "center",
  alignItems: "center",
},

modalContainer: {
  backgroundColor: "#fff",
  padding: 20,
  borderRadius: 15,
  width: "80%",
  elevation: 10,
},

modalTitle: {
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 15,
  color: "#2c3e50",
},

languageOption: {
  paddingVertical: 12,
},

languageOptionText: {
  fontSize: 16,
  color: "#2c3e50",
},

});