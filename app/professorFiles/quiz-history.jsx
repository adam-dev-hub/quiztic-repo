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
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { showToast } from "../../lib/toasthelper";
import SmartText from "../../components/SmartText";
import { Client, Databases, Query } from "react-native-appwrite";
import { useRouter } from 'expo-router';
import { account } from "../../lib/appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { PieChart } from 'react-native-chart-kit';
import Svg, { Path, Circle, Rect, Text as SvgText, G, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("""");

const databases = new Databases(client);

// --- Appwrite Collection IDs ---
const DATABASE_ID = "685ae2ba0012dcb2feda";
const CLASS_SUMMARY_COLLECTION_ID = 'class_summary_collection';
const STUDENTS_COLLECTION_ID = '685aec0b0015ee8e5254';
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";

const { width } = Dimensions.get('window');
const chartWidth = width - 60;

export default function ProfessorClassrooms() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState({});
  const [profCIN, setProfCIN] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [studentNames, setStudentNames] = useState({});
  const [googleClassroomModalVisible, setGoogleClassroomModalVisible] = useState(false);

  useEffect(() => {
    async function fetchClassroomData() {
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
        if (!response.ok || !cinValue) throw new Error("cin prof not loaded");

        const professorCIN = cinValue.toString().substring(0, 8);
        setProfCIN(professorCIN);

        // Fetch all class summaries for this professor
        const summariesRes = await databases.listDocuments(
          DATABASE_ID,
          CLASS_SUMMARY_COLLECTION_ID,
          [
            Query.equal("professorId", professorCIN),
            Query.orderDesc('createdAt'),
            Query.limit(100)
          ]
        );

        // Group summaries by classroom name
        const classroomGroups = {};
        summariesRes.documents.forEach(summary => {
          const className = summary.classroomName || 'Unnamed Class';
          if (!classroomGroups[className]) {
            classroomGroups[className] = [];
          }
          classroomGroups[className].push(summary);
        });

        setClassrooms(classroomGroups);

      } catch (err) {
        console.error(err);
        showToast("Failed to load classroom data");
      }
      setLoading(false);
    }
    fetchClassroomData();
  }, []);

  // Fetch student name function
  const fetchStudentName = async (studentId) => {
    if (!studentId || studentNames[studentId]) {
      return;
    }
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        STUDENTS_COLLECTION_ID,
        [Query.equal('stcin', studentId)]
      );

      if (response.documents.length > 0) {
        const studentDoc = response.documents[0];
        setStudentNames(prev => ({
          ...prev,
          [studentId]: `${studentDoc.stname} ${studentDoc.stfamilyname}`
        }));
      } else {
        setStudentNames(prev => ({
          ...prev,
          [studentId]: `Student ${studentId.slice(0, 6)}`
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch name for student ID ${studentId}:`, error);
      setStudentNames(prev => ({
        ...prev,
        [studentId]: `Student ${studentId.slice(0, 6)}`
      }));
    }
  };

  const handleClassroomPress = async (classroomName, quizSummaries) => {
    // Fetch quiz titles for all summaries
    const quizIds = [...new Set(quizSummaries.map(s => s.quizId))];
    const quizTitles = {};
    
    try {
      for (const quizId of quizIds) {
        const quizRes = await databases.getDocument(
          DATABASE_ID,
          QUIZ_INFO_COLLECTION_ID,
          quizId
        );
        quizTitles[quizId] = quizRes['quiz-title'];
      }
    } catch (err) {
      console.error("Failed to fetch quiz titles:", err);
    }

    // Fetch student names for most and least performant
    const allStudentIds = new Set();
    quizSummaries.forEach(summary => {
      if (summary.mostPerformant) allStudentIds.add(summary.mostPerformant);
      if (summary.leastPerformant) allStudentIds.add(summary.leastPerformant);
      
      // Parse students JSON and add their IDs
      try {
        const students = JSON.parse(summary.students);
        students.forEach(student => allStudentIds.add(student.id));
      } catch (e) {
        console.error("Failed to parse students JSON:", e);
      }
    });

    // Fetch names for all students
    for (const studentId of allStudentIds) {
      await fetchStudentName(studentId);
    }

    setSelectedClassroom({ name: classroomName, summaries: quizSummaries, quizTitles });
    setDetailModalVisible(true);
  };

  const renderClassroomCard = (classroomName, quizSummaries) => {
    const totalQuizzes = quizSummaries.length;
    const totalSessions = quizSummaries.length;
    const avgFocusRate = quizSummaries.reduce((sum, s) => sum + (s.classFocusRate || 0), 0) / totalQuizzes;
    const totalStudents = Math.max(...quizSummaries.map(s => s.totalStudents || 0));

    return (
      <TouchableOpacity
        key={classroomName}
        style={styles.classroomCard}
        onPress={() => handleClassroomPress(classroomName, quizSummaries)}
      >
        <View style={styles.classroomHeader}>
          <View style={styles.classroomIconContainer}>
            <MaterialCommunityIcons name="school" size={30} color="#4f46e5" />
          </View>
          <View style={styles.classroomInfo}>
            <SmartText style={styles.classroomName}>{classroomName}</SmartText>
            <SmartText style={styles.classroomStats}>{totalQuizzes} Quiz Sessions</SmartText>
            <SmartText style={styles.classroomStats}>{totalStudents} Students</SmartText>
          </View>
        </View>
        
        <View style={styles.classroomMetrics}>
          <View style={styles.metricItem}>
            <SmartText style={styles.metricValue}>{avgFocusRate.toFixed(0)}%</SmartText>
            <SmartText style={styles.metricLabel}>Avg Focus</SmartText>
          </View>
          <View style={styles.metricItem}>
            <SmartText style={styles.metricValue}>{totalSessions}</SmartText>
            <SmartText style={styles.metricLabel}>Sessions</SmartText>
          </View>
        </View>

        <View style={styles.viewDetailsButton}>
          <SmartText style={styles.viewDetailsText}>View Details</SmartText>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#4f46e5" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuizSummaryItem = ({ item }) => {
    const quizTitle = selectedClassroom?.quizTitles[item.quizId] || `Quiz ${item.quizId.slice(0, 6)}`;
    const mostPerformantName = studentNames[item.mostPerformant] || `Student ${item.mostPerformant?.slice(0, 6)}`;
    const leastPerformantName = studentNames[item.leastPerformant] || `Student ${item.leastPerformant?.slice(0, 6)}`;

    let students = [];
    try {
      students = JSON.parse(item.students);
    } catch (e) {
      console.error("Failed to parse students:", e);
    }
// Create chart data for student concentration distribution
const concentrationRanges = {
  'Excellent (>80%)': 0,
  'Good (60-79%)': 0,
  'Average (40-59%)': 0,
  'Poor (0-39%)': 0
};

// Count students in each concentration range
students.forEach(student => {
  const conc = student.concentration || 0;
  if (conc >= 80) concentrationRanges['Excellent (>80%)']++;
  else if (conc >= 60) concentrationRanges['Good (60-79%)']++;
  else if (conc >= 40) concentrationRanges['Average (40-59%)']++;
  else concentrationRanges['Poor (0-39%)']++;
});

// Define consistent color mapping
const colorMap = {
  'Excellent (>80%)': '#00B894',  // Green
  'Good (60-79%)': '#F1C40F',        // Yellow
  'Average (40-59%)': '#E67E22',     // Orange
  'Poor (0-39%)': '#C0392B'          // Red
};

// Keep a fixed order of ranges
const orderedRanges = [
  'Excellent (>80%)',
  'Good (60-79%)',
  'Average (40-59%)',
  'Poor (0-39%)'
];

// Build chart data in consistent order and color
const chartData = orderedRanges
  .filter(range => concentrationRanges[range] > 0)
  .map(range => ({
    name: range,
    population: concentrationRanges[range],
    color: colorMap[range],
    legendFontColor: '#2c3e50',
    legendFontSize: 12
  }));
    return (
      <View style={styles.quizSummaryCard}>
        <View style={styles.quizSummaryHeader}>
          <MaterialCommunityIcons name="clipboard-list" size={24} color="#4f46e5" />
          <View style={styles.quizSummaryInfo}>
            <SmartText style={styles.quizSummaryTitle}>{quizTitle}</SmartText>
            <SmartText style={styles.quizSummaryDate}>
              {new Date(item.createdAt).toLocaleDateString()} • {item.timePassed}
            </SmartText>
          </View>
        </View>

        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <SmartText style={styles.statValue}>{item.totalStudents}</SmartText>
            <SmartText style={styles.statLabel}>Students</SmartText>
          </View>
          <View style={styles.statItem}>
            <SmartText style={styles.statValue}>{item.classFocusRate}%</SmartText>
            <SmartText style={styles.statLabel}>Focus Rate</SmartText>
          </View>
        </View>

        <View style={styles.performanceSection}>
          <SmartText style={styles.sectionTitle}>Performance Leaders</SmartText>
          <View style={styles.performanceRow}>
            <View style={styles.performanceItem}>
              <MaterialCommunityIcons name="trophy" size={20} color="#f1c40f" />
              <SmartText style={styles.performanceLabel}>Top: {mostPerformantName}</SmartText>
            </View>
            <View style={styles.performanceItem}>
              <MaterialCommunityIcons name="help-circle" size={20} color="#e74c3c" />
              <SmartText style={styles.performanceLabel}>Help: {leastPerformantName}</SmartText>
            </View>
          </View>
        </View>

        {chartData.length > 0 && (
          <View style={styles.chartSection}>
            <SmartText style={styles.sectionTitle}>Concentration Distribution</SmartText>
            <PieChart
              data={chartData}
              width={chartWidth}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0,0,0,${opacity})`
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {students.length > 0 && (
          <View style={styles.studentsSection}>
            <SmartText style={styles.sectionTitle}>Student Performance</SmartText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {students.map((student, index) => {
                const studentName = studentNames[student.id] || `Student ${student.id?.slice(0, 6)}`;
                if (student.id && !studentNames[student.id]) {
                  fetchStudentName(student.id);
                }
                return (
                  <View key={index} style={styles.studentItem}>
                    <SmartText style={styles.studentName}>{studentName}</SmartText>
                    <SmartText style={[
                      styles.concentrationScore,
                      {
                        color: student.concentration >= 70 ? '#27ae60' :
                               student.concentration >= 50 ? '#f39c12' : '#e74c3c'
                      }
                    ]}>
                      {student.concentration}%
                    </SmartText>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
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
            <SmartText style={styles.loadingText}>Loading History...</SmartText>
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
                onPress={() => router.replace('./professorClassrooms')}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.textSection}>
                <SmartText style={styles.headerTitle}>Passt Quizzes</SmartText>
                <SmartText style={styles.headerSubtitle}>History of quizzes and global analytics</SmartText>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={require('../../animations/BKK Transaction.json')}
                  autoPlay
                  loop
                  speed={0.5}
                  style={styles.lottieAnimation}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {Object.keys(classrooms).length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="school-outline" size={80} color="#bdc3c7" />
            <SmartText style={styles.emptyStateText}>No classroom data available</SmartText>
            <SmartText style={styles.emptyStateSubtext}>Complete some quizzes to see classroom analytics</SmartText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {Object.entries(classrooms).map(([classroomName, quizSummaries]) =>
              renderClassroomCard(classroomName, quizSummaries)
            )}
          </ScrollView>
        )}
        {/* Fixed Bottom Section - Google Classroom Integration */}
<View style={styles.fixedBottomSection}>
  <TouchableOpacity
    style={styles.googleClassroomButton}
    onPress={() => setGoogleClassroomModalVisible(true)}
  >
    <MaterialCommunityIcons name="google" size={20} color="#fff" />
    <SmartText style={styles.googleClassroomButtonText}>Plugin with Google Classroom</SmartText>
    <MaterialCommunityIcons name="link-variant" size={20} color="#fff" />
  </TouchableOpacity>
</View>

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
              <SmartText style={styles.modalTitle}>{selectedClassroom?.name}</SmartText>
              <View style={styles.placeholder} />
            </View>

            <FlatList
              data={selectedClassroom?.summaries || []}
              keyExtractor={item => item.$id}
              renderItem={renderQuizSummaryItem}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </Modal>
        {/* Google Classroom Integration Modal */}
<Modal
  visible={googleClassroomModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setGoogleClassroomModalVisible(false)}
>
  <View style={styles.overlay}>
    <View style={styles.googleModalContainer}>
      {/* Header */}
      <View style={styles.googleModalHeader}>
        <View style={styles.googleIconWrapper}>
          <MaterialCommunityIcons name="google" size={32} color="#4285F4" />
        </View>
        <SmartText style={styles.googleModalTitle}>Google Classroom Integration</SmartText>
      </View>

      {/* Feature Illustration */}
      <View style={styles.illustrationContainer}>
        <Svg height="200" width="300" style={styles.illustration}>
          <Defs>
            <SvgLinearGradient id="gradientBlue" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#4285F4" stopOpacity="1" />
              <Stop offset="100%" stopColor="#34A853" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          
          {/* Our App */}
          <Circle cx="80" cy="60" r="25" fill="#4f46e5" />
          <SvgText x="80" y="66" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">Quiz</SvgText>
          
          {/* Connection Arrow */}
          <Path
            d="M110 60 Q150 40 190 60"
            stroke="#4285F4"
            strokeWidth="3"
            fill="none"
            strokeDasharray="5,5"
          />
          <Circle cx="190" cy="60" r="4" fill="#4285F4" />
          
          {/* Google Classroom */}
          <Rect x="195" y="35" width="50" height="50" rx="8" fill="#4285F4" />
          <SvgText x="220" y="48" textAnchor="middle" fontSize="8" fill="#fff">Google</SvgText>
          <SvgText x="220" y="58" textAnchor="middle" fontSize="8" fill="#fff">Class</SvgText>
          <SvgText x="220" y="68" textAnchor="middle" fontSize="8" fill="#fff">room</SvgText>
          
          {/* Benefits */}
          <G transform="translate(50, 150)">
            <Circle cx="30" cy="15" r="12" fill="#E8F0FE" stroke="#4285F4" strokeWidth="2" />
            <SvgText x="30" y="20" textAnchor="middle" fontSize="16" fill="#4285F4">↕</SvgText>
            <SvgText x="30" y="35" textAnchor="middle" fontSize="8" fill="#666">Auto Sync</SvgText>
            
            <Circle cx="100" cy="15" r="12" fill="#E8F5E8" stroke="#34A853" strokeWidth="2" />
            <SvgText x="100" y="20" textAnchor="middle" fontSize="16" fill="#34A853">👥</SvgText>
            <SvgText x="100" y="35" textAnchor="middle" fontSize="8" fill="#666">Students</SvgText>
            
            <Circle cx="170" cy="15" r="12" fill="#FEF7E0" stroke="#FBBC05" strokeWidth="2" />
            <SvgText x="170" y="20" textAnchor="middle" fontSize="16" fill="#FBBC05">📊</SvgText>
            <SvgText x="170" y="35" textAnchor="middle" fontSize="8" fill="#666">Grades</SvgText>
          </G>
        </Svg>
      </View>

      <SmartText style={styles.googleModalDescription}>
        Connect with Google Classroom to automatically sync student rosters, 
        publish quiz results as assignments, and streamline your workflow.
      </SmartText>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="account-group" size={20} color="#34A853" />
          <SmartText style={styles.featureText}>Import student lists automatically</SmartText>
        </View>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="file-export" size={20} color="#4285F4" />
          <SmartText style={styles.featureText}>Export quiz results as grades</SmartText>
        </View>
        <View style={styles.featureItem}>
          <MaterialCommunityIcons name="sync" size={20} color="#FBBC05" />
          <SmartText style={styles.featureText}>Real-time assignment updates</SmartText>
        </View>
      </View>

      <View style={styles.developmentNotice}>
        <MaterialCommunityIcons name="tools" size={24} color="#FF9800" />
        <SmartText style={styles.developmentText}>This feature is currently under development</SmartText>
        <SmartText style={styles.developmentSubtext}>Stay tuned for updates!</SmartText>
      </View>

      <TouchableOpacity
        style={styles.googleModalButton}
        onPress={() => setGoogleClassroomModalVisible(false)}
      >
        <SmartText style={styles.googleModalButtonText}>Got it!</SmartText>
      </TouchableOpacity>
    </View>
  </View>
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
    marginBottom: 30,
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
    width:100,
    height: 100,
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
  classroomCard: {
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
  classroomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  classroomIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  classroomInfo: {
    flex: 1,
  },
  classroomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  classroomStats: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 2,
  },
  classroomMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#eee',
    borderRadius: 10,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#636e72',
    textTransform: 'uppercase',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  modalBackButton: {
    padding: 5,
    marginTop:30
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
        marginTop:30

  },
  placeholder: {
    width: 34,
  },
  modalContent: {
    padding: 15,
  },
  quizSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quizSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  quizSummaryInfo: {
    marginLeft: 15,
    flex: 1,
  },
  quizSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  quizSummaryDate: {
    fontSize: 14,
    color: '#636e72',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#636e72',
    textTransform: 'uppercase',
  },
  performanceSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 0.48,
  },
  performanceLabel: {
    marginLeft: 8,
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '500',
  },
  chartSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  studentsSection: {
    marginTop: 10,
  },
  studentItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  studentName: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  concentrationScore: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
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
googleClassroomButton: {
  backgroundColor: '#4f46e5',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 18,
  paddingHorizontal: 30,
  borderRadius: 15,
  shadowColor: "#4f46e5",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 8,
},
googleClassroomButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
  marginHorizontal: 10,
},
googleModalContainer: {
  width: "100%",
  height:"100%",
  backgroundColor: "#fff",
  borderRadius: 25,
  padding: 25,
  alignItems: "center",
  shadowColor: "#4285F4",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 20,
  elevation: 15,
},
googleModalHeader: {
  alignItems: "center",
  marginBottom: 20,
  marginTop:30,
},
googleIconWrapper: {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "#E8F0FE",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 10,
  borderWidth: 2,
  borderColor: "#DADCE0",
},
googleModalTitle: {
  fontSize: 20,
  fontWeight: "700",
  color: "#4285F4",
  textAlign: "center",
},
illustrationContainer: {
  alignItems: "center",
  marginBottom: 20,
  backgroundColor: "#F8F9FF",
  borderRadius: 15,
  padding: 10,
},
illustration: {
  alignSelf: 'center',
},
googleModalDescription: {
  fontSize: 16,
  textAlign: "center",
  color: "#5F6368",
  lineHeight: 24,
  marginBottom: 20,
},
featuresList: {
  width: "100%",
  marginBottom: 20,
},
featureItem: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 8,
  paddingHorizontal: 15,
  backgroundColor: "#F8F9FF",
  borderRadius: 10,
  marginBottom: 8,
},
featureText: {
  marginLeft: 12,
  fontSize: 14,
  color: "#202124",
  fontWeight: "500",
},
developmentNotice: {
  alignItems: "center",
  backgroundColor: "#FFF3E0",
  padding: 15,
  borderRadius: 15,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "#FFCC02",
},
developmentText: {
  fontSize: 16,
  fontWeight: "600",
  color: "#FF9800",
  marginTop: 8,
},
developmentSubtext: {
  fontSize: 14,
  color: "#F57C00",
  marginTop: 4,
},
googleModalButton: {
  backgroundColor: "#4285F4",
  borderRadius: 15,
  paddingVertical: 14,
  paddingHorizontal: 30,
  shadowColor: "#4285F4",
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 5,
},
googleModalButtonText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 16,
},
});