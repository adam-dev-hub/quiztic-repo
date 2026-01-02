import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from "react-native";
import { MaterialCommunityIcons,Ionicons,FontAwesome5} from "@expo/vector-icons";
import { showToast } from "../../lib/toasthelper"
import SmartText from "../../components/SmartText";

import { Client, Databases, Query, ID } from "react-native-appwrite";
import { useRouter } from 'expo-router';
import { account } from "../../lib/appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Text as SvgText } from "react-native-svg";
import LottieView from 'lottie-react-native';

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("""");

const databases = new Databases(client);

// --- Appwrite Collection IDs ---
const DATABASE_ID = "685ae2ba0012dcb2feda";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";
const QUESTIONS_COLLECTION_ID = "68764f2a001a9f312389";
const ACTIVE_QUIZZES_COLLECTION_ID = "68764f2a001a9f312390";
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';

const icons = [
  "book", "book-open-variant", "school", "notebook", "clipboard-text", "calendar", "certificate",
  "flask-outline", "atom", "dna", "microscope", "telescope", "calculator", "sigma", "alpha", "beta", "pi", "ruler", "ruler-square", "triangle", "square-root", "abacus",
  "language-python", "language-javascript", "language-html5", "language-css3", "laptop", "desktop-classic", "monitor", "database", "chip", "robot", "cog", "tools",
  "pencil", "pencil-outline", "pen", "palette", "music-note",
  "earth", "globe-model", "account-group", "account-tie", "translate",
  "hospital", "stethoscope", "heart-pulse", "brain", "pill", "medical-bag", "bandage", "needle", "thermometer", "hospital-box", "ambulance", "blood-bag", "eye", "lungs", "tooth", "wheelchair-accessibility",
  "lightbulb", "lightbulb-on-outline", "clipboard-list", "file-document-outline", "calendar-check", "folder", "folder-star", "folder-multiple",
  "dog", "cat", "fish", "paw", "horse", "rabbit",
  "bone", "skull",
  "ray-start-arrow", "ray-start-end", "ray-vertex", "camera", "video", "scanner",
  "knife-military", "screwdriver", "wrench", "hammer",
  "progress-clock", "progress-check", "progress-upload", "progress-download", "swap-horizontal", "swap-vertical", "playlist-check", "playlist-play",
  "gavel", "scale-balance", "bank", "flag", "city", "shield-account", "tank", "bomb", "rocket", "oil", "factory", "mine", "engine", "car", "airplane", "fire", "fire-extinguisher",
  "soccer", "basketball", "baseball", "dumbbell", "bike", "run", "swim", "tennis",
];

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function ProfessorCourses() {
  const router = useRouter();

  const [quizzes, setQuizzes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [quizData, setQuizData] = useState({ title: '', subject: '', icon: icons[0], numQuestions: '' });
  const [saving, setSaving] = useState(false);
  const [profCIN, setProfCIN] = useState("");
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuVisibleId, setMenuVisibleId] = useState(null);
  const [quizCardHeight, setQuizCardHeight] = useState(0);
  const [overviewModalVisible, setOverviewModalVisible] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  useEffect(() => {
    async function fetchQuizzesForProfessor() {
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

        const profCIN = cinValue.toString().substring(0, 8);
        setProfCIN(profCIN);

        const quizRes = await databases.listDocuments(
          DATABASE_ID,
          QUIZ_INFO_COLLECTION_ID,
          [Query.equal("quiz-professor", profCIN)]
        );

        const enhancedQuizzes = await Promise.all(
          quizRes.documents.map(async (quiz) => {
            let isCurrentlyActive = false;
            let activeSessionId = null;
            let classroomInfo = null;

            if (quiz["quiz-state"] === "active") {
              const activeSessionRes = await databases.listDocuments(
                DATABASE_ID,
                ACTIVE_QUIZZES_COLLECTION_ID,
                [
                  Query.equal("quiz_id", quiz.$id),
                  Query.equal("is_started", true),
                  Query.isNull("is_completed"),
                  Query.limit(1)
                ]
              );
              if (activeSessionRes.total > 0) {
                isCurrentlyActive = true;
                activeSessionId = activeSessionRes.documents[0].$id;
              }
            }

            if (quiz["classroom-id"]) {
              try {
                const classroomDoc = await databases.getDocument(
                  DATABASE_ID,
                  CLASSROOMS_COLLECTION_ID,
                  quiz["classroom-id"]
                );
                classroomInfo = {
                  name: classroomDoc.name,
                  code: classroomDoc.classCode,
                };
              } catch (err) {
                console.warn("Failed to fetch classroom for quiz:", quiz.$id);
              }
            }

            return { 
              ...quiz, 
              isCurrentlyActive, 
              activeSessionId,
              classroomInfo,
              isScheduled: !!quiz['scheduled-date']
            };
          })
        );
        
        setQuizzes(enhancedQuizzes);
      } catch (err) {
        console.error(err);
        showToast("Failed to load quizzes");
      }
      setLoading(false);
    }
    fetchQuizzesForProfessor();
  }, []);

  const handleSaveQuiz = async () => {
    if (!quizData.title.trim() || !quizData.subject.trim() || !quizData.icon || !quizData.numQuestions.trim()) {
      showToast('All fields are required.');
      return;
    }
    if (!profCIN) {
      showToast('Professor CIN not loaded.');
      return;
    }
    setSaving(true);
    try {
      if (editingQuizId) {
        await databases.updateDocument(
          DATABASE_ID,
          QUIZ_INFO_COLLECTION_ID,
          editingQuizId,
          {
            "quiz-title": quizData.title.trim(),
            "quiz-subject": quizData.subject.trim(),
            "quiz-icon": quizData.icon,
            "quiz-nb-question": parseInt(quizData.numQuestions, 10),
          }
        );
        showToast("Quiz updated successfully!");
      } else {
        const quiz = {
          quizId: randomId(),
          quizTitle: quizData.title.trim(),
          quizSubject: quizData.subject.trim(),
          quizIcon: quizData.icon,
          quizProfessor: profCIN,
          quizNbQuestion: parseInt(quizData.numQuestions, 10),
          quizState: "not-configured",
        };
        const response = await fetch('https://get-quiz-info.vercel.app/api/quiz-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quiz),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to create quiz.");
        showToast("Quiz created successfully!");
      }

      setModalVisible(false);
      setQuizData({ title: '', subject: '', icon: icons[0], numQuestions: '' });
      setEditingQuizId(null);

      const quizRes = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        [Query.equal("quiz-professor", profCIN)]
      );
      
      const enhancedQuizzes = await Promise.all(
        quizRes.documents.map(async (quiz) => {
          let classroomInfo = null;
          if (quiz["classroom-id"]) {
            try {
              const classroomDoc = await databases.getDocument(
                DATABASE_ID,
                CLASSROOMS_COLLECTION_ID,
                quiz["classroom-id"]
              );
              classroomInfo = {
                name: classroomDoc.name,
                code: classroomDoc.classCode,
              };
            } catch (err) {
              console.warn("Failed to fetch classroom for quiz:", quiz.$id);
            }
          }
          return { 
            ...quiz, 
            classroomInfo,
            isScheduled: !!quiz['scheduled-date']
          };
        })
      );
      
      setQuizzes(enhancedQuizzes);
    } catch (err) {
      showToast("Failed to save quiz. Please try again.");
    }
    setSaving(false);
  };
  
  const handleOpenLiveQuiz = (quizId, quizTitle) => {
    router.push({ pathname: '/professorFiles/liveQuiz', params: { quizId, quizTitle} });
  };

  const handleDeleteQuiz = async (quizId) => {
    try {
      const questionsToDelete = await databases.listDocuments(
        DATABASE_ID,
        QUESTIONS_COLLECTION_ID,
        [Query.equal('quiz_id', quizId)]
      );

      const deletePromises = questionsToDelete.documents.map(question =>
        databases.deleteDocument(
          DATABASE_ID,
          QUESTIONS_COLLECTION_ID,
          question.$id
        )
      );

      await Promise.all(deletePromises);

      await databases.deleteDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        quizId
      );

      setQuizzes(prev => prev.filter(q => q.$id !== quizId));
      showToast("Quiz and all its questions deleted successfully!");

    } catch (err) {
      console.error("Deletion Error: ", err);
      showToast("Failed to delete quiz and its questions");
    }
  };

  const handleUpdateQuiz = (quiz) => {
    setQuizData({
      title: quiz["quiz-title"],
      subject: quiz["quiz-subject"],
      icon: quiz["quiz-icon"] || icons[0],
      numQuestions: quiz["quiz-nb-question"].toString(),
    });
    setEditingQuizId(quiz.$id);
    setModalVisible(true);
  };

  const handleConfigurateQuiz = async (quiz) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        quiz.$id,
        { "quiz-state": "not-configured" }
      );

      setQuizzes(prevQuizzes =>
        prevQuizzes.map(q =>
          q.$id === quiz.$id ? { ...q, 'quiz-state': 'not-configured' } : q
        )
      );

      router.push({
        pathname: 'professorFiles/configureQuiz',
        params: {
          id: quiz.$id,
          title: quiz["quiz-title"],
          subject: quiz["quiz-subject"],
          icon: quiz["quiz-icon"],
          nbQuestions: quiz["quiz-nb-question"],
          state: "not-configured",
        }
      });

    } catch (error) {
      console.error("Failed to update quiz state:", error);
      showToast("Failed to reset quiz state. Please try again.");
    }
  };

  const handleBeginQuiz = (quiz) => {
    router.push({
      pathname: 'professorFiles/beginQuiz',
      params: { id: quiz.$id }
    });
  };

  const handleShowResults = (quiz) => {
    setSelectedQuiz(quiz);
    setOverviewModalVisible(true);
  };

  const handleConfigureScheduledQuiz = (quiz) => {
    if (quiz["quiz-icon"]==="help-circle" || quiz["quiz-subject"]==="To be configured") {
    showToast("Please update the quiz info before configuration");
  } else {
    handleConfigurateQuiz(quiz);
  }};
  
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
            <SmartText style={styles.loadingText}>Loading Quizzes...</SmartText>
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
                <SmartText style={styles.headerTitle}>Quiz Management</SmartText>
                <SmartText style={styles.headerSubtitle}>Create and manage your quizzes</SmartText>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={require('../../animations/doc.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {quizzes.length === 0 ? (
          <SmartText style={styles.noQuizzesText}>No quiz available, create your first quiz</SmartText>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {quizzes.map((quiz) => (
              <View key={quiz.$id}>
                {menuVisibleId === quiz.$id ? (
                  <View style={[styles.quizCard, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#ddd',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 10,
                        }}
                        onPress={() => setMenuVisibleId(null)}
                      >
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtnswap, styles.updateBtn]}
                        onPress={() => {
                          setMenuVisibleId(null);
                          handleUpdateQuiz(quiz);
                        }}
                      >
                        <SmartText style={styles.btnText}>Update</SmartText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtnswap, styles.deleteBtn]}
                        onPress={() => {
                          setMenuVisibleId(null);
                          handleDeleteQuiz(quiz.$id);
                        }}
                      >
                        <SmartText style={styles.btnText}>Delete</SmartText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : quiz.isScheduled ? (
                  // Grid layout for scheduled quizzes
<TouchableOpacity
  onLongPress={() => setMenuVisibleId(quiz.$id)}
  activeOpacity={1}
  delayLongPress={300}
  android_ripple={{ color: 'transparent' }}
>                    <View style={styles.scheduledQuizCard}>
                      {/* Row 1 */}
                      <View style={styles.gridRow}>
                        {/* Icon Cell [1,1] */}
                        <View style={styles.iconCell}>
                          <View style={styles.iconWrapper}>
                            <MaterialCommunityIcons
                              name={quiz["quiz-icon"] || "book-outline"}
                              size={40}
                              color="#4f46e5"
                            />
                          </View>
                        </View>
                        
                        {/* Info Cell [2,1] */}
                        <View style={styles.infoCell}>
                          <SmartText style={styles.scheduledQuizTitle} numberOfLines={2}>
                            {quiz["quiz-title"]}
                          </SmartText>
                          <SmartText style={styles.scheduledQuizSubject} numberOfLines={1}>
                            {quiz["quiz-subject"]}
                          </SmartText>
                          <View style={styles.stateBadge}>
                            <SmartText style={styles.stateBadgeText}>{quiz["quiz-state"]}</SmartText>
                          </View>
                        </View>
                      </View>

                      {/* Row 2 */}
                      <View style={styles.gridRow}>
                        {/* Schedule Info Cell [1,2] */}
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleInfoItem}>
                            <MaterialCommunityIcons name="calendar-clock" size={18} color="#27ae60" />
                            <View style={styles.scheduleTextContainer}>
                              <SmartText style={styles.scheduleLabel}>Date</SmartText>
                              <SmartText style={styles.scheduleValue} numberOfLines={1}>
                                {quiz['scheduled-date']}
                              </SmartText>
                            </View>
                          </View>
                          
                          <View style={styles.scheduleInfoItem}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color="#e67e22" />
                            <View style={styles.scheduleTextContainer}>
                              <SmartText style={styles.scheduleLabel}>Time</SmartText>
                              <SmartText style={styles.scheduleValue} numberOfLines={1}>
                                {quiz['scheduled-time'] || 'TBD'}
                              </SmartText>
                            </View>
                          </View>

                          {quiz.classroomInfo && (
                            <View style={styles.scheduleInfoItem}>
                              <MaterialCommunityIcons name="school" size={18} color="#3498db" />
                              <View style={styles.scheduleTextContainer}>
                                <SmartText style={styles.scheduleLabel}>Class</SmartText>
                                <SmartText style={styles.scheduleValue} numberOfLines={2}>
  {`${quiz.classroomInfo.code}\n${quiz.classroomInfo.name}`}
</SmartText>
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Action Cell [2,2] */}
                        <View style={styles.actionCell}>
                          {quiz["quiz-state"] === "ongoing" ? (
                            <TouchableOpacity 
                              style={[styles.gridActionBtn, styles.liveBtn]} 
                              onPress={() => handleOpenLiveQuiz(quiz.$id, quiz["quiz-title"], quiz.activeSessionId)}
                            >
                              <MaterialCommunityIcons name="eye-outline" size={20} color="#fff" />
                              <SmartText style={styles.gridBtnText}>Live</SmartText>
                            </TouchableOpacity>
                          ) : quiz["quiz-state"] === "completed" ? (
                            <>
                              <TouchableOpacity 
                                style={[styles.gridActionBtn, styles.reuseBtn]} 
                                onPress={() => handleConfigurateQuiz(quiz)}
                              >
                                <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                                <SmartText style={styles.gridBtnText}>Re-use</SmartText>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.gridActionBtn, styles.overviewBtn]} 
                                onPress={() => handleShowResults(quiz)}
                              >
                                <MaterialCommunityIcons name="chart-box" size={18} color="#fff" />
                                <SmartText style={styles.gridBtnText}>Overview</SmartText>
                              </TouchableOpacity>
                            </>
                          ) : quiz["quiz-state"] === "not-configured" ? (
                            <TouchableOpacity 
                              style={[styles.gridActionBtn, styles.configureNeedUpdateBtn]} 
                              onPress={() => handleConfigureScheduledQuiz(quiz)}
                            >
                              <SmartText style={styles.gridBtnText}>Configure</SmartText>
                            </TouchableOpacity>
                          ) : (
                            <>
                              <TouchableOpacity 
                                style={[styles.gridActionBtn, styles.reconfigBtn]} 
                                onPress={() => handleConfigurateQuiz(quiz)}
                              >
                                <MaterialCommunityIcons name="cog-outline" size={18} color="#fff" />
                                <SmartText style={styles.gridBtnText}>Re-config</SmartText>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.gridActionBtn, styles.beginBtn]} 
                                onPress={() => handleBeginQuiz(quiz)}
                              >
                                <MaterialCommunityIcons name="play" size={18} color="#fff" />
                                <SmartText style={styles.gridBtnText}>Begin</SmartText>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : (
                  // Normal quiz card layout (unchanged)
<TouchableOpacity
  onLongPress={() => setMenuVisibleId(quiz.$id)}
  activeOpacity={1}
  delayLongPress={300}
  android_ripple={{ color: 'transparent' }}
>                    <View style={styles.quizCard}>
                      <MaterialCommunityIcons
                        name={quiz["quiz-icon"] || "book-outline"}
                        size={30}
                        color="#4f46e5"
                      />
                      <View style={styles.quizInfo}>
                        <SmartText style={styles.quizTitle}>{quiz["quiz-title"]}</SmartText>
                        <SmartText style={styles.quizSubject}>{quiz["quiz-subject"]}</SmartText>
                        <SmartText style={styles.quizState}>State: {quiz["quiz-state"]}</SmartText>
                      </View>
                      
                      <View style={styles.buttonContainer}>
                        {quiz["quiz-state"] === "ongoing" ? (
                          <TouchableOpacity 
                            style={[styles.actionBtn, styles.liveQuizBtn]} 
                            onPress={() => handleOpenLiveQuiz(quiz.$id, quiz["quiz-title"], quiz.activeSessionId)}
                          >
                            <MaterialCommunityIcons name="eye-outline" size={20} color="#fff" style={{ marginRight: 5 }} />
                            <SmartText style={styles.btnText}>Live</SmartText>
                          </TouchableOpacity>
                        ) : quiz["quiz-state"] === "completed" ? (
                          <>
                            <TouchableOpacity 
                              style={[styles.actionBtnr, styles.reconfigBtn,{marginRight:5,borderTopRightRadius:10,borderBottomRightRadius:10}]} 
                              onPress={() => handleConfigurateQuiz(quiz)}
                            >
                              <SmartText style={styles.btnText}>Re-use</SmartText>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.actionBtnb, styles.beginBtn,{borderTopLeftRadius:10,borderBottomLeftRadius:10,backgroundColor:'#4a69bd'}]} 
                              onPress={() => handleShowResults(quiz)}
                            >
                              <SmartText style={styles.btnText}>Overview</SmartText>
                            </TouchableOpacity>
                          </>
                        ) : quiz["quiz-state"] === "not-configured" ? (
                          <TouchableOpacity 
                            style={styles.actionBtn} 
                            onPress={() => handleConfigurateQuiz(quiz)}
                          >
                            <SmartText style={styles.btnText}>Configurate</SmartText>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity 
                              style={[styles.actionBtnr, styles.reconfigBtn,{marginRight:5,borderTopRightRadius:10,borderBottomRightRadius:10}]} 
                              onPress={() => handleConfigurateQuiz(quiz)}
                            >
                              <SmartText style={styles.btnText}>Re-configurate</SmartText>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.actionBtnb, styles.beginBtn,{borderTopLeftRadius:10,borderBottomLeftRadius:10}]} 
                              onPress={() => handleBeginQuiz(quiz)}
                            >
                              <SmartText style={styles.btnText}>Begin Quiz</SmartText>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.fixedBottomSection}>
          <TouchableOpacity
            style={styles.createQuizButton}
            onPress={() => setModalVisible(true)}
          >
            <SmartText style={styles.createQuizButtonText}>Create New Quiz</SmartText>
            <Ionicons name="add-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Enhanced Quiz Creation/Edit Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setModalVisible(false);
            setEditingQuizId(null);
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <LinearGradient
                colors={['#ffffff', '#f8f9ff']}
                style={styles.modalContent}
              >
                {/* Modal Header */}
                <View style={styles.modalHeaderSection}>
                  <View style={styles.modalIconContainer}>
                    <LinearGradient
                      colors={['#4f46e5', '#a29bfe']}
                      style={styles.modalIconGradient}
                    >
                      <MaterialCommunityIcons 
                        name={editingQuizId ? "pencil" : "plus-circle"} 
                        size={32} 
                        color="#fff" 
                      />
                    </LinearGradient>
                  </View>
                  <SmartText style={styles.modalTitle}>
                    {editingQuizId ? 'Update Quiz' : 'Create New Quiz'}
                  </SmartText>
                  <SmartText style={styles.modalSubtitle}>
                    {editingQuizId ? 'Modify quiz details' : 'Fill in the quiz information'}
                  </SmartText>
                </View>

                {/* Form Fields */}
                <View style={styles.formContainer}>
                  {/* Title Input */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputLabelContainer}>
                      <MaterialCommunityIcons name="format-title" size={20} color="#4f46e5" />
                      <SmartText style={styles.inputLabel}>Quiz Title</SmartText>
                    </View>
                    <TextInput
                      style={styles.enhancedInput}
                      placeholder="Enter quiz title"
                      placeholderTextColor="#999"
                      value={quizData.title}
                      onChangeText={t => setQuizData({ ...quizData, title: t })}
                    />
                  </View>

                  {/* Subject Input */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputLabelContainer}>
                      <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#4f46e5" />
                      <SmartText style={styles.inputLabel}>Subject</SmartText>
                    </View>
                    <TextInput
                      style={styles.enhancedInput}
                      placeholder="Enter subject"
                      placeholderTextColor="#999"
                      value={quizData.subject}
                      onChangeText={t => setQuizData({ ...quizData, subject: t })}
                    />
                  </View>

                  {/* Icon Selection */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputLabelContainer}>
                      <MaterialCommunityIcons name="emoticon-happy-outline" size={20} color="#4f46e5" />
                      <SmartText style={styles.inputLabel}>Icon</SmartText>
                    </View>
                    <TouchableOpacity 
                      style={styles.enhancedSelectIconBtn} 
                      onPress={() => setIconModalVisible(true)}
                    >
                      <View style={styles.selectedIconDisplay}>
                        <View style={styles.iconPreviewCircle}>
                          <MaterialCommunityIcons name={quizData.icon} size={28} color="#4f46e5" />
                        </View>
                        <SmartText style={styles.selectIconText}>Tap to change icon</SmartText>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                  </View>

                  {/* Number of Questions Input */}
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputLabelContainer}>
                      <MaterialCommunityIcons name="counter" size={20} color="#4f46e5" />
                      <SmartText style={styles.inputLabel}>Number of Questions</SmartText>
                    </View>
                    <TextInput
                      style={styles.enhancedInput}
                      placeholder="Max 30 questions"
                      placeholderTextColor="#999"
                      value={quizData.numQuestions}
                      onChangeText={t => {
                        let val = t.replace(/[^0-9]/g, '');
                        if (val !== '' && parseInt(val) > 30) val = '30';
                        setQuizData({ ...quizData, numQuestions: val });
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.enhancedSaveBtn}
                    onPress={handleSaveQuiz}
                    disabled={saving}
                  >
                    <LinearGradient
                      colors={saving ? ['#95a5a6', '#7f8c8d'] : ['#4f46e5', '#a29bfe']}
                      style={styles.saveBtnGradient}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons 
                            name={editingQuizId ? "check" : "plus"} 
                            size={20} 
                            color="#fff" 
                          />
                          <SmartText style={styles.saveBtnText}>
                            {editingQuizId ? 'Update Quiz' : 'Create Quiz'}
                          </SmartText>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.enhancedCancelBtn} 
                    onPress={() => {
                      setModalVisible(false);
                      setEditingQuizId(null);
                    }}
                  >
                    <SmartText style={styles.cancelBtnText}>Cancel</SmartText>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Icon Selection Modal */}
        <Modal
          visible={iconModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIconModalVisible(false)}
        >
          <View style={styles.iconModalOverlay}>
            <View style={styles.iconModalContent}>
              <View style={styles.iconModalHeader}>
                <SmartText style={styles.iconModalTitle}>Select an Icon</SmartText>
                <SmartText style={styles.iconModalSubtitle}>Choose an icon that represents your quiz</SmartText>
              </View>
              
              <ScrollView contentContainerStyle={styles.iconGrid}>
                {icons.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, quizData.icon === ic && styles.iconOptionSelected]}
                    onPress={() => { 
                      setQuizData({ ...quizData, icon: ic }); 
                      setIconModalVisible(false); 
                    }}
                  >
                    <MaterialCommunityIcons name={ic} size={28} color={quizData.icon === ic ? "#fff" : "#4f46e5"} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity 
                style={styles.iconModalCloseBtn} 
                onPress={() => setIconModalVisible(false)}
              >
                <SmartText style={styles.iconModalCloseBtnText}>Close</SmartText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
        <Modal
          visible={overviewModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOverviewModalVisible(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.iconWrapper}>
                  <MaterialCommunityIcons name="school" size={32} color="#4f46e5" />
                </View>
                <SmartText style={styles.title}>Go to Classrooms!</SmartText>
              </View>

              <SmartText style={styles.message}>
                To view the quiz overview and detailed results, visit the{' '}
                <SmartText style={styles.highlightText}>Classrooms</SmartText> section on your dashboard.
              </SmartText>

              <View style={styles.visualGuideContainer}>
                <SmartText style={styles.guideTitle}>Look for this section:</SmartText>
                
                <View style={styles.dashboardPreview}>
                  <View style={styles.dashboardRow}>
                    <View style={styles.dashboardCard}>
                      <MaterialCommunityIcons name="clipboard-list" size={14} color="#4f46e5" />
                    </View>
                    <View style={[styles.dashboardCard, styles.highlightedCard]}>
                      <MaterialCommunityIcons name="school" size={14} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.dashboardRow}>
                    <View style={styles.dashboardCard}>
                      <MaterialCommunityIcons name="account-check" size={14} color="#4f46e5" />
                    </View>
                    <View style={styles.dashboardCard}>
                      <MaterialCommunityIcons name="chart-line" size={14} color="#4f46e5" />
                    </View>
                  </View>
                </View>
                
                <View style={styles.pointerContainer}>
                  <Svg height="40" width="80" style={styles.pointer}>
                    <Path
                      d="M10 30 L60 10"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <Circle cx="60" cy="10" r="4" fill="#4f46e5" />
                  </Svg>
                  <SmartText style={styles.pointerText}>Classrooms</SmartText>
                </View>
              </View>

              <View style={styles.instructionBox}>
                <MaterialCommunityIcons name="information-outline" size={18} color="#4f46e5" />
                <SmartText style={styles.instructionText}>
                  Look for the classroom icon in your dashboard Caroussel
                </SmartText>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={() => setOverviewModalVisible(false)}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" style={{ marginRight: 8 }} />
                <SmartText style={styles.buttonText}>Got it!</SmartText>
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
  createQuizButton: {
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
  createQuizButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
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
  noQuizzesText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 120,
    paddingHorizontal: 15,
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: "#4f46e5",
  },
  quizInfo: {
    flex: 1,
    marginLeft: 10,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  quizSubject: {
    fontSize: 14,
    color: '#636e72',
  },
  quizState: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  // Scheduled Quiz Grid Styles
  scheduledQuizCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconCell: {
    width: '30%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 10,
  },
  iconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8e4ff',
  },
  infoCell: {
    flex: 1,
    justifyContent: 'center',
  },
  scheduledQuizTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  scheduledQuizSubject: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 6,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8e4ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4f46e5',
    textTransform: 'capitalize',
  },
  scheduleCell: {
    width: '30%',
    paddingRight: 10,
  },
  scheduleInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 10,
    color: '#95a5a6',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scheduleValue: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
  },
  actionCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  gridActionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  gridBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  liveBtn: {
    backgroundColor: '#e74c3c',
  },
  reuseBtn: {
    backgroundColor: '#ff7675',
  },
  overviewBtn: {
    backgroundColor: '#4a69bd',
  },
  configureNeedUpdateBtn: {
    backgroundColor: '#4f46e5',
  },
  reconfigBtn: {
    backgroundColor: '#ff7675',
  },
  beginBtn: {
    backgroundColor: '#00b894',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  actionBtnr: {
    backgroundColor: '#4f46e5',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  actionBtnb: {
    backgroundColor: '#4f46e5',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  actionBtnswap: {
    minWidth: 70,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 5,
  },
  deleteBtn: {
    backgroundColor: '#e74c3c',
  },
  updateBtn: {
    backgroundColor: '#f1c40f',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  liveQuizBtn: {
    backgroundColor: '#ff7675',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 25,
    width: '90%',
    maxWidth: 500,
    paddingBottom: 25,
    alignItems: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  modalHeaderSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4ff',
  },
  modalIconContainer: {
    marginBottom: 15,
  },
  modalIconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  enhancedInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#e8e4ff',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    color: '#2c3e50',
    backgroundColor: '#fff',
  },
  enhancedSelectIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
    borderColor: '#e8e4ff',
  },
  selectedIconDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconPreviewCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectIconText: {
    color: '#7f8c8d',
    fontSize: 15,
    fontWeight: '500',
  },
  modalActions: {
    width: '100%',
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  enhancedSaveBtn: {
    marginBottom: 12,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    gap: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  enhancedCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 15,
  },
  // Icon Modal Styles
  iconModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  iconModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 25,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '75%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 20,
  },
  iconModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4ff',
  },
  iconModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  iconModalSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 5,
  },
  iconOption: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
    borderRadius: 12,
    backgroundColor: '#f8f9ff',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  iconModalCloseBtn: {
    marginTop: 20,
    backgroundColor: '#4f46e5',
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconModalCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 15,
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4f46e5",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    lineHeight: 24,
    marginBottom: 20,
  },
  highlightText: {
    fontWeight: "bold",
    color: "#4f46e5",
    backgroundColor: "#f3f0ff",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  visualGuideContainer: {
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f8f9ff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#e8e4ff",
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4f46e5",
    marginBottom: 15,
  },
  pointerContainer: {
    position: "absolute",
    top: 40,
    right: -10,
    alignItems: "center",
  },
  pointer: {
    marginBottom: 5,
  },
  pointerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4f46e5",
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4f46e5",
  },
  dashboardPreview: {
    width: 120,
    height: 120,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dashboardRow: {
    flexDirection: "row",
    marginBottom: 8,
    justifyContent: "center",
  },
  dashboardCard: {
    width: 40,
    height: 40,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  highlightedCard: {
    backgroundColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9ff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#4f46e5",
  },
  instructionText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4f46e5",
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});