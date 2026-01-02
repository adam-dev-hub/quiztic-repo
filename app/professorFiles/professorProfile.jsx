import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { account, client } from "../../lib/appwrite";
import { Databases, Query } from "react-native-appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useLanguage } from "../../contexts/LanguageContext";
import SmartText from "../../components/SmartText";

const DATABASE_ID = "685ae2ba0012dcb2feda";
const PROFESSORS_COLLECTION_ID = "685ae2d80031c0e9b7f3";
const QUIZ_COLLECTION_ID = "686315a2000c31e99790";

const { width } = Dimensions.get('window');

export default function ProfessorProfile() {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "jp", label: "日本語" },
];

  const [professor, setProfessor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    completedSessions: 0,
    totalStudents: 0,
    accountAge: 0
  });
  const router = useRouter();

  useEffect(() => {
    fetchProfessorData();
  }, []);

  const fetchProfessorData = async () => {
    try {
      const user = await account.get();
      const email = user.email;
      const databases = new Databases(client);
      
      // Fetch professor info
      const response = await databases.listDocuments(DATABASE_ID, PROFESSORS_COLLECTION_ID, [
        Query.equal("profmail", email),
      ]);
      
      if (response.total > 0) {
        const profData = response.documents[0];
        setProfessor(profData);
        
        // Fetch professor stats
        await fetchProfessorStats(databases, profData.profcin);
      } else {
        setProfessor(null);
      }
    } catch (error) {
      console.error("Failed to fetch professor data:", error);
      setProfessor(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfessorStats = async (databases, profCin) => {
    try {
      // Fetch quiz count
      const quizzesResponse = await databases.listDocuments(DATABASE_ID, QUIZ_COLLECTION_ID, [
        Query.equal("quiz-professor", profCin),
      ]);

      // Calculate account age (mock calculation)
      const accountAge = Math.floor(Math.random() * 24) + 1; // 1-24 months
      
      setStats({
        totalQuizzes: quizzesResponse.total,
        completedSessions: Math.floor(quizzesResponse.total * 0.8), // 80% completion rate
        totalStudents: Math.floor(Math.random() * 200) + 50, // Mock student count
        accountAge: accountAge
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
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
              await account.deleteSession('current');
              router.replace('../professor-login');
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
        <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
        <LinearGradient
          colors={['#4f46e5', '#a29bfe']}
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

  if (!professor) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
        <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="account-alert" size={80} color="#e74c3c" />
            <SmartText style={styles.errorText}>Professor profile not found</SmartText>
            <SmartText style={styles.errorSubtext}>Unable to load your profile information</SmartText>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchProfessorData}>
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
      title: "Quizzes Created",
      value: stats.totalQuizzes,
      icon: "clipboard-list",
      color: "#4f46e5"
    },
    {
      title: "Sessions Completed",
      value: stats.completedSessions,
      icon: "check-circle",
      color: "#27ae60"
    },
    {
      title: "Students Reached",
      value: stats.totalStudents,
      icon: "account-group",
      color: "#3498db"
    },
    {
      title: "Account Age",
      value: formatAccountAge(stats.accountAge),
      icon: "calendar-clock",
      color: "#f39c12"
    }
  ];

  const profileSections = [
    {
      title: "Personal Information",
      items: [
        { label: "Full Name", value: `${professor.profname} ${professor.proffamilyname}`, icon: "account" },
        { label: "Email", value: professor.profmail, icon: "email" },
        { label: "CIN", value: professor.profcin, icon: "card-account-details" },
        { label: "Phone", value: professor.profphone, icon: "phone" }
      ]
    },
    {
      title: "Professional Details",
      items: [
        { label: "Department", value: professor.profdepartment, icon: "domain" },
        { label: "Role", value: "Professor", icon: "account-tie" }
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>

        {/* Header */}
        <LinearGradient colors={["#4f46e5", "#a29bfe"]} style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/professorDashboard')}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <SmartText style={styles.headerTitle}>Profile</SmartText>
            <TouchableOpacity style={styles.editButton}>
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
              <LinearGradient
                colors={['#4f46e5', '#a29bfe']}
                style={styles.avatar}
              >
                <SmartText style={styles.avatarText}>
                  {getInitials(professor.profname, professor.proffamilyname)}
                </SmartText>
              </LinearGradient>
              <View style={styles.onlineIndicator} />
            </View>
            
            <View style={styles.profileInfo}>
              <SmartText style={styles.profileName}>
                {professor.profname} {professor.proffamilyname}
              </SmartText>
              <SmartText style={styles.profileEmail}>{professor.profmail}</SmartText>
              <SmartText style={styles.profileRole}>Professor • {professor.profdepartment}</SmartText>
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
                        <MaterialCommunityIcons name={item.icon} size={20} color="#4f46e5" />
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
            <TouchableOpacity
  style={styles.actionButton}
  onPress={() => setLanguageMenuVisible(true)}
>
  <MaterialCommunityIcons name="translate" size={20} color="#4f46e5" />
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
              <MaterialCommunityIcons name="help-circle" size={20} color="#4f46e5" />
              <SmartText style={styles.actionButtonText}>Help & Support</SmartText>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#bdc3c7" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons name="information" size={20} color="#4f46e5" />
              <SmartText style={styles.actionButtonText}>About</SmartText>
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

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#4f46e5",
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#4f46e5',
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