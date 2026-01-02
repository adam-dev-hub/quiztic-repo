import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, Query, ID } from 'react-native-appwrite';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import {showToast} from '../../lib/toasthelper';
import SmartText from "../../components/SmartText";

// --- Appwrite Configuration ---
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('""');
const databases = new Databases(client);

// --- Collection IDs ---
const DATABASE_ID = '685ae2ba0012dcb2feda';
const SUBMISSIONS_COLLECTION_ID = '687ec5cd0008660447d4';
const QUIZ_INFO_COLLECTION_ID = '686315a2000c31e99790';
const STUDENT_METRICS_COLLECTION_ID = '688ccc55000bfbc509d5';
const PEDAGOGICAL_TIPS_COLLECTION_ID = '688ccdfa00105912b620';
const STUDENTS_COLLECTION_ID = '685aec0b0015ee8e5254';
const CLASS_SUMMARY_COLLECTION_ID='class_summary_collection';
const ACTIVE_QUIZZES_COLLECTION_ID='68764f2a001a9f312390';
const QUIZ_SESSION_PARTICIPANTS_COLLECTION_ID = '687ec780001053a5ec08';
const CLASSROOMS_COLLECTION_ID = "professor_classrooms";


// --- Dimensions ---
const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 40;

// --- Helper Functions ---
const getTipIcon = (tipType) => {
  switch (tipType) {
    case 'struggling': return 'help-circle-outline';
    case 'distraction': return 'eye-off-outline';
    case 'guessing_behavior': return 'dice-5-outline';
    case 'performance_decline': return 'trending-down';
    case 'widespread_difficulty': return 'account-group-outline';
    case 'widespread_difficulty_hard': return 'account-group';
    case 'question_misposed': return 'alert-octagon';
    case 'timeout': return 'timer-off-outline';
    case 'hesitation': return 'timer-sand';
    case 'rushing': return 'run-fast';
    default: return 'lightbulb-on-outline';
  }
};

const getTipColor = (tipType) => {
  switch (tipType) {
    case 'struggling': return '#e74c3c';
    case 'distraction': return '#9b59b6';
    case 'performance_decline': return '#e67e22';
    case 'widespread_difficulty': return '#e74c3c';
    case 'widespread_difficulty_hard': return '#c0392b';
    case 'question_misposed': return '#d35400';
    case 'timeout': return '#8e44ad';
    case 'hesitation': return '#f1c40f';
    case 'rushing': return '#2980b9';
    default: return '#3498db';
  }
};

// Updated categories to match backend
const categoryColors = {
  Excellent: '#27ae60',    // dark green
  Improving: '#2ecc71',    // green
  Consistent: '#3498db',   // blue
  Average: '#95a5a6',      // grey
  Struggling: '#e74c3c',   // red
  Rushing: '#f39c12',      // orange
  Distracted: '#9b59b6',   // purple
  'N/A': '#bdc3c7'         // light grey
};

const getStatusColor = (status) => categoryColors[status] || '#95a5a6';

// Helper to get status icon
const getStatusIcon = (status) => {
  switch (status) {
    case 'Excellent': return 'star';
    case 'Improving': return 'trending-up';
    case 'Consistent': return 'check-circle';
    case 'Average': return 'minus-circle';
    case 'Struggling': return 'help-circle';
    case 'Rushing': return 'run-fast';
    case 'Distracted': return 'eye-off';
    default: return 'help-circle-outline';
  }
};

const LiveQuizDashboard = () => {
  const router = useRouter();
  const { quizId, quizTitle, sessionId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [quizDetails, setQuizDetails] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [studentData, setStudentData] = useState({});
  const [studentMetrics, setStudentMetrics] = useState([]);
  const [pedagogicalTips, setPedagogicalTips] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentNames, setStudentNames] = useState({});
  const [endModalVisible, setEndModalVisible] = useState(false);
const [classroomName, setClassroomName] = useState('');
const [settings, setSettings] = useState('');
const [classrooms, setClassrooms] = useState([]); // Example default list
const [newClassName, setNewClassName] = useState("");
const [sessionIdState, setSessionId] = useState(sessionId || null);
const [ending, setEnding] = useState(false);



useEffect(() => {
  const fetchSessionId = async () => {
    if (!sessionId && quizId) {
      try {
        const res = await databases.listDocuments(
          DATABASE_ID,
          ACTIVE_QUIZZES_COLLECTION_ID,
          [
            Query.equal("quiz_id", quizId),
            Query.equal("is_started", true),
            Query.isNull("is_completed"),
            Query.limit(1)
          ]
        );
        if (res.total > 0) {
          const activeSession = res.documents[0];
          console.log("Fetched session from DB:", activeSession.$id);
          setSessionId(activeSession.$id);  // <-- new state
          console.log("Using session ID:", activeSession.$id);
        } else {
          console.warn("No active session found for quiz", quizId);
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      }
    }
  };

  fetchSessionId();
}, [quizId, sessionId]);
useEffect(() => {
  if (stats?.mostPerformant && !studentNames[stats.mostPerformant]) {
    fetchStudentName(stats.mostPerformant);
  }
  if (stats?.leastPerformant && !studentNames[stats.leastPerformant]) {
    fetchStudentName(stats.leastPerformant);
  }
}, [stats?.mostPerformant, stats?.leastPerformant, studentNames]);


const fetchClassrooms = async () => {
  try {
    const res = await databases.listDocuments(
      DATABASE_ID,
      CLASSROOMS_COLLECTION_ID,
      [Query.equal("professorId", quizDetails["quiz-professor"])]
    );
    setClassrooms(res.documents.map(doc => doc.name));
  } catch (err) {
    console.error("Failed to fetch classrooms:", err);
  }
};
const allStudentsCompleted = useMemo(() => {
  if (!quizDetails?.['quiz-nb-question'] || studentMetrics.length === 0) return false;
  const totalQuestions = quizDetails['quiz-nb-question'];
  return studentMetrics.every(
    (s) => s.sessionId === sessionIdState && s.questionsAnswered >= totalQuestions
  );
}, [studentMetrics, quizDetails, sessionIdState]);

  // --- Fetch student name function ---
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
  const handleEndQuiz = async () => {
  if (ending) return;
  setEnding(true);
  try {
    // find active quiz doc to extract settings
    const activeQuizRes = await databases.listDocuments(
      DATABASE_ID,
      ACTIVE_QUIZZES_COLLECTION_ID,
      [Query.equal("quiz_id", quizId), Query.equal("$id", sessionIdState)]
    );
    const activeQuizDoc = activeQuizRes.documents[0];

    // compute start time from first metric of this session
    const sessionMetrics = studentMetrics.filter(m => m.sessionId === sessionIdState);
    const firstMetricTime = sessionMetrics.length > 0
      ? new Date(Math.min(...sessionMetrics.map(m => new Date(m.$createdAt).getTime())))
      : null;
    let parsedConfig = {};
try {
  parsedConfig = activeQuizDoc?.config ? JSON.parse(activeQuizDoc.config) : {};
} catch (err) {
  console.error("Failed to parse activeQuizDoc.config:", err);
}

    const endedAt = new Date();
    const diffMs = firstMetricTime ? endedAt.getTime() - firstMetricTime.getTime() : null;

    // format timePassed
    let timePassed = null;
    if (diffMs !== null) {
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      timePassed =
        (hours > 0 ? `${hours}h ` : "") +
        (minutes > 0 ? `${minutes}m ` : "") +
        `${seconds}s`;
    }

    // build summary
    const summary = {
      quizId,
      sessionId: sessionIdState,
      professorId: quizDetails['quiz-professor'],
      classroomName,
      totalStudents: stats?.totalStudents || 0,
      students: JSON.stringify(
  sessionMetrics.map(s => ({
    id: s.studentId,
    concentration: s.concentrationIndex ?? null,
  }))
),
     classFocusRate: Math.round(stats.classConcentrationIndex),
      mostPerformant: stats?.mostPerformant || null,
      leastPerformant: stats?.leastPerformant || null,
     settings: JSON.stringify({
    allowSelfTesting: parsedConfig.allowSelfTesting ?? null,
    registerAsSupport: parsedConfig.registerAsSupport ?? null,
    sessionId: sessionIdState,
  }),
      createdAt: endedAt.toISOString(),
      timePassed, // e.g. "8m 20s"
    };

    // store in class summary
    await databases.createDocument(
      DATABASE_ID,
      CLASS_SUMMARY_COLLECTION_ID,
      ID.unique(),
      summary
    );

    // mark quiz as completed
    await databases.updateDocument(
      DATABASE_ID,
      QUIZ_INFO_COLLECTION_ID,
      quizId,
      { 'quiz-state': 'completed' }
    );

    // clean up related docs
    const deleteDocs = async (collectionId, field, value) => {
      const res = await databases.listDocuments(DATABASE_ID, collectionId, [
        Query.equal(field, value),
        Query.limit(100)
      ]);
      await Promise.all(res.documents.map(doc =>
        databases.deleteDocument(DATABASE_ID, collectionId, doc.$id)
      ));
    };

    await deleteDocs(PEDAGOGICAL_TIPS_COLLECTION_ID, 'quizId', quizId);
    await deleteDocs(ACTIVE_QUIZZES_COLLECTION_ID, 'quiz_id', quizId);
    await deleteDocs(STUDENT_METRICS_COLLECTION_ID, 'sessionId', sessionIdState);
    await deleteDocs(QUIZ_SESSION_PARTICIPANTS_COLLECTION_ID, 'session_id', sessionIdState);

    setEndModalVisible(false);
    router.replace('../professorFiles/professorCourses');
  } catch (err) {
    console.error("Failed to end quiz:", err);
  } finally {
    setEnding(false);
  }
};


  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [quizRes, metricsRes, tipsRes, submissionsRes] = await Promise.all([
          databases.getDocument(DATABASE_ID, QUIZ_INFO_COLLECTION_ID, quizId),
          databases.listDocuments(DATABASE_ID, STUDENT_METRICS_COLLECTION_ID, [
            Query.equal('quizId', quizId),
            Query.limit(100)
          ]),
          databases.listDocuments(DATABASE_ID, PEDAGOGICAL_TIPS_COLLECTION_ID, [
            Query.equal('quizId', quizId),
            Query.orderDesc('timestamp'),
            Query.limit(100)
          ]),
          databases.listDocuments(DATABASE_ID, SUBMISSIONS_COLLECTION_ID, [
            Query.equal('quiz_id', quizId),
            Query.limit(500)
          ])
        ]);

        setQuizDetails(quizRes);
        setStudentMetrics(metricsRes.documents);
        setPedagogicalTips(tipsRes.documents);
        setSubmissions(submissionsRes.documents);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const unsubscribeMetrics = client.subscribe(
      `databases.${DATABASE_ID}.collections.${STUDENT_METRICS_COLLECTION_ID}.documents`,
      response => {
        const payload = response.payload;
        if (String(payload.quizId) === String(quizId)) {
          setStudentMetrics(prev => {
            const index = prev.findIndex(s => s.$id === payload.$id);
            if (index > -1) {
              const updated = [...prev];
              updated[index] = payload;
              return updated;
            }
            return [...prev, payload];
          });
        }
      }
    );

    const unsubscribeTips = client.subscribe(
      `databases.${DATABASE_ID}.collections.${PEDAGOGICAL_TIPS_COLLECTION_ID}.documents`,
      response => {
        const newTip = response.payload;
        if (String(newTip.quizId) !== String(quizId)) return;

        setPedagogicalTips(prev => {
          const existingIndex = prev.findIndex(t => t.$id === newTip.$id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newTip;
            return updated;
          }
          return [newTip, ...prev];
        });
      }
    );

    return () => {
      unsubscribeMetrics();
      unsubscribeTips();
    };
  }, [quizId]);

  const stats = useMemo(() => {
    if (studentMetrics.length === 0) return null;

    const totalStudents = studentMetrics.length;
    const totalQuestions = quizDetails?.['quiz-nb-question'] || 1;
    const completedStudents = studentMetrics.filter(s => s.questionsAnswered >= totalQuestions).length;

    const classConcentrationIndex = studentMetrics.reduce((sum, s) => sum + (s.concentrationIndex || 0), 0) / totalStudents;
    const classHesitationIndex = studentMetrics.reduce((sum, s) => sum + (s.hesitationIndex || 0), 0) / totalStudents;
    const classRushIndex = studentMetrics.reduce((sum, s) => sum + (s.rushIndex || 0), 0) / totalStudents;
    // Get mostPerformant and leastPerformant from the backend data
const mostPerformant = studentMetrics[0]?.mostPerformantStudentId || null;
const leastPerformant = studentMetrics[0]?.leastPerformantStudentId || null;

    // Enhanced: Build pie chart data from performanceStatus (the JSON distribution)
    let performanceStatusData = [];
    if (studentMetrics.length > 0 && studentMetrics[0].performanceStatus) {
      try {
        const statusDistribution = JSON.parse(studentMetrics[0].performanceStatus);
        performanceStatusData = Object.keys(statusDistribution)
          .filter(status => statusDistribution[status] > 0) // Only show non-zero categories
          .map(status => ({
            name: status,
            population: statusDistribution[status],
            color: categoryColors[status] || '#95a5a6',
            legendFontColor: '#7F7F7F',
            legendFontSize: 12
          }));
      } catch (e) {
        console.log("Failed to parse performanceStatus distribution");
      }
    }

    // Fallback: Build from individual student labels if distribution not available
    if (performanceStatusData.length === 0) {
      const statusCounts = studentMetrics.reduce((acc, s) => {
        const label = s.performanceStatusLabel || 'Average';
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});

      performanceStatusData = Object.keys(statusCounts).map(status => ({
        name: status,
        population: statusCounts[status],
        color: categoryColors[status] || '#95a5a6',
        legendFontColor: '#7F7F7F',
        legendFontSize: 12
      }));
    }

    return {
      totalStudents,
      completedStudents,
      classConcentrationIndex,
      classHesitationIndex,
      classRushIndex,
      performanceStatusData,
      mostPerformant,
     leastPerformant,
    };
  }, [studentMetrics, quizDetails]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'students':
        return (
          <View style={styles.tabContent}>
            <SmartText style={styles.sectionTitle}>Student Performance</SmartText>
            <FlatList
              data={studentMetrics.sort((a, b) => (b.concentrationIndex || 0) - (a.concentrationIndex || 0))}
              keyExtractor={item => item.$id}
              renderItem={({ item }) => {
                const studentName = studentNames[item.studentId];
                if (!studentName) {
                  fetchStudentName(item.studentId);
                }

                // Parse last5 performance for mini chart
                let last5Performance = [];
                try {
                  if (item.last5QuestionsPerformance) {
                    last5Performance = JSON.parse(item.last5QuestionsPerformance);
                  }
                } catch (e) {
                  console.log("Failed to parse last5 performance");
                }

                return (
                  <View style={styles.studentCard}>
                    <View style={styles.studentInfo}>
                      <View style={styles.studentNameContainer}>
                        <MaterialCommunityIcons 
                          name={getStatusIcon(item.performanceStatusLabel)} 
                          size={16} 
                          color={getStatusColor(item.performanceStatusLabel)}
                          style={styles.statusIcon}
                        />
                        <SmartText style={styles.studentName}>
                          {studentName || `Student ${item.studentId.slice(0, 6)}`}
                        </SmartText>
                      </View>
                      <SmartText style={[
                        styles.statusLabel, 
                        { backgroundColor: getStatusColor(item.performanceStatusLabel) }
                      ]}>
                        {item.performanceStatusLabel || 'Average'}
                      </SmartText>
                    </View>
                    
                    <View style={styles.metricGauges}>
                      <View style={styles.gaugeItem}>
                        <SmartText style={styles.gaugeLabel}>Concentration</SmartText>
                        <SmartText style={[
                          styles.gaugeValue,
                          { color: item.concentrationIndex >= 70 ? '#27ae60' : item.concentrationIndex >= 50 ? '#f39c12' : '#e74c3c' }
                        ]}>
 {item.questionsAnswered > 0 && item.concentrationIndex != null
    ? `${item.concentrationIndex}%`
    : "-"}                        </SmartText>
                      </View>
                      <View style={styles.gaugeItem}>
                        <SmartText style={styles.gaugeLabel}>Hesitation</SmartText>
                        <SmartText style={[
                          styles.gaugeValue,
                          { color: item.hesitationIndex > 50 ? '#e74c3c' : '#95a5a6' }
                        ]}>
                          {item.questionsAnswered > 0 && item.hesitationIndex != null
    ? `${item.hesitationIndex}%`
    : "-"}
                        </SmartText>
                      </View>
                      <View style={styles.gaugeItem}>
                        <SmartText style={styles.gaugeLabel}>Rushing</SmartText>
                        <SmartText style={[
                          styles.gaugeValue,
                          { color: item.rushIndex > 40 ? '#f39c12' : '#95a5a6' }
                        ]}>
                         {item.questionsAnswered > 0 && item.rushIndex != null
    ? `${item.rushIndex}%`
    : "-"}
                        </SmartText>
                      </View>
                    </View>

                    <View style={styles.miniChartContainer}>
                      <SmartText style={styles.miniChartTitle}>
                        Recent Performance (last {last5Performance.length})
                      </SmartText>
                      <View style={styles.miniChart}>
                        {last5Performance.map((perf, index) => (
                          <View 
                            key={index} 
                            style={[
                              styles.miniBar, 
                              { 
                                backgroundColor: perf.isCorrect ? '#2ecc71' : '#e74c3c',
                                height: perf.difficulty ? Math.max(10, perf.difficulty * 5) : 15 // Height based on difficulty
                              }
                            ]}
                          />
                        ))}
                        {/* Fill empty slots */}
                        {[...Array(Math.max(0, 5 - last5Performance.length))].map((_, index) => (
                          <View 
                            key={`empty-${index}`}
                            style={[styles.miniBar, { backgroundColor: '#ecf0f1', height: 15 }]}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Questions answered progress */}
                    <View style={styles.progressContainer}>
                      <SmartText style={styles.progressLabel}>
                        Progress: {item.questionsAnswered || 0}/{quizDetails?.['quiz-nb-question'] || '?'}
                      </SmartText>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { 
                              width: `${Math.min(100, ((item.questionsAnswered || 0) / (quizDetails?.['quiz-nb-question'] || 1)) * 100)}%`
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        );

      case 'analytics':
        return (
          <View style={styles.tabContent}>
            <SmartText style={styles.sectionTitle}>Performance Analytics</SmartText>
            
            {/* Top and bottom performers */}
            <View style={styles.performersContainer}>
              <View style={styles.performerCard}>
                <MaterialCommunityIcons name="trophy" size={24} color="#f1c40f" />
                <SmartText style={styles.performerLabel}>Top Performer</SmartText>
                <SmartText style={styles.performerName}>
                  {studentNames[stats?.mostPerformant] || `Student ${stats?.mostPerformant?.slice(0, 6)}` || 'None'}
                </SmartText>
              </View>
              <View style={styles.performerCard}>
                <MaterialCommunityIcons name="help-circle" size={24} color="#e74c3c" />
                <SmartText style={styles.performerLabel}>Needs Support</SmartText>
                <SmartText style={styles.performerName}>
                  {studentNames[stats?.leastPerformant] || `Student ${stats?.leastPerformant?.slice(0, 6)}` || 'None'}
                </SmartText>
              </View>
            </View>

            {/* Class distribution chart */}
            <View style={styles.chartContainer}>
              <SmartText style={styles.chartTitle}>Performance Distribution</SmartText>
              {stats?.performanceStatusData?.length > 0 ? (
                <PieChart
                  data={stats.performanceStatusData}
                  width={chartWidth}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0,0,0,${opacity})`
                  }}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"15"}
                  absolute
                />
              ) : (
                <SmartText style={styles.noDataText}>No performance data available</SmartText>
              )}
            </View>

            {/* Recent tips analysis */}
            <View style={styles.tipsAnalysisContainer}>
              <SmartText style={styles.sectionTitle}>Common Issues</SmartText>
              {(() => {
                const tipCounts = pedagogicalTips.reduce((acc, tip) => {
                  acc[tip.tipType] = (acc[tip.tipType] || 0) + 1;
                  return acc;
                }, {});
                
                return Object.entries(tipCounts)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([tipType, count]) => (
                    <View key={tipType} style={styles.issueItem}>
                      <MaterialCommunityIcons 
                        name={getTipIcon(tipType)} 
                        size={20} 
                        color={getTipColor(tipType)} 
                      />
                      <SmartText style={styles.issueText}>
                        {tipType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: {count} alerts
                      </SmartText>
                    </View>
                  ));
              })()}
            </View>
          </View>
        );

      default: // overview
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="account-group" size={24} color="#4f46e5" />
                <SmartText style={styles.statValue}>{stats?.totalStudents || 0}</SmartText>
                <SmartText style={styles.statLabel}>Students</SmartText>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#4f46e5" />
                <SmartText style={styles.statValue}>{stats?.completedStudents || 0}</SmartText>
                <SmartText style={styles.statLabel}>Completed</SmartText>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="brain" size={24} color="#4f46e5" />
                <SmartText style={styles.statValue}>{stats?.classConcentrationIndex.toFixed(0) || '0'}%</SmartText>
                <SmartText style={styles.statLabel}>Class Focus</SmartText>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="timer-sand" size={24} color="#f39c12" />
                <SmartText style={styles.statValue}>{stats?.classHesitationIndex.toFixed(0) || '0'}%</SmartText>
                <SmartText style={styles.statLabel}>Hesitation</SmartText>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="run-fast" size={24} color="#e74c3c" />
                <SmartText style={styles.statValue}>{stats?.classRushIndex.toFixed(0) || '0'}%</SmartText>
                <SmartText style={styles.statLabel}>Rush Rate</SmartText>
              </View>
            </View>
            
            <View style={styles.chartContainer}>
              <SmartText style={styles.chartTitle}>Student Status Overview</SmartText>
              {stats?.performanceStatusData?.length > 0 ? (
                <PieChart
                  data={stats.performanceStatusData}
                  width={chartWidth}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0,0,0,${opacity})`
                  }}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"15"}
                  absolute
                />
              ) : (
                <SmartText style={styles.noDataText}>Waiting for student data...</SmartText>
              )}
            </View>

            <SmartText style={styles.sectionTitle}>Live Activity Feed</SmartText>
            <FlatList
              data={pedagogicalTips.slice(0, 8)}
              keyExtractor={(item) => item.$id}
              renderItem={({ item }) => {
                const studentName = studentNames[item.studentId];
                if (item.studentId && !studentName) {
                  fetchStudentName(item.studentId);
                }
                return (
                  <View style={styles.tipCard}>
                    <MaterialCommunityIcons 
                      name={getTipIcon(item.tipType)} 
                      size={24} 
                      color={getTipColor(item.tipType)} 
                    />
                    <View style={styles.tipContent}>
                      <SmartText style={styles.tipText}>{item.tipText}</SmartText>
                      <SmartText style={styles.tipMeta}>
                        {new Date(item.timestamp).toLocaleTimeString()} • {
                          item.studentId 
                            ? studentName || `Student ${item.studentId.slice(0, 6)}` 
                            : 'Class-wide'
                        }
                      </SmartText>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyTips}>
                  <MaterialCommunityIcons name="lightbulb-outline" size={40} color="#bdc3c7" />
                  <SmartText style={styles.emptyTipsText}>Monitoring student activity...</SmartText>
                </View>
              }
            />
          </View>
        );
    }
  };

  if (loading) {
      return (
        <SafeAreaView style={styles.safeArean}>
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
              <SmartText style={styles.loadingText}>Loading Stats...</SmartText>
            </View>
          </LinearGradient>
        </SafeAreaView>
      );}

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      <LinearGradient 
        colors={['#4f46e5', '#857be3']} 
        style={styles.header} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity 
          onPress={() => router.push('../professorFiles/professorCourses')} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <SmartText style={styles.quizTitle} numberOfLines={1}>
            {quizTitle || 'Live Quiz'}
          </SmartText>
          <SmartText style={styles.quizStatus}>
            In Progress • {stats?.totalStudents || 0} Students
          </SmartText>
        </View>
        <TouchableOpacity style={styles.endQuizButton} onPress={() => {}}>
          <TouchableOpacity
  style={styles.endQuizButton}
  onPress={() => {
  fetchClassrooms();
  setEndModalVisible(true);
}}
>
  <SmartText style={styles.endQuizButtonText}>End Quiz</SmartText>
</TouchableOpacity>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]} 
          onPress={() => setActiveTab('overview')}
        >
          <MaterialCommunityIcons 
            name="view-dashboard" 
            size={20} 
            color={activeTab === 'overview' ? '#4f46e5' : '#95a5a6'} 
          />
          <SmartText style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </SmartText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'students' && styles.activeTab]} 
          onPress={() => setActiveTab('students')}
        >
          <MaterialCommunityIcons 
            name="account-group" 
            size={20} 
            color={activeTab === 'students' ? '#4f46e5' : '#95a5a6'} 
          />
          <SmartText style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
            Students
          </SmartText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]} 
          onPress={() => setActiveTab('analytics')}
        >
          <MaterialCommunityIcons 
            name="chart-line" 
            size={20} 
            color={activeTab === 'analytics' ? '#4f46e5' : '#95a5a6'} 
          />
          <SmartText style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
            Analytics
          </SmartText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {renderTabContent()}
      </ScrollView>
      <Modal visible={endModalVisible} transparent animationType="slide">
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)'
  }}>
    <View style={{
      width: '85%',
      backgroundColor: '#fff',
      borderRadius: 15,
      padding: 20
    }}>
      <SmartText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
        End Quiz - Save Summary
      </SmartText>

      {/* Classrooms list */}
      <SmartText style={{ marginBottom: 8 }}>Select Classroom</SmartText>
      {classrooms.map((cls, index) => (
        <TouchableOpacity
          key={index}
          style={{
            padding: 12,
            marginVertical: 4,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: classroomName === cls ? "#4f46e5" : "#ccc",
            backgroundColor: classroomName === cls ? "#4f46e533" : "#fff"
          }}
          onPress={() => setClassroomName(cls)}
        >
          <SmartText style={{ color: '#2d3436' }}>{cls}</SmartText>
        </TouchableOpacity>
      ))}

      {/* Add new classroom */}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <TouchableOpacity
  style={{ 
    padding: 15, 
    backgroundColor: '#3498db', 
    borderRadius: 10,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  }}
  onPress={() => {
    setEndModalVisible(false);
    router.push('./create-class'); // Navigate to create classroom screen
  }}
>
  <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
  <SmartText style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>
    Create New Classroom
  </SmartText>
</TouchableOpacity>

      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
        <TouchableOpacity
          style={{ padding: 12, backgroundColor: '#e74c3c', borderRadius: 10 }}
          onPress={() => setEndModalVisible(false)}
        >
          <SmartText style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</SmartText>
        </TouchableOpacity>

        <TouchableOpacity
  style={{
    padding: 12,
    backgroundColor: allStudentsCompleted && classroomName && !ending ? '#27ae60' : '#95a5a6',
    borderRadius: 10
  }}
  onPress={handleEndQuiz}
  disabled={!allStudentsCompleted || !classroomName || ending}
>
  <SmartText style={{ color: '#fff', fontWeight: 'bold' }}>
    {ending ? 'Ending...' : 'Confirm'}
  </SmartText>
</TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  safeArean: {
    flex: 1,
    backgroundColor: "#4f46e5",

  },
   loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 20,
   },
   loadingAnimation: {
    width: 150,
    height: 150,
  },
  header: { 
    paddingTop: 45, 
    paddingBottom: 15, 
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 4, 
    elevation: 5, 
    zIndex: 10 
  },
  backButton: { padding: 5 },
  headerContent: { flex: 1, marginHorizontal: 15 },
  quizTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  quizStatus: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 },
  endQuizButton: { 
    backgroundColor: '#e74c3c', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  endQuizButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  tabs: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0', 
    backgroundColor: '#fff' 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 5 
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#4f46e5' },
  tabText: { marginLeft: 5, fontSize: 14, color: '#95a5a6' },
  activeTabText: { color: '#4f46e5', fontWeight: 'bold' },
  content: { flex: 1, backgroundColor: '#f8f9fa' },
  tabContent: { padding: 15 },
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-around', 
    marginBottom: 10 
  },
  statCard: { 
    width: '31%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 10, 
    marginBottom: 10, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
    elevation: 2 
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#2d3436', marginVertical: 5 },
  statLabel: { fontSize: 11, color: '#636e72', textTransform: 'uppercase', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2d3436', marginBottom: 15, marginTop: 10 },
  chartContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 15, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
    elevation: 2, 
    alignItems: 'center' 
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#636e72', marginBottom: 10, textAlign: 'center' },
  noDataText: { fontSize: 14, color: '#95a5a6', textAlign: 'center', marginVertical: 30 },
  tipCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 10, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    elevation: 1 
  },
   loadingContent: {
    alignItems: 'center',
  },
  tipContent: { flex: 1, marginLeft: 10 },
  tipText: { fontSize: 14, color: '#2d3436', lineHeight: 20 },
  tipMeta: { fontSize: 12, color: '#95a5a6', marginTop: 5 },
  emptyTips: { alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTipsText: { marginTop: 10, color: '#bdc3c7', textAlign: 'center' },
  studentCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    elevation: 1 
  },
  studentInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 15, 
    alignItems: 'center' 
  },
  studentNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  statusIcon: {
    marginRight: 8
  },
  studentName: { fontSize: 16, fontWeight: '600', color: '#2d3436', flex: 1 },
  statusLabel: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 12, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10, 
    overflow: 'hidden' 
  },
  metricGauges: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  gaugeItem: { alignItems: 'center' },
  gaugeLabel: { fontSize: 12, color: '#636e72' },
  gaugeValue: { fontSize: 18, fontWeight: 'bold', color: '#2d3436' },
  miniChartContainer: { marginTop: 5, marginBottom: 10 },
  miniChartTitle: { fontSize: 12, color: '#636e72', marginBottom: 8, textAlign: 'center' },
  miniChart: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'flex-end', 
    height: 30,
    paddingHorizontal: 10
  },
  miniBar: { 
    width: 12, 
    marginHorizontal: 2, 
    backgroundColor: '#ccc', 
    borderRadius: 2,
    minHeight: 8
  },
  progressContainer: { 
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1'
  },
  progressLabel: { 
    fontSize: 12, 
    color: '#636e72', 
    marginBottom: 8,
    textAlign: 'center'
  },
  progressBar: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 3
  },
  performersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  performerCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  performerLabel: {
    fontSize: 12,
    color: '#636e72',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center'
  },
  performerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
    textAlign: 'center'
  },
  tipsAnalysisContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa'
  },
  issueText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#2d3436',
    flex: 1
  }
});
export default LiveQuizDashboard;