// studentFiles/studentQuizs.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Client, Databases, Query } from "react-native-appwrite";
import { showToast } from "../../lib/toasthelper"

import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { account } from "../../lib/appwrite";
import LottieView from 'lottie-react-native';
import SmartText from "../../components/SmartText";

// Initialize Appwrite client
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("");

const databases = new Databases(client);

// --- Collection IDs ---
const DATABASE_ID = "685ae2ba0012dcb2feda";
const STUDENT_SUBMISSIONS_COLLECTION_ID = "687ec5cd0008660447d4";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";
const QUIZ_PARTICIPANTS_COLLECTION_ID = "687ec780001053a5ec08";
const ACTIVE_QUIZZES_COLLECTION_ID = "68764f2a001a9f312390";
const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254";
const QUIZ_RESULTS_COLLECTION_ID = "688ac9da003a6b78f674";
const QUESTIONS_COLLECTION_ID = "68764f2a001a9f312389";
const PROFESSORS_COLLECTION_ID = "685ae2d80031c0e9b7f3";

export default function StudentQuiz() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pastQuizzes, setPastQuizzes] = useState([]);
  const [waitingQuizzes, setWaitingQuizzes] = useState([]);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [currentStudentId, setCurrentStudentId] = useState(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [webCodeModalVisible, setWebCodeModalVisible] = useState(false);
  const [enteredWebCode, setEnteredWebCode] = useState("");
  
  // State for one-time click restriction
  const [joinButtonsDisabled, setJoinButtonsDisabled] = useState(false);

  useEffect(() => {
    const fetchStudentId = async () => {
      try {
        const user = await account.get();
        const response = await databases.listDocuments(
          DATABASE_ID,
          STUDENTS_COLLECTION_ID,
          [Query.equal("stmail", user.email)]
        );
        if (response.documents.length > 0) {
          setCurrentStudentId(response.documents[0].stcin);
        } else {
          setError("Could not find student profile.");
        }
      } catch (err) {
        console.error("Failed to fetch student ID:", err);
        setError("Please log in to see your quizzes.");
      }
    };
    fetchStudentId();
  }, []);

  useEffect(() => {
    if (currentStudentId) {
      fetchPastQuizzes();
      fetchWaitingQuizzes();
    }
  }, [currentStudentId]);

  // Real-time updates for Waiting Quizzes
  useEffect(() => {
    if (!currentStudentId) return;
    const unsubscribeParticipants = client.subscribe(
      `databases.${DATABASE_ID}.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.payload.student_id === currentStudentId &&
          (response.events.includes(
            `databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.create`
          ) ||
            response.events.includes(
              `databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.update`
            ) ||
            response.events.includes(
              `databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.delete`))
        ) {
          fetchWaitingQuizzes();
        }
      }
    );
    
    const unsubscribeActiveQuizzes = client.subscribe(
      `databases.${DATABASE_ID}.collections.${ACTIVE_QUIZZES_COLLECTION_ID}.documents`,
      () => fetchWaitingQuizzes()
    );
       const unsubscribeSubmissions = client.subscribe(
    `databases.${DATABASE_ID}.collections.${STUDENT_SUBMISSIONS_COLLECTION_ID}.documents`,
    (response) => {
      if (
        response.payload.student_id === currentStudentId &&
        (
          response.events.some(e => e.includes("create")) ||
          response.events.some(e => e.includes("update")) ||
          response.events.some(e => e.includes("delete"))
        )
      ) {
        fetchWaitingQuizzes();
      }
    }
  );
    return () => {
      unsubscribeParticipants();
      unsubscribeActiveQuizzes();
      unsubscribeSubmissions();
    };
 

  }, [currentStudentId]);

  // Real-time updates for Past Quizzes
  useEffect(() => {
    if (!currentStudentId) return;
    const unsubscribeQuizResults = client.subscribe(
      `databases.${DATABASE_ID}.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.payload.student_id === currentStudentId &&
          (response.events.includes(
            `databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.create`
          ) ||
            response.events.includes(
              `databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.update`
            ) || response.events.includes(`databases.*.collections.${QUIZ_RESULTS_COLLECTION_ID}.documents.*.delete`))
        ) {
          fetchPastQuizzes();
        }
      }
    );
    return () => unsubscribeQuizResults();
  }, [currentStudentId]);

  const fetchPastQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);

      const resultResponse = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_RESULTS_COLLECTION_ID,
        [
          Query.equal("student_id", currentStudentId),
          Query.orderDesc("submission_date"),
          Query.limit(100),
        ]
      );

      const pastQuizzesData = [];

      for (const resultDoc of resultResponse.documents) {
        let professorName = "N/A";
        try {
          if (resultDoc.quiz_professor) {
            const professorResponse = await databases.listDocuments(
              DATABASE_ID,
              PROFESSORS_COLLECTION_ID,
              [Query.equal("profcin", resultDoc.quiz_professor), Query.limit(1)]
            );

            if (professorResponse.documents.length > 0) {
              const prof = professorResponse.documents[0];
              professorName = `${prof.profname} ${prof.proffamilyname}`;
            }
          }
        } catch (profErr) {
          console.warn(`Could not fetch professor for quiz ${resultDoc.quiz_id}:`, profErr);
          professorName = "Unknown Professor";
        }

        pastQuizzesData.push({
          id: resultDoc.$id,
          quizId: resultDoc.quiz_id,
          sessionId: resultDoc.session_id,
          quizTitle: resultDoc.quiz_title || "Untitled Quiz",
          quizIcon: resultDoc.quiz_icon || "book-outline",
          quizSubject: resultDoc.quiz_subject || "N/A",
          professorName: professorName,
          submissionDate: resultDoc.submission_date,
          isFullyCompleted: true,
          resultDetails: {
            finalScore: parseInt(resultDoc.final_score),
            totalQuestions: parseInt(resultDoc.total_questions),
            totalCoins: parseInt(resultDoc.total_coins),
            averageTime: parseFloat(resultDoc.average_time_per_question),
          },
        });
      }

      setPastQuizzes(pastQuizzesData);
    } catch (err) {
      console.error("Failed to load past quizzes:", err);
      setError("Failed to load past quizzes.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitingQuizzes = async () => {
    setLoading(true);
    try {
      const participantResponse = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_PARTICIPANTS_COLLECTION_ID,
        [Query.equal("student_id", currentStudentId), Query.limit(100)]
      );

      const waitingList = [];

      for (const p of participantResponse.documents) {
        const quizResultCheck = await databases.listDocuments(
          DATABASE_ID,
          QUIZ_RESULTS_COLLECTION_ID,
          [
            Query.equal("session_id", p.session_id),
            Query.equal("student_id", currentStudentId),
            Query.limit(1),
          ]
        );

        if (quizResultCheck.total > 0) {
          continue;
        }

        try {
          const quizDetails = await databases.getDocument(
            DATABASE_ID,
            QUIZ_INFO_COLLECTION_ID,
            p.quiz_id
          );
          let activeSession = null;
          let quizConfig = {};
          try {
            activeSession = await databases.getDocument(
              DATABASE_ID,
              ACTIVE_QUIZZES_COLLECTION_ID,
              p.session_id
            );
            quizConfig = activeSession.config
              ? JSON.parse(activeSession.config)
              : {};
          } catch (e) {
            activeSession = { is_started: false, config: "{}" };
          }

          const submissionsCountRes = await databases.listDocuments(
            DATABASE_ID,
            STUDENT_SUBMISSIONS_COLLECTION_ID,
            [
              Query.equal("session_id", p.session_id),
              Query.equal("student_id", currentStudentId),
              Query.limit(100),
            ]
          );
          const submissionDocs = submissionsCountRes.documents || [];
const numSubmissions = submissionDocs.length;

const finalScore = submissionDocs.filter(sub => sub.score === "1").length;
const totalCoins = submissionDocs.reduce((sum, sub) => sum + parseInt(sub.coins_earned || "0", 10), 0);

          const questionsCountRes = await databases.listDocuments(
            DATABASE_ID,
            QUESTIONS_COLLECTION_ID,
            [Query.equal("quiz_id", p.quiz_id), Query.limit(100)]
          );
          const totalQuizQuestions = questionsCountRes.total;

          const isPartiallyAnswered =
            numSubmissions > 0 && numSubmissions < totalQuizQuestions;
          const isFullyAnsweredButNotProcessed =
            numSubmissions > 0 &&
            numSubmissions === totalQuizQuestions &&
            quizResultCheck.total === 0;

          if (
            activeSession.is_started ||
            isPartiallyAnswered ||
            isFullyAnsweredButNotProcessed ||
            (numSubmissions === 0 && !activeSession.is_started)
          ) {
            waitingList.push({
  ...p,
  quizTitle: quizDetails["quiz-title"],
  quizSubject: quizDetails["quiz-subject"],
  quizIcon: quizDetails["quiz-icon"] || "help-circle-outline",
  is_started: activeSession.is_started,
  isPartiallyAnswered: isPartiallyAnswered,
  isFullyAnsweredButNotProcessed: isFullyAnsweredButNotProcessed,
  numSubmissions: numSubmissions,
  totalQuizQuestions: totalQuizQuestions,
  config: quizConfig,
  finalScore: finalScore,
  totalCoins: totalCoins,
});
          }
        } catch (e) {
          console.warn(
            `Could not fetch full details for waiting quiz session ${p.session_id}:`,
            e
          );
        }
      }
      setWaitingQuizzes(waitingList);
    } catch (err) {
      console.error("Failed to fetch waiting quizzes:", err);
      setError("Failed to load waiting quizzes.");
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    setIsScanning(false);
    // Re-enable buttons after scan completes (successful or not)
    setJoinButtonsDisabled(false);
    
    try {
      const qrData = JSON.parse(data);

      if (qrData.quizId && qrData.sessionId) {
        if (currentStudentId) {
          router.push({
            pathname: `/studentFiles/takeQuiz`,
            params: {
              quizData: JSON.stringify({
                quizId: qrData.quizId,
                sessionId: qrData.sessionId,
                config: qrData.config,
                studentId: currentStudentId,
              }),
            },
          });
        } else {
          Alert.alert("Authentication Required", "Please log in to join this quiz.");
        }
      } else {
        Alert.alert("Invalid QR Code", "This QR code does not contain valid quiz information.");
      }
    } catch (e) {
      Alert.alert("Invalid QR Code", "Could not parse QR code data.");
      console.error("QR Code parsing error:", e);
    }
  };

  const handleJoinWithWebCode = async () => {
    if (!enteredWebCode.trim()) {
      Alert.alert("Invalid Code", "Please enter a valid web code.");
      return;
    }

    setJoinButtonsDisabled(true);
    
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        ACTIVE_QUIZZES_COLLECTION_ID,
        [Query.equal("web_code", enteredWebCode.trim().toUpperCase())]
      );

      if (response.documents.length > 0) {
        const activeQuiz = response.documents[0];
        const quizData = {
          quizId: activeQuiz.quiz_id,
          sessionId: activeQuiz.session_id,
          config: JSON.parse(activeQuiz.config),
        };
        setWebCodeModalVisible(false);
        setJoinModalVisible(false);
        router.push({
          pathname: `/studentFiles/takeQuiz`,
          params: { quizData: JSON.stringify(quizData) },
        });
      } else {
        Alert.alert("Invalid Code", "No active quiz found with this code.");
        setJoinButtonsDisabled(false);
      }
    } catch (error) {
      console.error("Failed to join with web code:", error);
      Alert.alert("Error", "Could not join the quiz. Please try again.");
      setJoinButtonsDisabled(false);
    }
  };

  const handleBeginQuiz = async (quizId, sessionId, studentId) => {
    router.push({
      pathname: "/studentFiles/quizQuestionScreen",
      params: { quizId, sessionId, studentId },
    });
  };

 const handleContinueQuiz = async (quizId, sessionId, studentId) => {
  setLoading(true);
  try {
    const existingSubmissions = await databases.listDocuments(
      DATABASE_ID,
      STUDENT_SUBMISSIONS_COLLECTION_ID,
      [
        Query.equal("session_id", sessionId),
        Query.equal("student_id", studentId),
        Query.limit(100),
      ]
    );

    if (existingSubmissions.total > 0) {
      Alert.alert(
        "Resume Quiz",
        "You have already started this quiz. press continue to proceed",
        [
          {
            text: "Continue",
            onPress: () => {
              router.push({
                pathname: "/studentFiles/quizQuestionScreen",
                params: { quizId, sessionId, studentId },
              });
            },
          },
        ]
      );
    } else {
      router.push({
        pathname: "/studentFiles/quizQuestionScreen",
        params: { quizId, sessionId, studentId },
      });
    }
  } catch (error) {
    console.error("Error continuing quiz", error);
    toast.error("Failed to continue quiz. Try again.");
  } finally {
    setLoading(false);
  }
};

 const handlesummerize = async (
  quizId,
  sessionId,
  studentId,
  finalScore,
  totalQuestions,
  totalCoins
) => {
  router.replace({
    pathname: "/studentFiles/quizSummary",
    params: {
      finalScore,
      totalQuestions,
      quizId,
      sessionId,
      studentId,
      totalCoins,
    },
  });
};

  const startQRScan = async () => {
    if (joinButtonsDisabled) return;
    
    setJoinButtonsDisabled(true);
    setJoinModalVisible(false);
    
    if (!cameraPermission?.granted) {
      setIsRequestingPermission(true);
      const permissionResponse = await requestCameraPermission();
      setIsRequestingPermission(false);
      if (!permissionResponse?.granted) {
        Alert.alert("Camera Permission Denied", "Please grant camera access to scan QR codes.");
        setJoinButtonsDisabled(false);
        return;
      }
    }
    setIsScanning(true);
  };

  const showWebCodeModal = () => {
    if (joinButtonsDisabled) return;
    
    setJoinModalVisible(false);
    setWebCodeModalVisible(true);
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
            <SmartText style={styles.loadingText}>Loading Quizzes...</SmartText>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          onBarcodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        <SmartText style={styles.scannerText}>Scan Quiz QR Code</SmartText>
        <TouchableOpacity 
          style={styles.cancelScanButton} 
          onPress={() => {
            setIsScanning(false);
            setJoinButtonsDisabled(false);
          }}
        >
          <SmartText style={styles.cancelScanButtonText}>Cancel Scan</SmartText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>
        
        <LinearGradient colors={["#6c5ce7", "#a29bfe"]} style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View style={styles.leftSection}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.replace('/studentDashboard')}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.textSection}>
                <SmartText style={styles.headerTitle}>My Quizzes</SmartText>
                <SmartText style={styles.headerSubtitle}>Take quizzes and track your progress</SmartText>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={require('../../animations/scan.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {error ? (
          <View style={styles.errorContainer}>
            <SmartText style={styles.errorText}>{error}</SmartText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Waiting Quizzes Section */}
            <View style={styles.sectionContainer}>
              <SmartText style={styles.sectionTitle}>Waiting Quizzes</SmartText>
              <View style={styles.cardContainer}>
                {waitingQuizzes.length === 0 ? (
                  <SmartText style={styles.noQuizzesText}>No quizzes to take right now.</SmartText>
                ) : (
                  waitingQuizzes.map((quiz) => (
                    <View key={quiz.$id} style={styles.quizCard}>
                      <MaterialCommunityIcons
                        name={quiz.quizIcon || "book-outline"}
                        size={30}
                        color="#6c5ce7"
                      />
                      <View style={styles.quizInfo}>
                        <SmartText style={styles.quizTitle}>{quiz.quizTitle}</SmartText>
                        <SmartText style={styles.quizSubject}>{quiz.quizSubject}</SmartText>

                        {quiz.isPartiallyAnswered && (
                          <SmartText style={styles.quizStatusText}>
                            Progress: {quiz.numSubmissions}/{quiz.totalQuizQuestions}
                          </SmartText>
                        )}
                        {quiz.isFullyAnsweredButNotProcessed && (
                          <SmartText style={styles.quizStatusText}>Results ready</SmartText>
                        )}
                      </View>

                      <View style={styles.buttonContainer}>
                        {quiz.isFullyAnsweredButNotProcessed ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.summerBtn]}
                            onPress={() =>
                              handlesummerize(
                                quiz.quiz_id,
                                quiz.session_id,
                                currentStudentId,
                                quiz.finalScore,
                                quiz.totalQuizQuestions,
                                quiz.totalCoins
                              )
                            }
                          >
                            <SmartText style={styles.btnText}>Summarize</SmartText>
                          </TouchableOpacity>
                        ) : quiz.is_started && quiz.isPartiallyAnswered ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.continueBtn]}
                            onPress={() =>
                              handleContinueQuiz(quiz.quiz_id, quiz.session_id, currentStudentId)
                            }
                          >
                            <SmartText style={styles.btnText}>Continue Quiz</SmartText>
                          </TouchableOpacity>
                        ) : quiz.is_started ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.beginBtn]}
                            onPress={() =>
                              handleBeginQuiz(quiz.quiz_id, quiz.session_id, currentStudentId)
                            }
                          >
                            <SmartText style={styles.btnText}>Begin Quiz</SmartText>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.waitBtn]}
                            onPress={() => {
                              router.push({
                                pathname: `/studentFiles/takeQuiz`,
                                params: {
                                  quizData: JSON.stringify({
                                    quizId: quiz.quiz_id,
                                    sessionId: quiz.session_id,
                                    config: quiz.config,
                                    studentId: currentStudentId,
                                  }),
                                },
                              });
                            }}
                          >
                            <SmartText style={styles.btnText}>Wait for Teacher</SmartText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Past Quizzes Section */}
            <View style={styles.sectionContainer}>
              <SmartText style={styles.sectionTitle}>Past Quizzes</SmartText>
              <View style={styles.cardContainer}>
                {pastQuizzes.length === 0 ? (
                  <SmartText style={styles.noQuizzesText}>No quizzes taken yet.</SmartText>
                ) : (
                  pastQuizzes.map((quiz) => (
                    <View key={quiz.id} style={styles.quizCard}>
                      <MaterialCommunityIcons name={quiz.quizIcon || "book-outline"} size={30} color="#6c5ce7" />
                      <View style={styles.quizInfo}>
                        <SmartText style={styles.quizTitle}>{quiz.quizTitle}</SmartText>
                        <SmartText style={styles.quizSubject}>{quiz.quizSubject}</SmartText>
                        <SmartText style={styles.quizProfessor}>
                          Prof: {quiz.professorName}
                        </SmartText>
                        <SmartText style={styles.quizItemDetail}>
                          Date: {new Date(quiz.submissionDate).toLocaleDateString()}
                        </SmartText>
                      </View>
                      <View style={styles.buttonContainer}>
                        {quiz.isFullyCompleted && quiz.resultDetails ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.detailsBtn]}
                            onPress={() =>
                              router.push({
                                pathname: "/studentFiles/quizResultsReview",
                                params: {
                                  quizId: quiz.quizId,
                                  sessionId: quiz.sessionId,
                                  studentId: currentStudentId,
                                  finalScore: quiz.resultDetails.finalScore,
                                  totalQuestions: quiz.resultDetails.totalQuestions,
                                  totalCoins: quiz.resultDetails.totalCoins,
                                },
                              })
                            }
                          >
                            <SmartText style={styles.btnText}>Show Results</SmartText>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.incompleteBtn]}
                            onPress={() =>
                              Alert.alert("Incomplete Quiz", "Results are not yet summarized.")
                            }
                          >
                            <SmartText style={styles.btnText}>Incomplete</SmartText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        )}

        {/* Fixed Bottom Join Section */}
        <View style={styles.fixedBottomSection}>
          <TouchableOpacity
            style={[
              styles.joinQuizButton,
              joinButtonsDisabled && styles.joinQuizButtonDisabled
            ]}
            onPress={() => !joinButtonsDisabled && setJoinModalVisible(true)}
            disabled={joinButtonsDisabled}
          >
            <SmartText style={[
              styles.joinQuizButtonText,
              joinButtonsDisabled && styles.joinQuizButtonTextDisabled
            ]}>
              {joinButtonsDisabled ? "Processing..." : "Join New Quiz"}
            </SmartText>
            <Ionicons 
              name="add-circle" 
              size={20} 
              color={joinButtonsDisabled ? "#999" : "#fff"} 
            />
          </TouchableOpacity>
        </View>

        {/* Join Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={joinModalVisible}
          onRequestClose={() => setJoinModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <SmartText style={styles.modalTitle}>How do you want to join?</SmartText>
                <TouchableOpacity 
                  style={[
                    styles.modalOptionButton,
                    joinButtonsDisabled && styles.modalOptionButtonDisabled
                  ]} 
                  onPress={startQRScan}
                  disabled={joinButtonsDisabled}
                >
                  <MaterialCommunityIcons 
                    name="qrcode-scan" 
                    size={24} 
                    color={joinButtonsDisabled ? "#999" : "#fff"} 
                  />
                  <SmartText style={[
                    styles.modalOptionText,
                    joinButtonsDisabled && styles.modalOptionTextDisabled
                  ]}>
                    {joinButtonsDisabled ? "Processing..." : "Scan QR Code"}
                  </SmartText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.modalOptionButton, 
                    { marginTop: 10 },
                    joinButtonsDisabled && styles.modalOptionButtonDisabled
                  ]} 
                  onPress={showWebCodeModal}
                  disabled={joinButtonsDisabled}
                >
                  <MaterialCommunityIcons 
                    name="form-textbox-password" 
                    size={24} 
                    color={joinButtonsDisabled ? "#999" : "#fff"} 
                  />
                  <SmartText style={[
                    styles.modalOptionText,
                    joinButtonsDisabled && styles.modalOptionTextDisabled
                  ]}>
                    {joinButtonsDisabled ? "Processing..." : "Enter Short Code"}
                  </SmartText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setJoinModalVisible(false)}
                >
                  <SmartText style={styles.cancelBtnText}>Cancel</SmartText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Web Code Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={webCodeModalVisible}
          onRequestClose={() => setWebCodeModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <SmartText style={styles.modalTitle}>Enter Web Code</SmartText>
                <TextInput
                  style={styles.input}
                  onChangeText={setEnteredWebCode}
                  value={enteredWebCode}
                  placeholder="e.g. A1B2C3"
                  autoCapitalize="characters"
                  editable={!joinButtonsDisabled}
                />
                <TouchableOpacity 
                  style={[
                    styles.saveBtn,
                    joinButtonsDisabled && styles.saveBtnDisabled
                  ]} 
                  onPress={handleJoinWithWebCode}
                  disabled={joinButtonsDisabled}
                >
                  <SmartText style={[
                    styles.saveBtnText,
                    joinButtonsDisabled && styles.saveBtnTextDisabled
                  ]}>
                    {joinButtonsDisabled ? "Joining..." : "Join"}
                  </SmartText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => {
                    setWebCodeModalVisible(false);
                    setEnteredWebCode("");
                    setJoinButtonsDisabled(false);
                  }}
                >
                  <SmartText style={styles.cancelBtnText}>Cancel</SmartText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
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
    width: 140,
    height: 140,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    textAlign: "center",
    color: "#d63031",
    fontSize: 16,
    fontWeight: '500',
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },

  sectionContainer: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2d3436",
    marginBottom: 15,
  },

  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  quizInfo: {
    flex: 1,
    marginLeft: 15,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  quizSubject: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 2,
  },
  quizProfessor: {
    fontSize: 14,
    color: '#8e44ad',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  quizStatusText: {
    fontSize: 14,
    color: '#f39c12',
    marginTop: 5,
    fontWeight: "bold",
  },
  quizItemDetail: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  waitBtn: {
    backgroundColor: '#f39c12',
  },
  continueBtn: {
    backgroundColor: '#3498db',
  },
  beginBtn: {
    backgroundColor: '#00b894',
  },
  summerBtn: {
    backgroundColor: '#e74c3c',
  },
  detailsBtn: {
    backgroundColor: '#6c5ce7',
  },
  incompleteBtn: {
    backgroundColor: '#e74c3c',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },

  noQuizzesText: {
    fontSize: 16,
    color: '#636e72',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
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
  joinQuizButton: {
    backgroundColor: '#6c5ce7',
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
  joinQuizButtonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0.1,
  },
  joinQuizButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  joinQuizButtonTextDisabled: {
    color: '#999',
  },

  scannerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  scannerText: {
    position: "absolute",
    top: "20%",
    color: "white",
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelScanButton: {
    position: "absolute",
    bottom: 50,
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 15,
    borderRadius: 10,
  },
  cancelScanButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    alignItems: 'center',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6c5ce7',
    marginBottom: 20,
  },

  modalOptionButton: {
    backgroundColor: '#6c5ce7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    width: 250,
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalOptionButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOptionTextDisabled: {
    color: '#999',
  },

  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },

  saveBtn: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 15,
    marginBottom: 10,
    alignItems: 'center',
    minWidth: 120,
  },
  saveBtnDisabled: {
    backgroundColor: '#bdc3c7',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveBtnTextDisabled: {
    color: '#999',
  },

  cancelBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#6c5ce7',
    fontWeight: 'bold',
    fontSize: 15,
  },
});