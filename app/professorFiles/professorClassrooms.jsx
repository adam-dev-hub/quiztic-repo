import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  ImageBackground,
  Dimensions,
  Image,
  Platform
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from 'lottie-react-native';
import { Client, Databases, Query } from 'react-native-appwrite';
import { showToast } from "../../lib/toasthelper";
import SmartText from "../../components/SmartText";

// --- Configuration & Constants ---
const { width } = Dimensions.get('window');

// Professor Color Palette
const PROFESSOR_GRADIENT = ["#2f279e", "#4f46e5", "#7b84f0"];

const ASSETS = {
  classroomHeader: require('../../assets/class1.jpg'), 
  loadingAnimation: require('../../animations/loading_animation.json'),
  // Random GIF icons for cards
  cardIcons: [
    require('../../assets/icon1.gif'),
    require('../../assets/icon2.gif'),
    require('../../assets/icon3.gif'),
    require('../../assets/icon4.gif'),
  ]
};

// Appwrite Config
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('""');
const databases = new Databases(client);

const DATABASE_ID = '685ae2ba0012dcb2feda';
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';
const CLASS_SUMMARY_COLLECTION_ID = 'class_summary_collection';

// --- Helper to pick a random icon deterministically based on ID ---
const getCardIcon = (id) => {
  if (!id) return ASSETS.cardIcons[0];
  // Simple hash to pick an index 0-3
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ASSETS.cardIcons.length;
  return ASSETS.cardIcons[index];
};

// --- Classroom Card Component ---
const ClassroomCard = ({ classroom, onPlanify, onViewHistory, hasHistory }) => {
  const hasPlan = classroom.planId;

  const getSessionCount = (schedule) => {
    if (!schedule || typeof schedule !== 'object') return 0;
    return Object.values(schedule).reduce((total, sessions) => total + (Array.isArray(sessions) ? sessions.length : 0), 0);
  };

  const sessionCount = getSessionCount(classroom.schedule);
  const cardIconSource = useMemo(() => getCardIcon(classroom.id), [classroom.id]);

  return (
    <View style={styles.classroomCard}>
      {/* Background Shapes (X O Triangle Square) */}
      <View style={styles.cardBackgroundShapes}>
        <MaterialCommunityIcons name="square-outline" size={60} color="rgba(108, 92, 231, 0.1)" style={[styles.bgShape, { top: -10, right: -10, transform: [{ rotate: '15deg' }] }]} />
        <MaterialCommunityIcons name="circle-outline" size={50} color="rgba(108, 92, 231, 0.07)" style={[styles.bgShape, { bottom: 10, left: 40 }]} />
        <MaterialCommunityIcons name="triangle-outline" size={40} color="rgba(108, 92, 231, 0.11)" style={[styles.bgShape, { top: 40, left: -10, transform: [{ rotate: '-15deg' }] }]} />
        <MaterialCommunityIcons name="close" size={50} color="rgba(108, 92, 231, 0.15)" style={[styles.bgShape, { bottom: -10, right: 50, transform: [{ rotate: '10deg' }] }]} />
      </View>

      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          {/* Random GIF Icon */}
          <Image source={cardIconSource} style={styles.cardGifIcon} resizeMode="contain" />
        </View>
        <View style={styles.cardTitleContainer}>
          <SmartText style={styles.cardTitle} numberOfLines={1}>{classroom.name}</SmartText>
          <SmartText style={styles.cardSubtitle}>{classroom.code}</SmartText>
        </View>
        
        {/* Plan Status Badge */}
        <View style={[styles.planBadge, hasPlan ? styles.planBadgeActive : styles.planBadgeInactive]}>
          <MaterialCommunityIcons name={hasPlan ? "check-circle" : "close-circle"} size={14} color={hasPlan ? "#27ae60" : "#e74c3c"} />
          <SmartText style={[styles.planBadgeText, hasPlan ? styles.planBadgeTextActive : styles.planBadgeTextInactive]}>
            {hasPlan ? "Planned" : "No Plan"}
          </SmartText>
        </View>
      </View>

      {/* Card Body Stats */}
      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color="#636e72" />
          <SmartText style={styles.statText}>{classroom.studentCount} Students</SmartText>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="calendar-week" size={16} color="#636e72" />
          <SmartText style={styles.statText}>{sessionCount} sessions/week</SmartText>
        </View>
      </View>

      {/* Card Footer Actions */}
      <View style={styles.cardActions}>
        {hasHistory && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.historyButton]}
            onPress={() => onViewHistory(classroom)}
          >
            <MaterialCommunityIcons name="history" size={18} color="#0984e3" />
            <SmartText style={[styles.actionButtonText, { color: "#0984e3" }]}>History</SmartText>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.planButton]}
          onPress={() => onPlanify(classroom)}
        >
          <MaterialCommunityIcons name="brain" size={18} color={PROFESSOR_GRADIENT[1]} />
          <SmartText style={[styles.actionButtonText, { color: PROFESSOR_GRADIENT[1] }]}>
            {hasPlan ? "View Plan" : "Planify"}
          </SmartText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- Dashboard Component ---
const ProfessorClassroomsDashboard = () => {
  const router = useRouter();
  const { profId } = useLocalSearchParams();
  
  const [classrooms, setClassrooms] = useState([]);
  const [classroomsWithHistory, setClassroomsWithHistory] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkClassroomHistory = async (classroomName, professorId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        CLASS_SUMMARY_COLLECTION_ID,
        [
          Query.equal('classroomName', classroomName),
          Query.equal('professorId', professorId),
          Query.limit(1)
        ]
      );
      return response.documents.length > 0;
    } catch (error) {
      console.error('Error checking classroom history:', error);
      return false;
    }
  };

  const fetchClassrooms = async () => {
    try {
      if (profId) {
        const response = await databases.listDocuments(
          DATABASE_ID,
          CLASSROOMS_COLLECTION_ID,
          [
            Query.equal('professorId', profId),
            Query.equal('isActive', true),
            Query.orderDesc('$createdAt')
          ]
        );

        const formattedClassrooms = response.documents.map(doc => ({
          id: doc.$id,
          name: doc.name,
          code: doc.classCode,
          studentCount: doc.studentCount,
          schedule: typeof doc.schedule === 'string' ? JSON.parse(doc.schedule) : doc.schedule,
          planId: doc.planId || null,
          description: doc.description || '',
        }));

        const historyChecks = await Promise.all(
          formattedClassrooms.map(classroom => 
            checkClassroomHistory(classroom.name, profId)
          )
        );

        const classroomsWithHistorySet = new Set();
        formattedClassrooms.forEach((classroom, index) => {
          if (historyChecks[index]) {
            classroomsWithHistorySet.add(classroom.id);
          }
        });

        setClassroomsWithHistory(classroomsWithHistorySet);
        setClassrooms(formattedClassrooms);
      } else {
        // Simulate loading delay for preview/dev
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      console.error('Error fetching classrooms:', error);
      showToast('Failed to load classrooms');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [profId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClassrooms();
  };

  const handlePlanify = (classroom) => {
    router.push({
      pathname: './planify-class',
      params: { 
        classroomId: classroom.id,
        profId: profId,
        classroomName: classroom.name,
        description: classroom.description,
        autoOpenModal: 'true'
      }
    });
  };

  const handleViewHistory = (classroom) => {
    router.push({
      pathname: './quiz-history',
      params: { 
        profId: profId,
        classroomName: classroom.name
      }
    });
  };
  
  const handleCreateClass = () => {
    router.push({
      pathname: './create-class',
      params: { profId: profId }
    });
  };

  // --- Loading State (Aligned with Dashboard) ---
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <StatusBar backgroundColor={PROFESSOR_GRADIENT[0]} barStyle="light-content" />
        <LinearGradient
          colors={PROFESSOR_GRADIENT}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <View style={styles.lottieContainerLoading}>
              <LottieView
                source={ASSETS.loadingAnimation}
                autoPlay
                loop
                style={styles.loadingLottie}
              />
            </View>
            <SmartText style={styles.loadingTitle}>Loading Classrooms</SmartText>
            <SmartText style={styles.loadingSubtitle}>Syncing your schedule...</SmartText>
            
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={PROFESSOR_GRADIENT[0]} />
      <View style={styles.background}>
        
        {/* Scrollable Content */}
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[PROFESSOR_GRADIENT[0]]} 
                tintColor={PROFESSOR_GRADIENT[0]}
              />
            }
        >
            {/* Header Section with Local Static Image */}
            <View style={styles.headerWrapper}>
                <ImageBackground
                    source={ASSETS.classroomHeader}
                    style={styles.headerImageBackground}
                    imageStyle={styles.headerImageStyle}
                >
                    <LinearGradient 
                        colors={['rgba(47, 39, 158, 0.85)', 'rgba(79, 70, 229, 0.9)']}
                        style={styles.headerOverlay}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerTopRow}>
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => router.replace('../professorDashboard')}
                                >
                                    <Ionicons name="arrow-back" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.headerTextContainer}>
                                <SmartText style={styles.headerTitle}>My Classrooms</SmartText>
                                <SmartText style={styles.headerSubtitle}>Manage your classes, students, and plans</SmartText>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>

            {/* Classrooms List */}
            {classrooms.length === 0 ? (
            <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconContainer}>
                    <MaterialCommunityIcons name="school-outline" size={60} color="#bdc3c7" />
                </View>
                <SmartText style={styles.emptyStateText}>No Classrooms Yet</SmartText>
                <SmartText style={styles.emptyStateSubtext}>
                Start by creating your first classroom to manage students and quizzes.
                </SmartText>
            </View>
            ) : (
            <View style={styles.listContainer}>
                {classrooms.map((classroom) => (
                <ClassroomCard
                    key={classroom.id}
                    classroom={classroom}
                    onPlanify={handlePlanify}
                    onViewHistory={handleViewHistory}
                    hasHistory={classroomsWithHistory.has(classroom.id)}
                />
                ))}
            </View>
            )}
        </ScrollView>

        {/* Fixed "Create New" Button - Container Style */}
        <View style={styles.fixedBottomSection}>
          <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleCreateClass}
            >
            <LinearGradient
                colors={PROFESSOR_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButtonGradient}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 8 }} />
              <SmartText style={styles.createButtonText}>Create New Classroom</SmartText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: PROFESSOR_GRADIENT[0],
  },
  background: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Increased padding for the larger fixed bottom section
  },

  // --- Header Styles ---
  headerWrapper: {
    marginBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    height: 220,
  },
  headerImageBackground: {
    width: '100%',
    height: '100%',
  },
  headerImageStyle: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    padding: 25,
    paddingTop: Platform.OS === 'android' ? 50 : 25,
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },

  // --- Loading Styles ---
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: 'center',
  },
  lottieContainerLoading: {
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

  // --- List & Card Styles ---
  listContainer: {
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    marginTop: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
    lineHeight: 24,
  },
  classroomCard: {
    backgroundColor: '#fff9f5',
    borderRadius: 25,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden', // Important for background shapes
    position: 'relative',
  },
  // Background Shapes Styles
  cardBackgroundShapes: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  bgShape: {
    position: 'absolute',
    opacity: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    zIndex: 1,
  },
  cardIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 70, 229, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  cardGifIcon: {
    width: 40,
    height: 40,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  planBadgeActive: {
    backgroundColor: '#e6f7ec',
  },
  planBadgeInactive: {
    backgroundColor: '#fff0f0',
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  planBadgeTextActive: {
    color: '#27ae60',
  },
  planBadgeTextInactive: {
    color: '#e74c3c',
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f5f6fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f6fa',
    marginBottom: 15,
    zIndex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#636e72',
    marginLeft: 8,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    zIndex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  historyButton: {
    backgroundColor: '#e3f2fd',
  },
  planButton: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },

  // --- Fixed Button Styles ---
  fixedBottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    backgroundColor: 'rgba(245, 245, 245, 1)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 20,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default ProfessorClassroomsDashboard;