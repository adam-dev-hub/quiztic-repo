import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { showToast } from "../../lib/toasthelper";
import SmartText from "../../components/SmartText";

import { Client, Databases, Query } from "react-native-appwrite";
import { useRouter } from 'expo-router';
import { account } from "../../lib/appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("""");

const databases = new Databases(client);

// Appwrite Collection IDs
const DATABASE_ID = "685ae2ba0012dcb2feda";
const CLASS_SUMMARY_COLLECTION_ID = 'class_summary_collection';
const STUDENTS_COLLECTION_ID = '685aec0b0015ee8e5254';
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";

const { width } = Dimensions.get('window');

export default function ProfessorAttendance() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [profCIN, setProfCIN] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [studentNames, setStudentNames] = useState({});
  const [totalStats, setTotalStats] = useState({
    totalSessions: 0,
    totalStudents: 0,
    averageAttendance: 0
  });

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const user = await account.get();
      const email = user.email;

      const response = await fetch('https://get-professor-cin.vercel.app/api/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      const cinValue = data.cin || data.profcin;
      if (!response.ok || !cinValue) throw new Error("Professor CIN not loaded");

      const professorCIN = cinValue.toString().substring(0, 8);
      setProfCIN(professorCIN);

      // Fetch all quiz sessions for this professor
      const sessionsRes = await databases.listDocuments(
        DATABASE_ID,
        CLASS_SUMMARY_COLLECTION_ID,
        [
          Query.equal("professorId", professorCIN),
          Query.orderDesc('createdAt'),
          Query.limit(100)
        ]
      );

      // Process attendance data
      const processedData = await Promise.all(
        sessionsRes.documents.map(async (session) => {
          let students = [];
          try {
            students = JSON.parse(session.students || '[]');
          } catch (e) {
            console.error("Failed to parse students:", e);
          }

          // Fetch quiz title
          let quizTitle = `Quiz ${session.quizId?.slice(0, 6) || 'Unknown'}`;
          try {
            const quizRes = await databases.getDocument(
              DATABASE_ID,
              QUIZ_INFO_COLLECTION_ID,
              session.quizId
            );
            quizTitle = quizRes['quiz-title'] || quizTitle;
          } catch (err) {
            console.error("Failed to fetch quiz title:", err);
          }

          return {
            ...session,
            quizTitle,
            attendedStudents: students.length,
            students: students
          };
        })
      );

      setAttendanceData(processedData);

      // Calculate total stats
      const totalSessions = processedData.length;
      const totalUniqueStudents = new Set(
        processedData.flatMap(session => session.students.map(s => s.id))
      ).size;
      const averageAttendance = totalSessions > 0 
        ? Math.round(processedData.reduce((sum, session) => sum + session.attendedStudents, 0) / totalSessions)
        : 0;

      setTotalStats({
        totalSessions,
        totalStudents: totalUniqueStudents,
        averageAttendance
      });

    } catch (err) {
      console.error(err);
      showToast("Failed to load attendance data");
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendanceData();
    setRefreshing(false);
  };

  // Fetch student name function
  const fetchStudentName = async (studentId) => {
    if (!studentId || studentNames[studentId]) {
      return studentNames[studentId] || `Student ${studentId?.slice(0, 6)}`;
    }
    
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        STUDENTS_COLLECTION_ID,
        [Query.equal('stcin', studentId)]
      );

      if (response.documents.length > 0) {
        const studentDoc = response.documents[0];
        const fullName = `${studentDoc.stname} ${studentDoc.stfamilyname}`;
        setStudentNames(prev => ({
          ...prev,
          [studentId]: fullName
        }));
        return fullName;
      } else {
        const fallbackName = `Student ${studentId.slice(0, 6)}`;
        setStudentNames(prev => ({
          ...prev,
          [studentId]: fallbackName
        }));
        return fallbackName;
      }
    } catch (error) {
      console.error(`Failed to fetch name for student ID ${studentId}:`, error);
      const fallbackName = `Student ${studentId?.slice(0, 6)}`;
      setStudentNames(prev => ({
        ...prev,
        [studentId]: fallbackName
      }));
      return fallbackName;
    }
  };

  const handleSessionPress = async (session) => {
    // Fetch student names for all students in this session
    const studentPromises = session.students.map(student => 
      fetchStudentName(student.id)
    );
    await Promise.all(studentPromises);

    setSelectedSession(session);
    setDetailModalVisible(true);
  };

  const renderAttendanceCard = (session) => {
    const attendanceRate = session.totalStudents > 0 
      ? Math.round((session.attendedStudents / session.totalStudents) * 100) 
      : 0;

    const getAttendanceColor = (rate) => {
      if (rate >= 80) return '#27ae60';
      if (rate >= 60) return '#f39c12';
      return '#e74c3c';
    };

    return (
      <TouchableOpacity
        key={session.$id}
        style={styles.attendanceCard}
        onPress={() => handleSessionPress(session)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <MaterialCommunityIcons name="account-group" size={28} color="#4f46e5" />
          </View>
          <View style={styles.cardInfo}>
            <SmartText style={styles.cardTitle}>{session.quizTitle}</SmartText>
            <SmartText style={styles.cardSubtitle}>{session.classroomName || 'Unknown Classroom'}</SmartText>
            <SmartText style={styles.cardDate}>
              {new Date(session.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </SmartText>
          </View>
        </View>

        <View style={styles.attendanceStats}>
          <View style={styles.statItem}>
            <SmartText style={styles.statValue}>{session.attendedStudents}</SmartText>
            <SmartText style={styles.statLabel}>Present</SmartText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <SmartText style={styles.statValue}>{session.totalStudents}</SmartText>
            <SmartText style={styles.statLabel}>Total</SmartText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <SmartText style={[styles.statValue, { color: getAttendanceColor(attendanceRate) }]}>
              {attendanceRate}%
            </SmartText>
            <SmartText style={styles.statLabel}>Rate</SmartText>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <SmartText style={styles.viewDetailsText}>Tap to view attendees</SmartText>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#4f46e5" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderStudentItem = ({ item }) => {
    const studentName = studentNames[item.id] || `Student ${item.id?.slice(0, 6)}`;
    
    return (
      <View style={styles.studentCard}>
        <View style={styles.studentInfo}>
          <View style={styles.studentAvatar}>
            <MaterialCommunityIcons name="account" size={24} color="#4f46e5" />
          </View>
          <View style={styles.studentDetails}>
            <SmartText style={styles.studentName}>{studentName}</SmartText>
            <SmartText style={styles.studentId}>ID: {item.id?.slice(0, 8)}</SmartText>
            {item.concentration && (
              <SmartText style={[
                styles.concentrationText,
                {
                  color: item.concentration >= 70 ? '#27ae60' :
                         item.concentration >= 50 ? '#f39c12' : '#e74c3c'
                }
              ]}>
                Focus: {item.concentration}%
              </SmartText>
            )}
          </View>
        </View>
        <View style={styles.attendanceStatus}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#27ae60" />
          <SmartText style={styles.presentText}>Present</SmartText>
        </View>
      </View>
    );
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
            <SmartText style={styles.loadingText}>Loading Attendance...</SmartText>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>

        <LinearGradient colors={["#4f46e5", "#a29bfe"]} style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View style={styles.leftSection}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.replace('/professorDashboard')}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.textSection}>
                <SmartText style={styles.headerTitle}>Attendance</SmartText>
                <SmartText style={styles.headerSubtitle}>Track student presence</SmartText>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={require('../../animations/att.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <SmartText style={styles.statNumber}>{totalStats.totalSessions}</SmartText>
                <SmartText style={styles.statText}>Sessions</SmartText>
              </View>
              <View style={styles.statBox}>
                <SmartText style={styles.statNumber}>{totalStats.totalStudents}</SmartText>
                <SmartText style={styles.statText}>Students</SmartText>
              </View>
              <View style={styles.statBox}>
                <SmartText style={[styles.statNumber, { color: '#27ae60' }]}>
                  {totalStats.averageAttendance}
                </SmartText>
                <SmartText style={styles.statText}>Avg. Present</SmartText>
              </View>
            </View>
          </View>
        </View>

        {attendanceData.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={80} color="#bdc3c7" />
            <SmartText style={styles.emptyStateText}>No attendance data available</SmartText>
            <SmartText style={styles.emptyStateSubtext}>Complete some quiz sessions to track attendance</SmartText>
          </View>
        ) : (
          <ScrollView 
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4f46e5']}
                tintColor="#4f46e5"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {attendanceData.map((session) => renderAttendanceCard(session))}
          </ScrollView>
        )}

        {/* Detail Modal */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <StatusBar backgroundColor="#fff" barStyle="dark-content" />
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#4f46e5" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <SmartText style={styles.modalTitle}>{selectedSession?.quizTitle}</SmartText>
                <SmartText style={styles.modalSubtitle}>
                  {selectedSession?.classroomName} • {selectedSession?.attendedStudents} Present
                </SmartText>
              </View>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.sessionInfoCard}>
              <SmartText style={styles.sessionDate}>
                {selectedSession && new Date(selectedSession.createdAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </SmartText>
              <SmartText style={styles.sessionDuration}>
                Duration: {selectedSession?.timePassed || 'N/A'}
              </SmartText>
            </View>

            <FlatList
              data={selectedSession?.students || []}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderStudentItem}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => (
                <SmartText style={styles.attendeesHeader}>
                  Attendees ({selectedSession?.attendedStudents || 0})
                </SmartText>
              )}
            />
          </SafeAreaView>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#4f46e5",
  },
  headerContainer: {
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    shadowColor: "#4f46e5",
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
  },
  rightSection: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieContainer: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieAnimation: {
    width: 80,
    height: 80,
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
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  statText: {
    fontSize: 14,
    color: '#636e72',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#7f8c8d',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#95a5a6',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#636e72',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e9ecef',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4f46e5',
    marginRight: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingTop: 50,
  },
  modalBackButton: {
    padding: 5,
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#636e72',
    textAlign: 'center',
    marginTop: 2,
  },
  placeholder: {
    width: 34,
  },
  sessionInfoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 10,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  sessionDuration: {
    fontSize: 14,
    color: '#636e72',
  },
  modalContent: {
    padding: 15,
  },
  attendeesHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  concentrationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  attendanceStatus: {
    alignItems: 'center',
  },
  presentText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '500',
    marginTop: 2,
  },
});