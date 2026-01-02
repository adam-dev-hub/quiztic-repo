import React, { useEffect, useState, useCallback, useRef } from "react";
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
  Image,
  ImageBackground,
  Animated
} from "react-native";
import { account, client } from "../lib/appwrite";
import { Databases, Query } from "react-native-appwrite";
import { MaterialCommunityIcons, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import LottieView from 'lottie-react-native';
import { useFocusEffect } from '@react-navigation/native';
import SmartText from "../components/SmartText";

const { width, height } = Dimensions.get('window');

const DATABASE_ID = "685ae2ba0012dcb2feda";
const PROFESSORS_COLLECTION_ID = "685ae2d80031c0e9b7f3";
const QUIZ_COLLECTION_ID = "686315a2000c31e99790";
const CLASSROOM_COLLECTION_ID = "professor_classrooms";

// Professor Color Palette (from index.jsx)
const PROFESSOR_GRADIENT = ["#2f279e","#4f46e5", "#7b84f0"];

// Dummy assets for the new design
const DUMMY_ASSETS = {
  profileGif: require('../assets/profile.png'), // Assuming you'll add this
  quizImage: require('../assets/quiz.jpg'), // Placeholder image
  classroomImage: require('../assets/classroom.jpg'), // Placeholder image
  attendanceImage: require('../assets/Attendance.jpg'), // Placeholder image
  performanceImage: require('../assets/performance.jpg'), // Placeholder image
};

const ShapeBackground = () => {
  const rotationValue = useRef(new Animated.Value(0)).current; // Renamed to clarify it's the numeric driver

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationValue, { // Use rotationValue here
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // 1. Clockwise Rotation (for shape1)
  const rotateClockwise = rotationValue.interpolate({ // Interpolate the numeric value
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 2. Counter-Clockwise Rotation (for shape3)
  const rotateCounterClockwise = rotationValue.interpolate({ // Interpolate the numeric value
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dynamic Shapes */}
      <Animated.View style={[styles.shape, styles.shape1, { transform: [{ rotate: rotateClockwise }] }]} />
      <View style={[styles.shape]} />
      {/* Use the new counter-clockwise interpolation */}
      <Animated.View style={[styles.shape, styles.shape3, { transform: [{ rotate: rotateCounterClockwise }] }]} /> 
    </View>
  );
};

export default function ProfessorDashboard() {
  const [professorName, setProfessorName] = useState(null);
  const [professorId, setProfessorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profId, setProfId] = useState("");
  const router = useRouter();
  
  const [dashboardData, setDashboardData] = useState({
    totalQuizzes: 0,
    totalClassrooms: 0,
    attendanceRate: 0,
    performanceStats: 0
  });

  // Re-fetch data on screen focus
  useFocusEffect(
    useCallback(() => {
      async function refreshData() {
        if (profId) {
          const databases = new Databases(client);
          await fetchDynamicData(databases, profId);
        }
      }
      refreshData();
    }, [profId])
  );

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    async function fetchProfessorData() {
      try {
        const startTime = Date.now();
        const user = await account.get();
        const email = user.email;
        const databases = new Databases(client);
        
        const response = await databases.listDocuments(DATABASE_ID, PROFESSORS_COLLECTION_ID, [
          Query.equal("profmail", email),
        ]);

        if (response.total > 0) {
          const prof = response.documents[0];
          const fullName = `${prof.profname} ${prof.proffamilyname}`;
          setProfessorName(fullName);
          setProfessorId(prof.$id);
          setProfId(prof.profcin); // Set profId for dynamic fetching
          
          await fetchDynamicData(databases, prof.$id);
        } else {
          setProfessorName("Professor");
        }

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1500 - elapsedTime); // Reduced loading time
        
        setTimeout(() => {
          setLoading(false);
        }, remainingTime);

      } catch (error) {
        console.error("Failed to fetch professor info:", error);
        setProfessorName("Professor");
        
        setTimeout(() => {
          setLoading(false);
        }, 1500);
      }
    }

    fetchProfessorData();
  }, []);

  const fetchDynamicData = async (databases, profCin) => {
    try {
      const quizzesResponse = await databases.listDocuments(DATABASE_ID, QUIZ_COLLECTION_ID, [
        Query.equal("quiz-professor", profCin), // Using profCin here
      ]);
      
      const classroomsResponse = await databases.listDocuments(DATABASE_ID, CLASSROOM_COLLECTION_ID, [
        Query.equal("professorId", profCin), // Using profCin here
      ]);
      
      const attendanceRate = Math.floor(Math.random() * 30) + 70; 
      const performanceStats = Math.floor(Math.random() * 20) + 80; 

      setDashboardData({
        totalQuizzes: quizzesResponse.total,
        totalClassrooms: classroomsResponse.total,
        attendanceRate: attendanceRate,
        performanceStats: performanceStats
      });

    } catch (error) {
      console.error("Failed to fetch dynamic data:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (profId) { // Use profId (profcin) for fetching
      const databases = new Databases(client);
      await fetchDynamicData(databases, profId);
    }
    setRefreshing(false);
  };

  const handleProfilePress = () => {
    router.push('/professorFiles/professorProfile');
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
        <StatusBar backgroundColor={PROFESSOR_GRADIENT[0]} barStyle="light-content" />
        <LinearGradient
          colors={PROFESSOR_GRADIENT}
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
            <SmartText style={styles.loadingTitle}>Professor Dashboard</SmartText>
          <SmartText style={styles.loadingSubtitle}>Preparing your workspace...</SmartText>
          {/* New: Add the loading dots container */}
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
      id: 'classrooms',
      title: 'My Classrooms',
      value: dashboardData.totalClassrooms,
      subtitle: 'Total classes created',
      icon: 'school',
      colors: ['#FFE5E5', '#FFD1D1'],
      iconColor: '#FF6B6B',
      image: DUMMY_ASSETS.classroomImage,
      onPress: () => router.push({ 
        pathname: "/professorFiles/professorClassrooms", 
        params: { profId: profId } 
      })
    },
    {
      id: 'quizzes',
      title: 'Quiz Builder',
      value: dashboardData.totalQuizzes,
      subtitle: 'Quizzes & Exams created',
      icon: 'tools',
      colors: ['#E5F3FF', '#D1E9FF'],
      iconColor: '#4A90E2',
      image: DUMMY_ASSETS.quizImage,
      onPress: () => router.push("/professorFiles/professorCourses")
    },
    {
      id: 'attendance',
      title: 'Attendance Rate',
      value: `${dashboardData.attendanceRate}%`,
      subtitle: 'Overall student attendance',
      icon: 'account-check',
      colors: ['#E5FFE5', '#D1FFD1'],
      iconColor: '#4CAF50',
      image: DUMMY_ASSETS.attendanceImage,
      onPress: () => router.push("/professorFiles/professorAttendance")
    },
    {
      id: 'performance',
      title: 'Performance',
      value: `${dashboardData.performanceStats}%`,
      subtitle: 'Global performance stats',
      icon: 'chart-line',
      colors: ['#FFF5E5', '#FFEDD1'],
      iconColor: '#FF9800',
      image: DUMMY_ASSETS.performanceImage,
      onPress: () => {}
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={PROFESSOR_GRADIENT[0]} barStyle="light-content" />
      <View style={styles.background}>
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PROFESSOR_GRADIENT[0]]}
              tintColor={PROFESSOR_GRADIENT[0]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Refactored Header Section */}
          <LinearGradient
            colors={PROFESSOR_GRADIENT}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerContainer}
          >
            <ShapeBackground />
            
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
                <Image
                  source={DUMMY_ASSETS.profileGif} 
                  style={styles.profileGif}
                />
                <View style={styles.onlineIndicator} />
              </TouchableOpacity>
            </View>

            <View style={styles.welcomeSection}>
              <SmartText style={styles.greetingText}>{getGreeting()}</SmartText>
              <SmartText style={styles.professorNameText}>{professorName}</SmartText>
              <SmartText style={styles.roleText}>Professor Dashboard</SmartText>
            </View>
          </LinearGradient>

          {/* Redesigned Search Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputWrapper}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search quizzes, classrooms, students..."
                  placeholderTextColor="#8E8E93"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.filterButton}>
              <MaterialCommunityIcons name="tune-variant" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Refactored Carousel Cards Section */}
          <View style={styles.carouselSection}>
            <SmartText style={styles.sectionTitle}>Dashboard Overview</SmartText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              decelerationRate="fast"
              snapToInterval={width * 0.75 + 20}
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
                  <View style={styles.cardInner}>
                    {/* Background Image/Overlay */}
                    <ImageBackground
                      source={card.image}
                      style={styles.cardImageBackground}
                      imageStyle={styles.cardImageStyle}
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
                      style={styles.cardOverlay}
                    />

                    {/* Card Content */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.cardIconContainer, { backgroundColor: card.iconColor }]}>
                        <MaterialCommunityIcons name={card.icon} size={28} color="#fff" />
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      <SmartText style={styles.cardTitleNew}>{card.title}</SmartText>
                      <SmartText style={styles.cardValueNew}>{card.value}</SmartText>
                      <SmartText style={styles.cardSubtitleNew}>{card.subtitle}</SmartText>
                    </View>
                  </View>
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
                  <SmartText style={styles.activityTitle}>Quiz 'Intro to React' submitted</SmartText>
                  <SmartText style={styles.activityTime}>2 minutes ago</SmartText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#7f8c8d" />
              </View>
              
              <View style={styles.activityDivider} />
              
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, styles.activityIconGreen]}>
                  <Ionicons name="school" size={20} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <SmartText style={styles.activityTitle}>New student joined Classroom B</SmartText>
                  <SmartText style={styles.activityTime}>1 hour ago</SmartText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#7f8c8d" />
              </View>
              
              <View style={styles.activityDivider} />
              
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, styles.activityIconOrange]}>
                  <Ionicons name="checkmark-circle" size={20} color="#FF9800" />
                </View>
                <View style={styles.activityContent}>
                  <SmartText style={styles.activityTitle}>Performance report for Quiz 1 updated</SmartText>
                  <SmartText style={styles.activityTime}>3 hours ago</SmartText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#7f8c8d" />
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // --- Loading Styles (Simplified) ---
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
    fontSize: 16, // UPDATED from 15
    color: 'rgba(255,255,255,0.8)', 
    marginBottom: 40, // UPDATED to match planify-class.jsx
    textAlign: 'center', 
  },
  // NEW STYLES for Loading Dots
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

  // --- Refactored Header Styles ---
  headerContainer: {
    padding: 25,
    paddingTop: 60,
    paddingBottom: 40,
    marginBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  // Dynamic Shapes for Header Background
  shape: {
    position: 'absolute',
    opacity: 0.15,
  },
  shape1: {
    top: -50,
    left: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff', 
  },
  shape2: {
    top: 50,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 15, // Square
    backgroundColor: '#fff', 
    transform: [{ rotate: '45deg' }],
  },
  shape3: {
    bottom: -30,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5, 
    borderColor: '#fff',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    zIndex: 1,
  },
  timeContainer: {
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileIconContainer: {
    position: 'relative',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#7b84f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: '#7b84f0',
    overflow: 'hidden',
  },
  profileGif: {
    width: '90%',
    height: '90%',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7b84f0', // A lively green/success color
    borderWidth: 2,
    borderColor: '#7b84f0',
  },
  welcomeSection: {
    zIndex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    marginBottom: 5,
  },
  professorNameText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 5,
  },
  roleText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // --- Redesigned Search Styles ---
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 30,
    marginTop: -40, // Pull search section up into the header for a modern feel
    zIndex: 10, // Ensure it's above other elements
  },
  searchInputWrapper: {
    flex: 1,
    marginRight: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    height: 55,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#2c3e50",
    fontWeight: '500',
  },
  filterButton: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: PROFESSOR_GRADIENT[0], // Use primary color
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  // --- Refactored Carousel Styles ---
  carouselSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  carouselContainer: {
    paddingHorizontal: 20, // Reduced padding to match the look
  },
  carouselCard: {
    width: width * 0.75,
    height: 200, // Slightly taller card
    marginRight: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 40, // Extra margin at the end
  },
  cardInner: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    padding: 25,
    justifyContent: 'space-between',
  },
  cardImageBackground: {
    ...StyleSheet.absoluteFillObject, // Ensures full coverage of the parent view
},
  cardImageStyle: {
    resizeMode: 'cover',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardHeader: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12, // Square-like container
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  cardTitleNew: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  cardValueNew: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  cardSubtitleNew: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  
  // --- Activity Section (Minor Polish) ---
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
    color: PROFESSOR_GRADIENT[0],
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityIcon: {
    width: 45,
    height: 45,
    borderRadius: 10, // More squared icon container
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityIconBlue: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  activityIconGreen: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  activityIconOrange: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activityDivider: {
    height: 1,
    backgroundColor: '#f1f3f4',
    marginVertical: 4,
    marginLeft: 60,
  },
  bottomSpacer: {
    height: 20,
  },
});