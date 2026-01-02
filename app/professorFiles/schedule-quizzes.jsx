import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Client, Databases, ID, Query } from 'react-native-appwrite';
import SmartText from '../../components/SmartText';
import LottieView from 'lottie-react-native';

const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('""');
const databases = new Databases(client);

const DATABASE_ID = '685ae2ba0012dcb2feda';
const CURRICULUM_PLANS_COLLECTION_ID = 'curriculum_plans';
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';
const QUIZ_INFO_COLLECTION_ID = '686315a2000c31e99790';

const ScheduleQuizzesScreen = () => {
  const router = useRouter();
  const { classroomId, profId, planId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState(null);
  const [quizSchedule, setQuizSchedule] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [scheduledQuizzes, setScheduledQuizzes] = useState(new Set());

  useEffect(() => {
    // Force a clean 4-second loading screen
    setLoading(true);

    const timer = setTimeout(() => {
      loadData();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const loadData = async () => {
    try {
      const classroomDoc = await databases.getDocument(
        DATABASE_ID,
        CLASSROOMS_COLLECTION_ID,
        classroomId
      );

      const parsedSchedule = typeof classroomDoc.schedule === 'string' 
        ? JSON.parse(classroomDoc.schedule) 
        : classroomDoc.schedule;

      setClassroom({
        ...classroomDoc,
        schedule: parsedSchedule
      });

      const planDoc = await databases.getDocument(
        DATABASE_ID,
        CURRICULUM_PLANS_COLLECTION_ID,
        planId
      );

      const assessmentPlan = typeof planDoc.assessmentPlan === 'string'
        ? JSON.parse(planDoc.assessmentPlan)
        : planDoc.assessmentPlan;

      setQuizSchedule(assessmentPlan.quizSchedule || []);

      // UPDATED: Check which quizzes are already scheduled by matching topics
      const quizRes = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        [
          Query.equal('quiz-professor', profId),
          Query.equal('plan-id', planId)
        ]
      );

      // Create a Set of scheduled quiz numbers by matching topics
      const scheduled = new Set();
      
      quizRes.documents.forEach(dbQuiz => {
        // Parse the topics from the database quiz
        let dbTopics = [];
        try {
          dbTopics = typeof dbQuiz['quiz-topics'] === 'string' 
            ? JSON.parse(dbQuiz['quiz-topics']) 
            : dbQuiz['quiz-topics'] || [];
        } catch (e) {
          console.warn('Failed to parse quiz topics:', e);
        }

        // Check if this quiz has been scheduled (has scheduled-date or quiz-id)
        if ((dbQuiz['scheduled-date'] || dbQuiz['quiz-id']) && dbTopics.length > 0) {
          // Find matching quiz in schedule by comparing topics
          const matchingQuiz = (assessmentPlan.quizSchedule || []).find(schedQuiz => {
            const schedTopics = schedQuiz.topics || [];
            
            // Compare topics arrays - they should match exactly
            if (dbTopics.length !== schedTopics.length) return false;
            
            // Check if all topics match (order independent)
            return dbTopics.every(topic => schedTopics.includes(topic)) &&
                   schedTopics.every(topic => dbTopics.includes(topic));
          });

          if (matchingQuiz) {
            scheduled.add(matchingQuiz.quizNumber);
          }
        }
      });

      setScheduledQuizzes(scheduled);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load curriculum data');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    const availableDays = Object.keys(classroom.schedule);
    
    for (let week = 0; week < 16; week++) {
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() + (week * 7) + day);
        
        const dayName = daysOfWeek[date.getDay()];
        
        if (availableDays.includes(dayName)) {
          dates.push({
            date: date.toISOString().split('T')[0],
            dayName,
            sessions: classroom.schedule[dayName]
          });
        }
      }
    }
    
    return dates;
  };

  const handleScheduleQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setDatePickerVisible(true);
  };

  const handleDateSelect = (dateInfo) => {
    setSelectedDate(dateInfo.date);
    setDatePickerVisible(false);
    setTimePickerVisible(true);
  };

  const handleTimeSelect = async (session) => {
    setTimePickerVisible(false);

    try {
      const quizData = {
        "quiz-id": ID.unique(),
        "quiz-title": `Quiz ${selectedQuiz.quizNumber} - ${selectedQuiz.type}`,
        "quiz-subject": "To be configured",
        "quiz-icon": "help-circle",
        "quiz-professor": profId,
        "quiz-nb-question": selectedQuiz.questionsPerQuiz || 20,
        "quiz-state": "not-configured",
        "scheduled-date": selectedDate,
        "scheduled-time": session.start,
        "classroom-id": classroomId,
        "plan-id": planId,
        "quiz-topics": JSON.stringify(selectedQuiz.topics || []),
        "quiz-weight": selectedQuiz.weight || 0
      };

      await databases.createDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        ID.unique(),
        quizData
      );

      Alert.alert(
        'Success',
        `Quiz ${selectedQuiz.quizNumber} scheduled for ${selectedDate} at ${session.start}.\n\nYou can now configure it in the Quizzes section.`,
        [
          {
            text: 'Configure Now',
            onPress: () => router.push('/professorFiles/professorCourses')
          },
          {
            text: 'Later',
            style: 'cancel'
          }
        ]
      );

      loadData();

    } catch (error) {
      console.error('Error scheduling quiz:', error);
      Alert.alert('Error', 'Failed to schedule quiz. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
        <LinearGradient
          colors={["#4f46e5", "#7b84f0", "#2f279e"]}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={require('../../animations/loading_animation.json')}
                autoPlay
                loop
                style={styles.loadingLottie}
              />
            </View>
            <SmartText style={styles.loadingTitle}>Quiz Scheduling</SmartText>
            <SmartText style={styles.loadingSubtitle}>Loading your curriculum plan...</SmartText>
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

  const availableDates = getAvailableDates();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      
      <LinearGradient
        colors={['#4f46e5',  "#7b84f0"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity onPress={() => { 
  router.back(); 
  setTimeout(() => router.back(), 100); 
}} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <SmartText style={styles.headerTitle}>Schedule Quizzes</SmartText>
          <SmartText style={styles.headerSubtitle}>{classroom?.name}</SmartText>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="information-outline" size={24} color="#2196f3" />
          <SmartText style={styles.infoText}>
            Schedule your AI-suggested quizzes according to your class sessions. After scheduling, configure them in the Quizzes section.
          </SmartText>
        </View>

        <View style={styles.section}>
          <SmartText style={styles.sectionTitle}>Your Class Schedule</SmartText>
          {Object.entries(classroom?.schedule || {}).map(([day, sessions]) => (
            <View key={day} style={styles.scheduleDay}>
              <SmartText style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</SmartText>
              {sessions.map((session, idx) => (
                <View key={idx} style={styles.sessionInfo}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#636e72" />
                  <SmartText style={styles.sessionText}>
                    {session.start} - {session.end} ({session.type})
                  </SmartText>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SmartText style={styles.sectionTitle}>
            AI Suggested Quizzes ({quizSchedule.length})
          </SmartText>
          
          {quizSchedule.map((quiz, index) => {
            const isScheduled = scheduledQuizzes.has(quiz.quizNumber);
            
            return (
              <View key={index} style={styles.quizCard}>
                <View style={styles.quizHeader}>
                  <View style={styles.quizNumberBadge}>
                    <SmartText style={styles.quizNumberText}>{quiz.quizNumber}</SmartText>
                  </View>
                  <View style={styles.quizInfo}>
                    <SmartText style={styles.quizType}>{quiz.type}</SmartText>
                    <SmartText style={styles.quizWeek}>Week {quiz.week}</SmartText>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isScheduled ? styles.statusScheduled : styles.statusPending
                  ]}>
                    <MaterialCommunityIcons 
                      name={isScheduled ? "check-circle" : "clock-outline"} 
                      size={16} 
                      color={isScheduled ? "#27ae60" : "#f39c12"} 
                    />
                    <SmartText style={[
                      styles.statusText,
                      isScheduled ? styles.statusTextScheduled : styles.statusTextPending
                    ]}>
                      {isScheduled ? "Scheduled" : "Pending"}
                    </SmartText>
                  </View>
                </View>

                {quiz.topics && quiz.topics.length > 0 && (
                  <View style={styles.topicsContainer}>
                    <SmartText style={styles.topicsLabel}>Topics:</SmartText>
                    <SmartText style={styles.topicsText}>{quiz.topics.join(', ')}</SmartText>
                  </View>
                )}

                <View style={styles.quizDetails}>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="weight" size={16} color="#636e72" />
                    <SmartText style={styles.detailText}>{quiz.weight}% weight</SmartText>
                  </View>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="timer" size={16} color="#636e72" />
                    <SmartText style={styles.detailText}>{quiz.estimatedDuration}</SmartText>
                  </View>
                </View>

                {!isScheduled && (
                  <TouchableOpacity
                    style={styles.scheduleButton}
                    onPress={() => handleScheduleQuiz(quiz)}
                  >
                    <MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" />
                    <SmartText style={styles.scheduleButtonText}>Schedule This Quiz</SmartText>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <SmartText style={styles.modalTitle}>Select Date</SmartText>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            
            <SmartText style={styles.modalSubtitle}>
              Choose a date when you have class sessions
            </SmartText>

            <ScrollView style={styles.dateList}>
              {availableDates.map((dateInfo, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dateOption}
                  onPress={() => handleDateSelect(dateInfo)}
                >
                  <View style={styles.dateIconContainer}>
                    <MaterialCommunityIcons name="calendar" size={24} color="#4f46e5" />
                  </View>
                  <View style={styles.dateDetails}>
                    <SmartText style={styles.dateText}>
                      {new Date(dateInfo.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </SmartText>
                    <SmartText style={styles.dateSubtext}>
                      {dateInfo.sessions.length} session(s) available
                    </SmartText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#95a5a6" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <SmartText style={styles.modalTitle}>Select Time Slot</SmartText>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <SmartText style={styles.modalSubtitle}>
              {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </SmartText>

            <ScrollView style={styles.timeList}>
              {selectedDate && availableDates
                .find(d => d.date === selectedDate)
                ?.sessions.map((session, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.timeOption}
                    onPress={() => handleTimeSelect(session)}
                  >
                    <View style={styles.timeIconContainer}>
                      <MaterialCommunityIcons name="clock-outline" size={24} color="#4f46e5" />
                    </View>
                    <View style={styles.timeDetails}>
                      <SmartText style={styles.timeText}>
                        {session.start} - {session.end}
                      </SmartText>
                      <SmartText style={styles.timeSubtext}>
                        {session.type} • {session.room || classroom.room || 'No room specified'}
                      </SmartText>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#95a5a6" />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // UPDATED: Loading Styles (matching planify-class)
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
  
  header: {
    paddingTop: 45,
    paddingBottom: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
  },
  headerContent: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 15,
    marginBottom:30,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#1976d2',
    lineHeight: 18,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  scheduleDay: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4f46e5',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginTop: 4,
  },
  sessionText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#636e72',
  },
  quizCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  quizNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quizNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quizInfo: {
    flex: 1,
  },
  quizType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  quizWeek: {
    fontSize: 13,
    color: '#636e72',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusScheduled: {
    backgroundColor: '#d4edda',
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusTextScheduled: {
    color: '#27ae60',
  },
  statusTextPending: {
    color: '#f39c12',
  },
  topicsContainer: {
    marginBottom: 10,
  },
  topicsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636e72',
    marginBottom: 4,
  },
  topicsText: {
    fontSize: 13,
    color: '#2c3e50',
  },
  quizDetails: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  detailText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#636e72',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 12,
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#636e72',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop:10,
  },
  dateList: {
    maxHeight: 400,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    marginBottom:20,
  },
  dateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  dateDetails: {
    flex: 1,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  dateSubtext: {
    fontSize: 13,
    color: '#636e72',
    marginTop: 2,
  },
  timeList: {
    maxHeight: 500,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    marginBottom:20,
  },
  timeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  timeDetails: {
    flex: 1,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  timeSubtext: {
    fontSize: 13,
    color: '#636e72',
    marginTop: 2,
  },
});

export default ScheduleQuizzesScreen;