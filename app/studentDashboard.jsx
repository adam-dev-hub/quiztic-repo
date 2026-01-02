import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
  Image
} from "react-native";
import { account, client } from "../lib/appwrite";
import { Databases, Query } from "react-native-appwrite";
import { MaterialCommunityIcons, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import LottieView from 'lottie-react-native';
import SmartText from "../components/SmartText";
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const DATABASE_ID = "685ae2ba0012dcb2feda";
const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254";
const SUBMISSIONS_COLLECTION_ID = "687ec5cd0008660447d4";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";

export default function StudentDashboard() {
  const [studentName, setStudentName] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentAvatar, setStudentAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboardData, setDashboardData] = useState({
    totalQuizzes: 0,
    completedQuizzes: 0,
    averageScore: 0,
    totalCourses: 0
  });
  const router = useRouter();
  const [studentCIN, setStudentCIN] = useState("");

  useFocusEffect(
    useCallback(() => {
      async function refreshData() {
        if (studentCIN) {
          const databases = new Databases(client);
          await fetchDynamicData(databases, studentCIN);
        }
      }
      refreshData();
    }, [studentCIN])
  );

  useEffect(() => {
    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    async function fetchStudentData() {
      try {
        const startTime = Date.now();
        
        const user = await account.get();
        const email = user.email;
        const databases = new Databases(client);
        
        // Fetch student info
        const response = await databases.listDocuments(DATABASE_ID, STUDENTS_COLLECTION_ID, [
          Query.equal("stmail", email),
        ]);

        if (response.total > 0) {
          const student = response.documents[0];
          const fullName = `${student.stname} ${student.stfamilyname}`;
          setStudentName(fullName);
          setStudentId(student.$id);
          setStudentCIN(student.stcin);
          setStudentAvatar(student.stavatar || null);
          
          // Fetch dynamic data
          await fetchDynamicData(databases, student.stcin);
        } else {
          setStudentName("Student");
        }

        // Ensure minimum 3 seconds loading time
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 3000 - elapsedTime);
        
        setTimeout(() => {
          setLoading(false);
        }, remainingTime);

      } catch (error) {
        console.error("Failed to fetch student info:", error);
        setStudentName("Student");
        
        setTimeout(() => {
          setLoading(false);
        }, 3000);
      }
    }

    fetchStudentData();
  }, []);

  const fetchDynamicData = async (databases, studentCin) => {
    try {
      // Fetch quiz submissions count
      const submissionsResponse = await databases.listDocuments(DATABASE_ID, SUBMISSIONS_COLLECTION_ID, [
        Query.equal("student_id", studentCin),
      ]);

      // Calculate completed quizzes and average score
      const completedQuizzes = submissionsResponse.documents.length;
      const totalScore = submissionsResponse.documents.reduce((sum, submission) => {
        return sum + (submission.score || 0);
      }, 0);
      const averageScore = completedQuizzes > 0 ? Math.round(totalScore / completedQuizzes) : 0;

      // Get unique quiz count
      const uniqueQuizIds = [...new Set(submissionsResponse.documents.map(s => s.quiz_id))];
      const totalQuizzes = uniqueQuizIds.length;

      // Mock total courses (you can modify based on your data structure)
      const totalCourses = Math.floor(Math.random() * 5) + 3; // 3-7 courses

      setDashboardData({
        totalQuizzes: totalQuizzes,
        completedQuizzes: completedQuizzes,
        averageScore: averageScore,
        totalCourses: totalCourses
      });

    } catch (error) {
      console.error("Failed to fetch dynamic data:", error);
      // Keep default values on error
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (studentCIN) {
      const databases = new Databases(client);
      await fetchDynamicData(databases, studentCIN);
    }
    setRefreshing(false);
  };

  const handleProfilePress = () => {
    router.push('/studentFiles/studentProfile');
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession('current');
      router.replace('/login');
    } catch (err) {
      // Optionally show error
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
        <LinearGradient
          colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={require('../animations/loading_animation.json')}
                autoPlay
                loop
                style={styles.loadingLottie}
              />
            </View>
            <SmartText style={styles.loadingTitle}>Student Dashboard</SmartText>
            <SmartText style={styles.loadingSubtitle}>Preparing your learning space...</SmartText>
            <View style={styles.loadingDotsContainer}>
              <View style={[styles.loadingDot, styles.loadingDot1]} />
              <View style={[styles.loadingDot, styles.loadingDot2]} />
              <View style={[styles.loadingDot, styles.loadingDot3]} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const carouselCards = [
     {
      id: 'quizzes',
      title: 'Quizzes',
      value: dashboardData.totalQuizzes,
      subtitle: 'Available Quizzes',
      icon: 'clipboard-list',
      colors: ['#FFE5E5', '#FFD1D1'],
      iconColor: '#FF6B6B',
      onPress: () => router.push("/studentFiles/studentQuizs")
    },
    {
      id: 'courses',
      title: 'My Courses',
      value: dashboardData.totalCourses,
      subtitle: 'Enrolled Courses',
      icon: 'book-open-variant',
      colors: ['#E5F3FF', '#D1E9FF'],
      iconColor: '#4A90E2',
      onPress: () => router.push("/studentFiles/studentCourses")
    },
   
   
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient
        colors={['#f8f9fa', '#e9ecef']}
        style={styles.background}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6c5ce7']}
              tintColor="#6c5ce7"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Header Section */}
          <LinearGradient
            colors={['#6c5ce7', '#a29bfe', '#74b9ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerTopRow}>
              <View style={styles.timeContainer}>
                <SmartText style={styles.timeText}>{formatTime()}</SmartText>
                <SmartText style={styles.dateText}>
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </SmartText>
              </View>

              <TouchableOpacity
                style={styles.profileIconContainer}
                onPress={handleProfilePress}
              >
                <View style={styles.profileIconInner}>
                  {studentAvatar ? (
                    <Image
                      source={{ uri: studentAvatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons name="person" size={28} color="#2c3e50" />
                  )}
                </View>
                <View style={styles.onlineIndicator} />
              </TouchableOpacity>
            </View>

            <View style={styles.welcomeSection}>
              <SmartText style={styles.greetingText}>{getGreeting()}</SmartText>
              <SmartText style={styles.studentNameText}>{studentName}</SmartText>
              <SmartText style={styles.roleText}>Student Dashboard</SmartText>
            </View>
          </LinearGradient>

          {/* Enhanced Search Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputWrapper}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={22} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search courses, quizzes, grades..."
                  placeholderTextColor="#8E8E93"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.filterButton}>
              <MaterialCommunityIcons name="tune-variant" size={24} color="#6c5ce7" />
            </TouchableOpacity>
          </View>

          {/* Carousel Cards Section */}
          <View style={styles.carouselSection}>
            <SmartText style={styles.sectionTitle}>Overview</SmartText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 15}
              snapToAlignment="start"
            >
              {carouselCards.map((card, index) => (
                <TouchableOpacity 
                  key={card.id} 
                  style={[
                    styles.carouselCard, 
                    index === 0 && styles.firstCard,
                    index === carouselCards.length - 1 && styles.lastCard
                  ]}
                  onPress={card.onPress}
                >
                  <LinearGradient
                    colors={card.colors}
                    style={styles.cardGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.cardIconContainer, { backgroundColor: `${card.iconColor}20` }]}>
                        <MaterialCommunityIcons name={card.icon} size={32} color={card.iconColor} />
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      <SmartText style={styles.cardTitle}>{card.title}</SmartText>
                      <SmartText style={[styles.cardValue, { color: card.iconColor }]}>{card.value}</SmartText>
                      <SmartText style={styles.cardSubtitle}>{card.subtitle}</SmartText>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Recent Activity Section */}
          <View style={styles.recentActivitySection}>
            <View style={styles.sectionHeader}>
              <SmartText style={styles.sectionTitle}>Recent Activity</SmartText>
              <TouchableOpacity>
                <SmartText style={styles.viewAllText}>View All</SmartText>
              </TouchableOpacity>
            </View>
            
            <View style={styles.activityCard}>
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, styles.activityIconBlue]}>
                  <Ionicons name="document-text" size={20} color="#4A90E2" />
                </View>
                <View style={styles.activityContent}>
                  <SmartText style={styles.activityTitle}>Quiz completed</SmartText>
                  <SmartText style={styles.activityTime}>30 minutes ago</SmartText>
                </View>
              </View>
              
              <View style={styles.activityDivider} />
              
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, styles.activityIconGreen]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <SmartText style={styles.activityTitle}>Assignment submitted</SmartText>
                  <SmartText style={styles.activityTime}>2 hours ago</SmartText>
                </View>
              </View>
              
              <View style={styles.activityDivider} />
              
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, styles.activityIconOrange]}>
                  <Ionicons name="book" size={20} color="#FF9800" />
                </View>
                <View style={styles.activityContent}>
                  <SmartText style={styles.activityTitle}>New course material available</SmartText>
                  <SmartText style={styles.activityTime}>1 day ago</SmartText>
                </View>
              </View>
            </View>
          </View>

          {/* Upcoming Events Section */}
          <View style={styles.eventsSection}>
            <SmartText style={styles.sectionTitle}>Upcoming Events</SmartText>
            <View style={styles.eventsCard}>
              <View style={styles.eventItem}>
                <View style={styles.eventDate}>
                  <SmartText style={styles.eventDateDay}>25</SmartText>
                  <SmartText style={styles.eventDateMonth}>Nov</SmartText>
                </View>
                <View style={styles.eventInfo}>
                  <SmartText style={styles.eventTitle}>Math Quiz</SmartText>
                  <SmartText style={styles.eventTime}>10:00 AM - 11:00 AM</SmartText>
                </View>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#FF9800" />
              </View>
              
              <View style={styles.eventDivider} />
              
              <View style={styles.eventItem}>
                <View style={styles.eventDate}>
                  <SmartText style={styles.eventDateDay}>28</SmartText>
                  <SmartText style={styles.eventDateMonth}>Nov</SmartText>
                </View>
                <View style={styles.eventInfo}>
                  <SmartText style={styles.eventTitle}>Science Fair</SmartText>
                  <SmartText style={styles.eventTime}>2:00 PM - 5:00 PM</SmartText>
                </View>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#4CAF50" />
              </View>
            </View>
          </View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
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
    paddingBottom: 40,
  },

  // Enhanced Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: 'center',
  },
  lottieContainer: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },
  loadingLottie: {
    width: '100%',
    height: '100%',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  loadingDot1: {
    backgroundColor: '#fff',
  },
  loadingDot2: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  loadingDot3: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Clean Header Styles
  headerContainer: {
    backgroundColor: '#fff',
    padding: 25,
    paddingTop: 60,
    paddingBottom: 30,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  timeContainer: {
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  dateText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
  },
  profileIconContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: '#2c3e50',
  },
  profileIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  welcomeSection: {
    marginBottom: 10,
  },
  greetingText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
    marginBottom: 5,
  },
  studentNameText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2c3e50",
    marginBottom: 5,
  },
  roleText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Clean Search Styles
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 30,
  },
  searchInputWrapper: {
    flex: 1,
    marginRight: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: '500',
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  // Carousel Styles
  carouselSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  carouselContainer: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  carouselCard: {
    width: width * 0.75,
    height: 180,
    marginRight: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 20,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardHeader: {
    alignItems: 'flex-end',
  },
  cardIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // Activity Section
  recentActivitySection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  viewAllText: {
    fontSize: 14,
    color: '#6c5ce7',
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityIconBlue: {
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
  },
  activityIconGreen: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  activityIconOrange: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activityDivider: {
    height: 1,
    backgroundColor: '#f1f3f4',
    marginVertical: 8,
    marginLeft: 60,
  },

  // Events Section
  eventsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  eventsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  eventDate: {
    backgroundColor: '#6c5ce7',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  eventDateDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 18,
  },
  eventDateMonth: {
    fontSize: 10,
    color: '#fff',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  eventDivider: {
    height: 1,
    backgroundColor: '#f1f3f4',
    marginVertical: 8,
    marginLeft: 65,
  },

  bottomSpacer: {
    height: 0,
  },
});