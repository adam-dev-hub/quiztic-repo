// quizSummary.jsx
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, ID, Query } from 'react-native-appwrite';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import SmartText from "../../components/SmartText";

// --- Appwrite Configuration ---
const client = new Client().setEndpoint('https://cloud.appwrite.io/v1').setProject('');
const databases = new Databases(client);

const DATABASE_ID = '685ae2ba0012dcb2feda';
const QUESTIONS_COLLECTION = '68764f2a001a9f312389';
const SUBMISSIONS_COLLECTION = '687ec5cd0008660447d4';
const QUIZ_RESULTS_COLLECTION = '688ac9da003a6b78f674';
const QUIZ_COLLECTION = '686315a2000c31e99790';

// --- Context for Theme and Accessibility ---
const AppContext = React.createContext();

const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  const getThemeColors = () => {
    return theme === 'light'
      ? {
          background: '#f5f5f5', cardBackground: '#fff', text: '#2c3e50',
          secondaryText: '#636e72', border: '#e0e0e0', primary: '#6c5ce7',
          gradientStart: '#6c5ce7', gradientEnd: '#a29bfe', correct: '#00b894',
          incorrect: '#d63031', success: '#00b894', warning: '#f39c12',
        }
      : {
          background: '#1a1a2e', cardBackground: '#2a0040', text: '#e0e0e0',
          secondaryText: '#b0b0b0', border: '#4a4a60', primary: '#8e44ad',
          gradientStart: '#2c3e50', gradientEnd: '#34495e', correct: '#2ecc71',
          incorrect: '#e74c3c', success: '#2ecc71', warning: '#f39c12',
        };
  };
  const getTextSizeMultiplier = () => 1.0;
  return (
    <AppContext.Provider value={{ getThemeColors, getTextSizeMultiplier }}>
      {children}
    </AppContext.Provider>
  );
};

// --- Helper Functions ---
const shuffleArray = (array) => {
  const newArray = [...array];
  let currentIndex = newArray.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

// --- Components ---
const LoadingAndErrorState = ({ isLoading, error, onGoBack }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  if (isLoading) {
    return (
      <SafeAreaView style={[summaryStyles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={summaryStyles.loadingContainer}>
          <View style={summaryStyles.loadingContent}>
            <LottieView
              source={require('../../animations/loading_animation.json')}
              autoPlay
              loop
              style={summaryStyles.loadingAnimation}
            />
            <SmartText style={[summaryStyles.loadingText, { fontSize: 18 * textSizeMultiplier }]}>
              Loading Summary...
            </SmartText>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[summaryStyles.safeArea, { backgroundColor: colors.background }]}>
        <View style={summaryStyles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60 * textSizeMultiplier} color={colors.incorrect} />
          <SmartText style={[summaryStyles.errorText, { color: colors.incorrect, fontSize: 18 * textSizeMultiplier }]}>
            {error}
          </SmartText>
          <TouchableOpacity
            style={[summaryStyles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={onGoBack}
            activeOpacity={0.7}
          >
            <SmartText style={[summaryStyles.buttonText, { fontSize: 16 * textSizeMultiplier }]}>
              Go Back
            </SmartText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  return null;
};

// Custom Alert Component
const CustomAlert = ({ visible, title, message, onConfirm, confirmText = 'OK' }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const scaleValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 10,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible]);

  const animatedStyle = {
    transform: [{ scale: scaleValue }],
  };

  return (
    <Modal transparent={true} animationType="fade" visible={visible}>
      <View style={modalStyles.overlay}>
        <Animated.View style={[
          modalStyles.alertBox,
          { backgroundColor: colors.cardBackground },
          animatedStyle
        ]}>
          <SmartText style={[modalStyles.alertTitle, { color: colors.text, fontSize: 20 * textSizeMultiplier }]}>
            {title}
          </SmartText>
          <SmartText style={[modalStyles.alertMessage, { color: colors.secondaryText, fontSize: 16 * textSizeMultiplier }]}>
            {message}
          </SmartText>
          <TouchableOpacity
            style={[modalStyles.button, { backgroundColor: colors.primary }]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <SmartText style={[modalStyles.buttonText, { color: '#fff' }]}>{confirmText}</SmartText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

// --- Main QuizSummaryScreen Component ---
function QuizSummaryScreen() {
  const router = useRouter();
  const { quizId, sessionId, studentId, finalScore, totalQuestions, totalCoins } = useLocalSearchParams();
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentQuizResult, setStudentQuizResult] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);

  // --- Alert State ---
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertOnConfirm, setAlertOnConfirm] = useState(() => () => {});

  const showAlert = useCallback((title, message, onConfirm) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOnConfirm(() => {
      setAlertVisible(false);
      onConfirm();
    });
    setAlertVisible(true);
  }, []);

  useEffect(() => {
    const fetchAndProcessResults = async () => {
      if (!quizId || !sessionId || !studentId) {
        setError("Missing quiz, session, or student ID.");
        setIsLoading(false);
        return;
      }

      try {
        // 1. Fetch all submissions for this session
        const submissionsRes = await databases.listDocuments(DATABASE_ID, SUBMISSIONS_COLLECTION, [
          Query.equal('session_id', sessionId),
          Query.equal('student_id', studentId),
          Query.limit(100),
        ]);
        const studentSubmissions = submissionsRes.documents;

        if (studentSubmissions.length === 0) {
          setError("No submissions found for this quiz session.");
          setIsLoading(false);
          return;
        }

        // 2. Fetch all questions for this quiz to get correct answers and explanations
        const questionsRes = await databases.listDocuments(DATABASE_ID, QUESTIONS_COLLECTION, [
          Query.equal('quiz_id', quizId),
          Query.limit(100),
        ]);
        const quizQuestions = questionsRes.documents;
        setAllQuestions(quizQuestions);
        const quizMetaRes = await databases.getDocument(DATABASE_ID, QUIZ_COLLECTION, quizId);

        // 3. Aggregate student answers and calculate average time
        let totalTimeTaken = 0;
        const studentAnswers = {};
        const questionDetailsMap = new Map(quizQuestions.map(q => [q.$id, q]));

        studentSubmissions.forEach(sub => {
          totalTimeTaken += parseFloat(sub.time_taken || 0);
          const question = questionDetailsMap.get(sub.question_id);

          studentAnswers[sub.question_id] = {
            questionId: sub.question_id,
            questionText: question?.question || '',
            questionOptions: question?.options || [],
            correctAnswer: question?.correct_option || '',
            givenAnswer: sub.student_answer,
            isCorrect: sub.score === "1",
            timeTaken: sub.time_taken || '0',
            scoreAwarded: sub.score || '0',
          };
        });

        const averageTime = studentSubmissions.length > 0
          ? totalTimeTaken / studentSubmissions.length
          : 0;

        const quizResultData = {
          quiz_id: quizId,
          session_id: sessionId,
          student_id: studentId,
          final_score: finalScore.toString(),
          total_questions: totalQuestions.toString(),
          total_coins: totalCoins.toString(),
          average_time_per_question: averageTime.toFixed(2),
          quiz_title: quizMetaRes["quiz-title"],
          quiz_subject: quizMetaRes["quiz-subject"],
          quiz_icon: quizMetaRes["quiz-icon"],
          quiz_professor: quizMetaRes["quiz-professor"],
          
          student_answers_summary: JSON.stringify(
            Object.values(studentAnswers).map((answer) => ({
              question_id: answer.questionId,
              question_text: answer.questionText,
              question_options: answer.questionOptions,
              correct_answer: answer.correctAnswer,
              given_answer: answer.givenAnswer,
              is_correct: answer.isCorrect,
              time_taken: answer.timeTaken,
              score_awarded: answer.scoreAwarded,
            }))
          ),

          submission_date: new Date().toISOString(),
        };

        const resultDoc = await databases.createDocument(
          DATABASE_ID,
          QUIZ_RESULTS_COLLECTION,
          ID.unique(),
          quizResultData
        );
        setStudentQuizResult(resultDoc);

        // 5. Fetch all quiz results for comparison for this quiz
        const allQuizResultsRes = await databases.listDocuments(DATABASE_ID, QUIZ_RESULTS_COLLECTION, [
          Query.equal('quiz_id', quizId),
          Query.limit(100),
        ]);

        const otherStudentResults = allQuizResultsRes.documents.map(doc => ({
          studentId: doc.student_id,
          finalScore: parseInt(doc.final_score),
          averageTime: parseFloat(doc.average_time_per_question),
          sessionId: doc.session_id,
        }));

        setComparisonData(otherStudentResults);

        // 6. Delete individual submission answers (clean up)
        await Promise.all(studentSubmissions.map(async (sub) => {
          await databases.deleteDocument(DATABASE_ID, SUBMISSIONS_COLLECTION, sub.$id);
        }));

      } catch (err) {
        setError("Failed to load or save quiz summary. " + err.message);
        console.error("Quiz Summary Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessResults();
  }, [quizId, sessionId, studentId, finalScore, totalQuestions, totalCoins]);

  if (isLoading || error) {
    return (
      <LoadingAndErrorState
        isLoading={isLoading}
        error={error}
        onGoBack={() => router.replace('/studentFiles/studentQuizs')}
      />
    );
  }

  // Calculate student's average and sort for rank
  const studentAvgTime = studentQuizResult ? parseFloat(studentQuizResult.average_time_per_question) : 0;
  const studentOverallScore = studentQuizResult ? parseInt(studentQuizResult.final_score) : 0;

  // Sort comparison data for ranking
  const sortedByScore = [...comparisonData].sort((a, b) => b.finalScore - a.finalScore);
  const sortedByTime = [...comparisonData].sort((a, b) => a.averageTime - b.averageTime);

  const studentRankScore = sortedByScore.findIndex(s => s.sessionId === sessionId) + 1;
  const studentRankTime = sortedByTime.findIndex(s => s.sessionId === sessionId) + 1;

  // Calculate averages for comparison
  const globalAverageScore = comparisonData.length > 0
    ? comparisonData.reduce((sum, data) => sum + data.finalScore, 0) / comparisonData.length
    : 0;
  const globalAverageTime = comparisonData.length > 0
    ? comparisonData.reduce((sum, data) => sum + data.averageTime, 0) / comparisonData.length
    : 0;

  const studentAnswersArray = studentQuizResult 
    ? JSON.parse(studentQuizResult.student_answers_summary) 
    : [];

  const studentAnswersSummary = studentAnswersArray.reduce((map, ans) => {
    map[ans.question_id] = {
      ...ans,
      isCorrect: ans.is_correct,  
    };
    return map;
  }, {});

  const correctAnswers = studentOverallScore;
  const incorrectAnswers = totalQuestions - studentOverallScore;
  const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;

  return (
    <SafeAreaView style={[summaryStyles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onConfirm={alertOnConfirm}
      />

      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={summaryStyles.headerContainer}>
        <View style={summaryStyles.headerContent}>
          <View style={summaryStyles.leftSection}>
            <TouchableOpacity 
              style={summaryStyles.backButton}
              onPress={() => router.replace('/studentFiles/studentQuizs')}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={summaryStyles.textSection}>
              <SmartText style={[summaryStyles.headerTitle, { fontSize: 24 * textSizeMultiplier }]}>Quiz Summary</SmartText>
              <SmartText style={[summaryStyles.headerSubtitle, { fontSize: 16 * textSizeMultiplier }]}>
                {studentQuizResult?.quiz_title || 'Quiz Results'}
              </SmartText>
            </View>
          </View>
          <View style={summaryStyles.rightSection}>
            <View style={summaryStyles.lottieContainer}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={50} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={summaryStyles.scrollContent}>
        {/* Performance Overview */}
        <View style={summaryStyles.sectionContainer}>
          <SmartText style={[summaryStyles.sectionTitle, { color: colors.text, fontSize: 20 * textSizeMultiplier }]}>
            Your Performance
          </SmartText>
          <View style={[summaryStyles.cardContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={summaryStyles.performanceGrid}>
              <View style={[summaryStyles.performanceCard, { backgroundColor: colors.success }]}>
                <MaterialIcons name="check-circle" size={30} color="#fff" />
                <SmartText style={summaryStyles.performanceNumber}>{correctAnswers}</SmartText>
                <SmartText style={summaryStyles.performanceLabel}>Correct</SmartText>
              </View>
              <View style={[summaryStyles.performanceCard, { backgroundColor: colors.incorrect }]}>
                <MaterialIcons name="cancel" size={30} color="#fff" />
                <SmartText style={summaryStyles.performanceNumber}>{incorrectAnswers}</SmartText>
                <SmartText style={summaryStyles.performanceLabel}>Incorrect</SmartText>
              </View>
              <View style={[summaryStyles.performanceCard, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="percent" size={30} color="#fff" />
                <SmartText style={summaryStyles.performanceNumber}>{accuracy}%</SmartText>
                <SmartText style={summaryStyles.performanceLabel}>Accuracy</SmartText>
              </View>
              <View style={[summaryStyles.performanceCard, { backgroundColor: colors.warning }]}>
                <MaterialCommunityIcons name="clock-outline" size={30} color="#fff" />
                <SmartText style={summaryStyles.performanceNumber}>{studentAvgTime.toFixed(1)}s</SmartText>
                <SmartText style={summaryStyles.performanceLabel}>Avg Time</SmartText>
              </View>
            </View>
          </View>
        </View>

        {/* Student Comparison */}
        <View style={summaryStyles.sectionContainer}>
          <SmartText style={[summaryStyles.sectionTitle, { color: colors.text, fontSize: 20 * textSizeMultiplier }]}>
            Class Comparison
          </SmartText>
          <View style={[summaryStyles.cardContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={summaryStyles.comparisonItem}>
              <View style={summaryStyles.comparisonLeft}>
                <MaterialCommunityIcons name="trophy-outline" size={24} color={colors.primary} />
                <SmartText style={[summaryStyles.comparisonLabel, { color: colors.text }]}>Score Rank</SmartText>
              </View>
              <SmartText style={[summaryStyles.comparisonValue, { color: colors.text }]}>
                {studentRankScore} / {comparisonData.length}
              </SmartText>
            </View>
            <View style={summaryStyles.comparisonItem}>
              <View style={summaryStyles.comparisonLeft}>
                <MaterialCommunityIcons name="speedometer" size={24} color={colors.warning} />
                <SmartText style={[summaryStyles.comparisonLabel, { color: colors.text }]}>Time Rank</SmartText>
              </View>
              <SmartText style={[summaryStyles.comparisonValue, { color: colors.text }]}>
                {studentRankTime} / {comparisonData.length}
              </SmartText>
            </View>
            <View style={summaryStyles.comparisonItem}>
              <View style={summaryStyles.comparisonLeft}>
                <MaterialCommunityIcons name="account-group-outline" size={24} color={colors.secondaryText} />
                <SmartText style={[summaryStyles.comparisonLabel, { color: colors.text }]}>Class Avg Score</SmartText>
              </View>
              <SmartText style={[summaryStyles.comparisonValue, { color: colors.text }]}>
                {globalAverageScore.toFixed(1)} / {totalQuestions}
              </SmartText>
            </View>
            <View style={summaryStyles.comparisonItem}>
              <View style={summaryStyles.comparisonLeft}>
                <MaterialCommunityIcons name="timer-outline" size={24} color={colors.secondaryText} />
                <SmartText style={[summaryStyles.comparisonLabel, { color: colors.text }]}>Class Avg Time</SmartText>
              </View>
              <SmartText style={[summaryStyles.comparisonValue, { color: colors.text }]}>
                {globalAverageTime.toFixed(1)}s
              </SmartText>
            </View>
          </View>
        </View>

        {/* Question Review */}
        <View style={summaryStyles.sectionContainer}>
          <SmartText style={[summaryStyles.sectionTitle, { color: colors.text, fontSize: 20 * textSizeMultiplier }]}>
            Question Review
          </SmartText>
          <View style={[summaryStyles.cardContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            {allQuestions.map((question, index) => {
              const studentAnswerDetail = studentAnswersSummary[question.$id] || {};
              const isCorrect = studentAnswerDetail.isCorrect;
              const answerColor = isCorrect ? colors.correct : colors.incorrect;

              return (
                <View key={question.$id} style={[summaryStyles.questionCard, { borderColor: colors.border }]}>
                  <View style={summaryStyles.questionHeader}>
                    <SmartText style={[summaryStyles.questionNumber, { color: colors.text }]}>
                      Question {index + 1}
                    </SmartText>
                    <View style={[summaryStyles.answerBadge, { backgroundColor: answerColor }]}>
                      <MaterialIcons
                        name={isCorrect ? "check" : "close"}
                        size={16}
                        color="#fff"
                      />
                      <SmartText style={summaryStyles.answerBadgeText}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </SmartText>
                    </View>
                  </View>

                  <SmartText style={[summaryStyles.questionText, { color: colors.text }]}>
                    {question.question}
                  </SmartText>

                  {studentAnswerDetail.givenAnswer && (
                    <View style={summaryStyles.answerRow}>
                      <SmartText style={[summaryStyles.answerLabel, { color: colors.secondaryText }]}>
                        Your Answer:
                      </SmartText>
                      <SmartText style={[summaryStyles.answerText, { color: colors.text }]}>
                        {question.question_type === 'Fill-in-the-blank'
                          ? JSON.parse(studentAnswerDetail.givenAnswer).join(', ')
                          : studentAnswerDetail.givenAnswer}
                      </SmartText>
                    </View>
                  )}

                  <View style={summaryStyles.answerRow}>
                    <SmartText style={[summaryStyles.answerLabel, { color: colors.secondaryText }]}>
                      Correct Answer:
                    </SmartText>
                    <SmartText style={[summaryStyles.answerText, { color: colors.correct, fontWeight: 'bold' }]}>
                      {question.correct_option}
                    </SmartText>
                  </View>

                  {question.explanation && (
                    <View style={[summaryStyles.explanationContainer, { backgroundColor: colors.background }]}>
                      <MaterialCommunityIcons name="lightbulb-outline" size={16} color={colors.primary} />
                      <SmartText style={[summaryStyles.explanationText, { color: colors.secondaryText }]}>
                        {question.explanation}
                      </SmartText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={summaryStyles.fixedBottomSection}>
        <TouchableOpacity
          style={[summaryStyles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/studentFiles/studentQuizs')}
          activeOpacity={0.7}
        >
          <SmartText style={[summaryStyles.buttonText, { fontSize: 16 * textSizeMultiplier }]}>
            Back to Quizzes
          </SmartText>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---
const { width } = Dimensions.get('window');

const summaryStyles = StyleSheet.create({
  safeArea: { 
    flex: 1,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  loadingText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    textAlign: 'center',
    fontWeight: '500',
    marginVertical: 20,
  },

  // Header
  headerContainer: {
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
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
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
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

  // Content
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  sectionContainer: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 15,
  },
  cardContainer: {
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  // Performance Grid
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceCard: {
    width: (width - 80) / 2 - 10,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  performanceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  performanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },

  // Comparison
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  comparisonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Questions
  questionCard: {
    borderBottomWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 5,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  answerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  answerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 15,
  },
  answerRow: {
    marginBottom: 10,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  explanationContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  explanationText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },

  // Bottom Button
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
  primaryButton: {
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
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 10,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  alertBox: {
    width: '80%',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  alertTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  alertMessage: {
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonText: {
    fontWeight: 'bold',
  },
});

// Wrap the main component with the AppProvider
export default function QuizSummaryScreenWrapper() {
  return (
    <AppProvider>
      <QuizSummaryScreen />
    </AppProvider>
  );
}