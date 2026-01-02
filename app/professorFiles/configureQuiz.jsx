import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView
} from "react-native";
import { MaterialCommunityIcons,Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, Query ,ID} from "react-native-appwrite";
import { showToast } from "../../lib/toasthelper";
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import LottieView from 'lottie-react-native';
import SmartText from "../../components/SmartText";



// Initialize Appwrite client
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1") // Your Appwrite Endpoint
  .setProject(""""); // Your Appwrite Project ID

const databases = new Databases(client);

const DATABASE_ID = "685ae2ba0012dcb2feda";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";
const QUESTIONS_COLLECTION_ID = "68764f2a001a9f312389"; // Your Questions Collection ID

export default function ConfigureQuiz() {
  const router = useRouter();
  const { id: quizId } = useLocalSearchParams();

  const [quizDetails, setQuizDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedQuestions, setAddedQuestions] = useState([]);

  // State for AI Question Generation Modal
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  // Track which suggested questions have been added
  const [addedSuggestedIds, setAddedSuggestedIds] = useState([]);
  const [generationError, setGenerationError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // State for managing the opened options menu for added questions
  const [openQuestionMenuId, setOpenQuestionMenuId] = useState(null);

  // States for Update Question Modal
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [questionToUpdate, setQuestionToUpdate] = useState(null);
  const [editedQuestion, setEditedQuestion] = useState({
    question_type: 'Multiple Choice',
    question: '',
    options: {}, // For Multiple Choice
    ordering_items: [], // For Ordering questions
    correct_option: '',
    explanation: '',
    difficulty: 'Medium',
  });
  const [enhanceModalVisible, setEnhanceModalVisible] = useState(false);
  const [enhancePrompt, setEnhancePrompt] = useState('');
  const [originalQuestionToEnhance, setOriginalQuestionToEnhance] = useState(null);
  const [enhancedResult, setEnhancedResult] = useState(null);
  const [enhancing, setEnhancing] = useState(false);
  const [validating, setValidating] = useState(false);
  const closeAiModal = () => {
  setGeneratedQuestions([]);
  setAddedSuggestedIds([]);
  setSelectedFile(null); // Optional: Reset the selected file as well
  setAiModalVisible(false);
};


  // Function to fetch quiz data and questions
  const fetchQuizData = async () => {
    if (!quizId) {
      setError("Quiz ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quizResponse = await databases.getDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        quizId
      );
      setQuizDetails(quizResponse);

      const questionsResponse = await databases.listDocuments(
        DATABASE_ID,
        QUESTIONS_COLLECTION_ID,
        [
          Query.equal('quiz_id', quizId),
          Query.orderAsc('question_num')
        ]
      );
      setAddedQuestions(questionsResponse.documents);

    } catch (err) {
      console.error("Failed to fetch quiz data:", err);
      setError("Failed to load quiz data. Please try again.");
      showToast("Failed to load quiz data.");
    } finally {
      setLoading(false);
    }
  }; // ✅ Corrected: The closing brace for fetchQuizData was moved here.

  useEffect(() => {
    fetchQuizData();
  }, [quizId]);

  const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; 

const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (!result.canceled) {
        const file = result.assets[0];

        // Check file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
          Alert.alert(
            "File Too Large",
            `Please select a file smaller than ${MAX_FILE_SIZE_MB} MB.`,
          );
          return;
        }

        setSelectedFile(file);
        showToast("PDF selected: " + file.name);
      }
    } catch (err) {
      console.error("Error picking document:", err);
      showToast("Failed to select document.");
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedFile) {
      setGenerationError("Please select a PDF file first.");
      return;
    }

    const totalQuizQuestions = quizDetails?.["quiz-nb-question"] ? Number(quizDetails["quiz-nb-question"]) : 0;
    const alreadyAdded = addedQuestions.length;
    // Removed the check here as it will be handled by the button's disabled state
    const toGenerate = Math.max(totalQuizQuestions - alreadyAdded, 1);

    setGenerationError(null);
    setGeneratedQuestions([]);
    setGeneratingQuestions(true);

    const formData = new FormData();
    formData.append('quizId', quizId);
    formData.append('pdf', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType,
    });
    formData.append('numQuestions', toGenerate);

    try {
      const apiUrl = "https://talk-with-ai-six.vercel.app/api/quiz?action=generate";

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(result.error || 'Failed to generate questions.');
        return;
      }
      setGeneratedQuestions(result);
      showToast(`Questions generated successfully! (${toGenerate} requested)`);

    } catch (err) {
      console.error("Error generating questions:", err);
      setGenerationError("An error occurred: " + err.message);
      showToast("Error generating questions.");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleEnhanceQuestion = (questionObject) => {
    setOpenQuestionMenuId(null);
    setOriginalQuestionToEnhance(questionObject);
    setEnhancePrompt('');
    setEnhancedResult(null);
    setEnhanceModalVisible(true);
  };

  const runEnhancement = async () => {
    if (!enhancePrompt || !originalQuestionToEnhance) return;

    showToast("Enhancing question...");
    setEnhancing(true);

    try {
      const apiUrl = "https://enhancement-two.vercel.app/api/enhancement";
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionObject: originalQuestionToEnhance,
          userPrompt: enhancePrompt
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEnhancedResult(result);

    } catch (err) {
      console.error("Enhancement failed:", err);
      showToast("Failed to enhance question.");
    } finally {
      setEnhancing(false);
    }
  };


  const handleAddQuestionToQuiz = async (question) => {
    Alert.alert(
      "Add Question",
      `Are you sure you want to add this question to your quiz?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: async () => {
            try {
              const nextQuestionNum = (addedQuestions.length || 0) + 1;

              // Handle options based on question type
              let optionsData = '';
              if (question.question_type === 'Multiple Choice' && typeof question.options === 'object') {
                optionsData = JSON.stringify(question.options);
              } else if (question.question_type === 'Ordering' && Array.isArray(question.ordering_items)) {
                optionsData = JSON.stringify(question.ordering_items);
              } else if (typeof question.options === 'string') {
                optionsData = question.options; // Keep as is if already string (e.g. from Appwrite)
              }


              const questionData = {
                question_type: question.question_type,
                question: question.question,
                options: optionsData, // Use the prepared options data
                correct_option: String(question.correct_option).slice(0, 1000),
                explanation: question.explanation || '',
                difficulty: question.difficulty || 'Medium',
                quiz_id: quizId,
                question_num: nextQuestionNum,
              };

              const newDoc = await databases.createDocument(
                DATABASE_ID,
                QUESTIONS_COLLECTION_ID,
                ID.unique(),
                questionData
              );

              setAddedQuestions(prevQuestions =>
                [...prevQuestions, newDoc].sort((a, b) => a.question_num - b.question_num)
              );
              showToast("Question added to quiz successfully!");

              setAddedSuggestedIds(prev => [...prev, question.$id || question.question]);

            } catch (err) {
              console.error("Failed to add question to quiz:", err);
              showToast("Failed to add question to quiz.");
            }
          }
        }
      ]
    );
  };

  const openUpdateModal = (question) => {
    setOpenQuestionMenuId(null);
    setQuestionToUpdate(question);
    try {
      const parsedOptions = typeof question.options === 'string' && question.options ? JSON.parse(question.options) : question.options;

      let initialEditedQuestion = {
        question_type: question.question_type,
        question: question.question,
        options: {}, // Default for MC
        ordering_items: [], // Default for Ordering
        correct_option: question.correct_option,
        explanation: question.explanation || '',
        difficulty: question.difficulty || 'Medium',
      };

      if (question.question_type === 'Multiple Choice') {
        initialEditedQuestion.options = parsedOptions || {};
      } else if (question.question_type === 'Ordering') {
        initialEditedQuestion.ordering_items = Array.isArray(parsedOptions) ? parsedOptions : [];
      }
      setEditedQuestion(initialEditedQuestion);

    } catch (e) {
      console.error("Failed to parse options for update:", e);
      setEditedQuestion({ ...question, options: {}, ordering_items: [] }); // Fallback
    }
    setUpdateModalVisible(true);
  };

  const handleSaveUpdatedQuestion = async () => {
    if (!questionToUpdate) return;

    showToast("Updating question...");
    try {
      let optionsToSave = '';
      if (editedQuestion.question_type === 'Multiple Choice') {
        optionsToSave = JSON.stringify(editedQuestion.options);
      } else if (editedQuestion.question_type === 'Ordering') {
        optionsToSave = JSON.stringify(editedQuestion.ordering_items);
      } else {
        optionsToSave = ''; // Other types might not have options
      }

      const updatedData = {
        question_type: editedQuestion.question_type,
        question: editedQuestion.question,
        options: optionsToSave,
        correct_option: String(editedQuestion.correct_option).slice(0, 1000),
        explanation: editedQuestion.explanation,
        difficulty: editedQuestion.difficulty,
      };

      const result = await databases.updateDocument(
        DATABASE_ID,
        QUESTIONS_COLLECTION_ID,
        questionToUpdate.$id,
        updatedData
      );

      setAddedQuestions(prevQuestions =>
        prevQuestions.map(q => (q.$id === result.$id ? result : q))
      );
      setUpdateModalVisible(false);
      showToast("Question updated successfully!");
    } catch (err) {
      console.error("Failed to update question:", err);
      showToast("Failed to update question.");
    }
  };


  const handleDeleteQuestion = async (questionId, deletedQuestionNum) => {
    setOpenQuestionMenuId(null);
    Alert.alert(
      "Delete Question",
      "Are you sure you want to delete this question?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await databases.deleteDocument(
                DATABASE_ID,
                QUESTIONS_COLLECTION_ID,
                questionId
              );

              showToast("Question deleted successfully!");

              const questionsToReorder = addedQuestions.filter(
                q => q.question_num > deletedQuestionNum
              );

              const updatePromises = questionsToReorder.map(async (q) => {
                const newQuestionNum = q.question_num - 1;
                return databases.updateDocument(
                  DATABASE_ID,
                  QUESTIONS_COLLECTION_ID,
                  q.$id,
                  { question_num: newQuestionNum }
                );
              });

              await Promise.all(updatePromises);

              await fetchQuizData();

            } catch (err) {
              console.error("Failed to delete or re-sequence question:", err);
              showToast("Failed to delete question or re-sequence.");
            }
          }
        }
      ]
    );
  };
  const handleResetQuiz = async () => {
  Alert.alert(
    "Reset Quiz",
    "Are you sure you want to delete all questions for this quiz?",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Yes",
        onPress: async () => {
          try {
            if (!quizId) {
              Alert.alert("Error", "Quiz ID is missing.");
              return;
            }

            // Fetch all questions for the current quiz
            const questionsResponse = await databases.listDocuments(
              DATABASE_ID,
              QUESTIONS_COLLECTION_ID,
              [Query.equal('quiz_id', quizId)]
            );

            if (questionsResponse.documents.length === 0) {
              Alert.alert("Info", "No questions found to delete.");
              return;
            }

            // Create an array of deletion promises
            const deletePromises = questionsResponse.documents.map(q =>
              databases.deleteDocument(
                DATABASE_ID,
                QUESTIONS_COLLECTION_ID,
                q.$id
              )
            );

            // Wait for all deletion operations to complete
            await Promise.all(deletePromises);

            // Refresh the list of questions after deletion
            fetchQuizData();

            Alert.alert("Success", "All questions have been deleted.");
          } catch (error) {
            console.error("Error resetting quiz:", error);
            Alert.alert("Error", "Failed to reset quiz. Please try again.");
          }
        }
      }
    ]
  );
};

  const handleValidateQuiz = () => {
    const requiredQuestions = Number(quizDetails["quiz-nb-question"]);
    const currentQuestions = addedQuestions.length;

    if (currentQuestions < requiredQuestions) {
        Alert.alert(
            "Not Enough Questions",
            `You have only added ${currentQuestions} out of the required ${requiredQuestions} questions. Do you want to proceed and update the quiz size to ${currentQuestions}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "OK", onPress: () => confirmValidation(true) }
            ]
        );
    } else if (currentQuestions > requiredQuestions) { // Changed from currentQuestions < requiredQuestions
       Alert.alert(
            "More Questions than required",
            `You have added ${currentQuestions} out of the required ${requiredQuestions} questions. Do you want to proceed and update the quiz size to ${currentQuestions}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "OK", onPress: () => confirmValidation(true) }
            ]
        );
      }
        else {
           confirmValidation(false);
        }

    };

const confirmValidation = async (updateCount) => {
    setValidating(true);
    try {
        const updateData = {
            "quiz-state": "configured"
        };

        if (updateCount) {
            updateData["quiz-nb-question"] = addedQuestions.length;
        }

        const updatedQuiz = await databases.updateDocument(
            DATABASE_ID,
            QUIZ_INFO_COLLECTION_ID,
            quizId,
            updateData
        );

        setQuizDetails(updatedQuiz);
        showToast("Quiz has been validated and configured!");
        router.replace('/professorFiles/professorCourses');

    } catch (err) {
        console.error("Failed to validate quiz:", err);
        showToast("Error validating quiz. Please try again.");
    } finally {
        setValidating(false);
    }
};

const QuestionDetails = ({ question, isSuggestion = false }) => {
    if (!question) return null;

    let options = question.options;
    // For enhanced suggestions, options might be a stringified JSON
    if (typeof options === 'string' && options) {
        try {
            options = JSON.parse(options);
        } catch (e) {
            options = null; // Could not parse
        }
    }
    
    const orderingItems = question.ordering_items || (Array.isArray(options) ? options : null);
    

    return (
        <View style={styles.comparisonColumn}>
            <SmartText style={styles.comparisonHeader}>{isSuggestion ? 'AI Suggestion (After)' : 'Original (Before)'}</SmartText>
            
            <View style={styles.detailRow}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color="#636e72" style={styles.detailIcon} />
                <SmartText style={styles.detailText}><SmartText style={{fontWeight: 'bold'}}>Question:</SmartText> {question.question}</SmartText>
            </View>

            <View style={styles.detailRow}>
                <MaterialCommunityIcons name="format-list-bulleted-type" size={18} color="#636e72" style={styles.detailIcon} />
                <SmartText style={styles.detailText}><SmartText style={{fontWeight: 'bold'}}>Type:</SmartText> {question.question_type}</SmartText>
            </View>
            
            {question.question_type === 'Multiple Choice' && typeof options === 'object' && !Array.isArray(options) && (
                <View style={styles.optionsContainer}>
                    {Object.entries(options).map(([key, value]) => (
                        <SmartText key={key} style={styles.optionText}>{key}: {value}</SmartText>
                    ))}
                </View>
            )}

            {question.question_type === 'Ordering' && orderingItems && (
                <View style={styles.optionsContainer}>
                    <SmartText style={styles.optionText}>Items to Order:</SmartText>
                    {orderingItems.map((item, index) => (
                        <SmartText key={index} style={styles.optionText}>{index + 1}. {item}</SmartText>
                    ))}
                </View>
            )}
            
            <View style={styles.detailRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#00b894" style={styles.detailIcon} />
                <SmartText style={styles.correctAnswerText}>Correct: {question.correct_option}</SmartText>
            </View>

            {question.explanation && (
                <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="brain" size={18} color="#636e72" style={styles.detailIcon} />
                    <SmartText style={styles.detailText}><SmartText style={{fontWeight: 'bold'}}>Expl:</SmartText> {question.explanation}</SmartText>
                </View>
            )}

            <View style={styles.detailRow}>
                <MaterialCommunityIcons name="chart-line" size={18} color="#636e72" style={styles.detailIcon} />
                <SmartText style={styles.detailText}><SmartText style={{fontWeight: 'bold'}}>Difficulty:</SmartText> {question.difficulty}</SmartText>
            </View>
        </View>
    );
};


  // Calculate if generation is complete
  const isGenerationComplete = quizDetails && addedQuestions.length >= Number(quizDetails["quiz-nb-question"]);
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
          <SmartText style={styles.loadingText}>Retrieving data...</SmartText>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

  return (
  <SafeAreaView style={styles.safeArea}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
     <View style={{ flex: 1 }}>
      <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>
      
      <LinearGradient colors={["#4f46e5", "#a29bfe"]} style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.leftSection}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.replace('/professorFiles/professorCourses')}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.textSection}>
              <SmartText style={styles.headerTitle}>Configure Quiz</SmartText>
              <SmartText style={styles.headerSubtitle}>Set up your quiz questions with AI</SmartText>
            </View>
          </View>

          <View style={styles.rightSection}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={require('../../animations/ai-loading.json')}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            </View>
          </View>
        </View>
      </LinearGradient>

      
  {error ? (
    <SmartText style={styles.errorText}>{String(error)}</SmartText>
  ) : quizDetails ? (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.twoColumnContainer}>
  {/* Left column - Quiz details (50% width, full height) */}
  <View style={styles.leftColumn}>
    <View style={styles.quizDetailCard}>
    <MaterialCommunityIcons
      name={quizDetails["quiz-icon"] || "book-outline"}
      size={60}
      color="#4f46e5" // The mask uses black as opaque
      style={styles.quizIcon}
    />
      <SmartText style={styles.detailTitle}>{String(quizDetails["quiz-title"])}</SmartText>
      <SmartText style={styles.detailSubject}>Subject: {String(quizDetails["quiz-subject"])}</SmartText>
      <SmartText style={styles.detailText}>Target Questions: {String(quizDetails["quiz-nb-question"])}</SmartText>
      <SmartText style={styles.detailText}>Current State: {String(quizDetails["quiz-state"])}</SmartText>
    </View>
  </View>

  {/* Right column - Configuration options (50% width) */}
  <View style={styles.rightColumn}>
    {/* Top half - Generate button */}
     <LinearGradient
  colors={['#4f46e5', '#a29bfe', '#74b9ff']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.topHalf}
>
      <TouchableOpacity style={styles.configButtonHalf} onPress={() => setAiModalVisible(true)}>
        
        <MaterialCommunityIcons name="robot" size={24} color="#fff" style={{ marginBottom: 8 }} />
        <SmartText style={styles.configButtonText}>Generate Questions</SmartText>
        <SmartText style={styles.configButtonSubText}>(AI Assist)</SmartText>
        
      </TouchableOpacity>
    </LinearGradient>

    {/* Bottom half - Reset button */}
    <View style={styles.bottomHalf}>
      <TouchableOpacity style={[styles.configButtonHalf, styles.resetButtonHalf]} onPress={handleResetQuiz}>
        <MaterialCommunityIcons name="refresh" size={24} color="#fff" style={{ marginBottom: 8 }} />
        <SmartText style={styles.configButtonText}>Reset Quiz</SmartText>
        <SmartText style={styles.configButtonSubText}>(Clear all questions)</SmartText>
      </TouchableOpacity>
    </View>
  </View>
</View>

        {/* Added questions */}
        <View style={styles.addedQuestionsSection}>
          <SmartText style={styles.sectionTitle}>Added Questions ({addedQuestions.length})</SmartText>
          {loading ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : addedQuestions.length > 0 ? (
            <ScrollView
  style={styles.addedQuestionsList}
  nestedScrollEnabled={true}
  showsVerticalScrollIndicator={false}
>
  {[...addedQuestions]
    .sort((a, b) => (a.question_num || 0) - (b.question_num || 0))
    .map((q, index) => {
      // Logic for parsing options
      let displayedOptions = [];
      if (q.question_type === 'Multiple Choice' && q.options && typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          if (typeof parsed === 'object') {
            displayedOptions = Object.entries(parsed);
          }
        } catch (e) { /* silent fail */ }
      }

      // Determine if the item is near the end of the list to adjust menu position
      const isLastItem = index >= addedQuestions.length - 2;

      return (
        <View key={q.$id || index} style={styles.questionItem}>
          <View style={styles.questionHeader}>
            <SmartText style={styles.questionText}>Q{q.question_num || index + 1}: {String(q.question)}</SmartText>
            <TouchableOpacity onPress={() => setOpenQuestionMenuId(openQuestionMenuId === q.$id ? null : q.$id)}>
              <MaterialCommunityIcons name="dots-vertical" size={24} color="#636e72" />
            </TouchableOpacity>
          </View>

          {/* This is the menu for each question, which was also missing */}
          {openQuestionMenuId === q.$id && (
            <View style={[styles.questionMenu, isLastItem ? { bottom: 40 } : { top: 45 }]}>
              <TouchableOpacity style={styles.menuButton} onPress={() => openUpdateModal(q)}>
                <SmartText style={styles.menuButtonText}>Update</SmartText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuButton} onPress={() => handleDeleteQuestion(q.$id, q.question_num)}>
                <SmartText style={[styles.menuButtonText, { color: '#d63031' }]}>Delete</SmartText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuButton} onPress={() => handleEnhanceQuestion(q)}>
                <SmartText style={[styles.menuButtonText, { color: '#fdcb6e' }]}>Enhance</SmartText>
              </TouchableOpacity>
            </View>
          )}

          <SmartText style={styles.detailText}>Type: {String(q.question_type)}</SmartText>

          {/* Render Multiple Choice options */}
          {q.question_type === 'Multiple Choice' && displayedOptions.length > 0 && (
            <View style={styles.optionsContainer}>
              {displayedOptions.map(([key, value]) => (
                <SmartText key={key} style={styles.optionText}>{key}: {value}</SmartText>
              ))}
            </View>
          )}

          {/* Render Ordering items */}
          {q.question_type === 'Ordering' && q.options && typeof q.options === 'string' && (() => {
            try {
              const parsedOrderingItems = JSON.parse(q.options);
              if (Array.isArray(parsedOrderingItems)) {
                return (
                  <View style={styles.optionsContainer}>
                    <SmartText style={styles.optionText}>Items to Order:</SmartText>
                    {parsedOrderingItems.map((item, idx) => (
                      <SmartText key={idx} style={styles.optionText}> {idx + 1}. {item}</SmartText>
                    ))}
                  </View>
                );
              }
            } catch (e) { /* silent fail */ }
            return null;
          })()}

          <SmartText style={styles.correctAnswerText}>Correct Answer: {String(q.correct_option)}</SmartText>
        </View>
      );
    })}
</ScrollView>
          ) : (
            <SmartText style={styles.noQuestionsText}>No questions set up for this quiz yet.</SmartText>
          )}
        </View>
      </ScrollView>

      {/* ✅ Fixed Bottom Button OUTSIDE ScrollView */}
      {quizDetails["quiz-state"] === "not-configured" && (
        <View style={styles.fixedBottomSection}>
          <LinearGradient
  colors={['#4f46e5', '#a29bfe', '#74b9ff']}
  start={{ x: 1, y: 1 }}
  end={{ x: 0, y: 0 }}
  style={styles.topHalf}
>
          <TouchableOpacity
            style={styles.validateButton}
            onPress={handleValidateQuiz}
            disabled={validating}
          >
            {validating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" style={{ marginRight: 10 }} />
                <SmartText style={styles.validateButtonText}>Validate Quiz</SmartText>
              </>
            )}
          </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </>
  ) : (
    <SmartText style={styles.noQuizFoundText}>No quiz details found.</SmartText>
  )}
</LinearGradient>

      

      {/* AI Question Generation Modal */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAiModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aiModalContent}>
            <SmartText style={styles.modalTitle}>Generate Questions with AI</SmartText>

            <TouchableOpacity style={styles.uploadPdfButton} onPress={handlePickDocument}>
              <SmartText style={styles.uploadPdfButtonText}>
                {selectedFile ? `Selected: ${selectedFile.name}` : "Pick a PDF Course File"}
              </SmartText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadPdfButton, { backgroundColor: '#74b9ff' }]}
              onPress={handleGenerateQuestions}
              // Disable button if generating, no file selected, or generation is complete
              disabled={generatingQuestions || !selectedFile || isGenerationComplete}
            >
              {generatingQuestions ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <SmartText style={[styles.uploadPdfButtonText, { color: '#fff' }]}>
                  {isGenerationComplete ? "You have fully generated the required questions" : "Generate Questions from PDF"}
                </SmartText>
              )}
            </TouchableOpacity>

            {generationError && <SmartText style={styles.errorTextSmall}>{String(generationError)}</SmartText>}

            {generatedQuestions.length > 0 && (
              <ScrollView style={styles.generatedQuestionsContainer}>
                <SmartText style={styles.generatedQuestionsTitle}>Suggested Questions:</SmartText>
                {generatedQuestions.map((q, index) => {
                  const isAdded = addedSuggestedIds.includes(q.$id || q.question);
                  return (
                    <View key={q.$id || index} style={styles.questionItem}>
                      <SmartText style={styles.questionText}>Q{index + 1}: {String(q.question)}</SmartText>
                      <SmartText style={styles.detailText}>Type: {q.question_type}</SmartText>
                      {q.question_type === 'Multiple Choice' && q.options && Object.keys(q.options).length > 0 && (
                        <View style={styles.optionsContainer}>
                          {Object.entries(q.options).map(([key, value]) => (
                            <SmartText key={key} style={styles.optionText}>{key}: {value}</SmartText>
                          ))}
                        </View>
                      )}
                       {q.question_type === 'Ordering' && q.ordering_items && Array.isArray(q.ordering_items) && (
                        <View style={styles.optionsContainer}>
                          <SmartText style={styles.optionText}>Items to Order:</SmartText>
                          {q.ordering_items.map((item, idx) => (
                            <SmartText key={idx} style={styles.optionText}>  {idx + 1}. {item}</SmartText>
                          ))}
                        </View>
                      )}
                      <SmartText style={styles.correctAnswerText}>Correct Answer: {String(q.correct_option)}</SmartText>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity
                          style={[styles.addQuestionButton, isAdded && { backgroundColor: '#b2bec3' }]}
                          onPress={() => handleAddQuestionToQuiz(q)}
                          disabled={isAdded}
                        >
                          <SmartText style={styles.addQuestionButtonText}>{isAdded ? 'Added' : 'Add'}</SmartText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                <SmartText></SmartText>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={closeAiModal}
            >
              <SmartText style={styles.closeModalButtonText}>Close</SmartText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Update Question Modal */}
      <Modal
        visible={updateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.updateModalContent}>
            <SmartText style={styles.modalTitle}>Update Question</SmartText>

            <ScrollView style={{ width: '100%' }}>
              <SmartText style={styles.inputLabel}>Question Type:</SmartText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editedQuestion.question_type}
                  onValueChange={(itemValue) => setEditedQuestion({ ...editedQuestion, question_type: itemValue, options: {}, ordering_items: [] })}
                  style={styles.picker}
                  itemStyle={Platform.OS === 'ios' ? styles.pickerItem : null}
                >
                  <Picker.Item label="Multiple Choice" value="Multiple Choice" />
                  <Picker.Item label="True/False" value="True/False" />
                  <Picker.Item label="Short Answer" value="Short Answer" />
                  <Picker.Item label="Ordering" value="Ordering" />
                </Picker>
              </View>

              <SmartText style={styles.inputLabel}>Question:</SmartText>
              <TextInput
                style={styles.textInput}
                value={editedQuestion.question}
                onChangeText={(text) => setEditedQuestion({ ...editedQuestion, question: text })}
                multiline
              />

              {editedQuestion.question_type === 'Multiple Choice' && (
                <>
                  <SmartText style={styles.inputLabel}>Options (A, B, C, D...):</SmartText>
                  {Object.keys(editedQuestion.options).map((key, idx) => (
                    <View key={key} style={styles.optionInputRow}>
                      <SmartText style={styles.optionLabel}>{key}:</SmartText>
                      <TextInput
                        style={styles.optionTextInput}
                        value={editedQuestion.options[key]}
                        onChangeText={(text) =>
                          setEditedQuestion(prev => ({
                            ...prev,
                            options: { ...prev.options, [key]: text }
                          }))
                        }
                      />
                      <TouchableOpacity onPress={() => {
                        const newOptions = { ...editedQuestion.options };
                        delete newOptions[key];
                        setEditedQuestion(prev => ({ ...prev, options: newOptions }));
                      }}>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#d63031" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={() => {
                      const nextOptionKey = String.fromCharCode(65 + Object.keys(editedQuestion.options).length);
                      setEditedQuestion(prev => ({
                        ...prev,
                        options: { ...prev.options, [nextOptionKey]: '' }
                      }));
                    }}
                  >
                    <SmartText style={styles.addOptionButtonText}>Add Option</SmartText>
                  </TouchableOpacity>
                </>
              )}

              {editedQuestion.question_type === 'Ordering' && (
                <>
                  <SmartText style={styles.inputLabel}>Ordering Items:</SmartText>
                  {editedQuestion.ordering_items.map((item, idx) => (
                    <View key={idx} style={styles.optionInputRow}>
                      <SmartText style={styles.optionLabel}>{idx + 1}.</SmartText>
                      <TextInput
                        style={styles.optionTextInput}
                        value={item}
                        onChangeText={(text) => {
                          const newItems = [...editedQuestion.ordering_items];
                          newItems[idx] = text;
                          setEditedQuestion(prev => ({ ...prev, ordering_items: newItems }));
                        }}
                      />
                      <TouchableOpacity onPress={() => {
                        const newItems = editedQuestion.ordering_items.filter((_, i) => i !== idx);
                        setEditedQuestion(prev => ({ ...prev, ordering_items: newItems }));
                      }}>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#d63031" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={() => {
                      setEditedQuestion(prev => ({
                        ...prev,
                        ordering_items: [...prev.ordering_items, '']
                      }));
                    }}
                  >
                    <SmartText style={styles.addOptionButtonText}>Add Item</SmartText>
                  </TouchableOpacity>
                </>
              )}

              <SmartText style={styles.inputLabel}>Correct Option:</SmartText>
              <TextInput
                style={styles.textInput}
                value={editedQuestion.correct_option}
                onChangeText={(text) => setEditedQuestion({ ...editedQuestion, correct_option: text })}
                placeholder={editedQuestion.question_type === 'Ordering' ? "e.g., 1,2,3 for order of items" : ""}
              />

              <SmartText style={styles.inputLabel}>Explanation (Optional):</SmartText>
              <TextInput
                style={styles.textInput}
                value={editedQuestion.explanation}
                onChangeText={(text) => setEditedQuestion({ ...editedQuestion, explanation: text })}
                multiline
              />

              <SmartText style={styles.inputLabel}>Difficulty:</SmartText>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editedQuestion.difficulty}
                  onValueChange={(itemValue) => setEditedQuestion({ ...editedQuestion, difficulty: itemValue })}
                  style={styles.picker}
                  itemStyle={Platform.OS === 'ios' ? styles.pickerItem : null}
                >
                  <Picker.Item label="Easy" value="Easy" />
                  <Picker.Item label="Medium" value="Medium" />
                  <Picker.Item label="Hard" value="Hard" />
                </Picker>
              </View>
            </ScrollView>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#4f46e5' }]}
                onPress={handleSaveUpdatedQuestion}
              >
                <SmartText style={styles.modalActionButtonText}>Save Changes</SmartText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#dfe6e9' }]}
                onPress={() => setUpdateModalVisible(false)}
              >
                <SmartText style={[styles.modalActionButtonText, { color: '#2d3436' }]}>Cancel</SmartText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={enhanceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEnhanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.aiModalContent}>
            <SmartText style={styles.modalTitle}>Enhance Question</SmartText>

            <SmartText style={styles.inputLabel}>Suggest Your Enhancement</SmartText>
            <TextInput
                style={styles.textInput}
                placeholder="e.g. Make it harder, add an explanation"
                value={enhancePrompt}
                onChangeText={setEnhancePrompt}
            />

            <TouchableOpacity
                style={[styles.uploadPdfButton, { backgroundColor: '#fdcb6e' }]}
                onPress={runEnhancement}
                disabled={enhancing}
            >
                {enhancing ? <ActivityIndicator color="#000" /> : <SmartText style={[styles.uploadPdfButtonText, { color: '#000' }]}>Run Enhancement</SmartText>}
            </TouchableOpacity>

            <ScrollView style={{width: '100%'}}>
            <View style={styles.comparisonContainer}>
                <QuestionDetails question={originalQuestionToEnhance} />
                {enhancedResult && <QuestionDetails question={enhancedResult} isSuggestion={true} />}
            </View>
            </ScrollView>
            

            {enhancedResult && (
                <TouchableOpacity
                style={[styles.uploadPdfButton, { backgroundColor: '#00b894', marginTop: 15 }]}
                onPress={async () => {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            QUESTIONS_COLLECTION_ID,
                            originalQuestionToEnhance.$id,
                            {
                                ...enhancedResult,
                                options: typeof enhancedResult.options === 'object' ? JSON.stringify(enhancedResult.options) : enhancedResult.options
                            }
                        );
                        await fetchQuizData(); // Refresh data from server
                        showToast("Question enhanced and saved!");
                        setEnhanceModalVisible(false);
                    } catch (err) {
                        console.error("Save failed:", err);
                        showToast("Failed to save enhanced question.");
                    }
                }}
                >
                <SmartText style={styles.uploadPdfButtonText}>Accept & Save Suggestion</SmartText>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setEnhanceModalVisible(false)}
            >
                <SmartText style={styles.closeModalButtonText}>Close</SmartText>
            </TouchableOpacity>
            </View>
        </View>
</Modal>
</View>
</KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
  flex: 1,
  backgroundColor: "#4f46e5", // match login.jsx
},
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { textAlign: 'center', color: '#d63031', marginTop: 50, fontSize: 16 },
  noQuizFoundText: { textAlign: 'center', color: '#636e72', marginTop: 50, fontSize: 16 },
  contentContainer: { padding: 20 },
  quizDetailCard: {
  backgroundColor: '#fff',
  borderRadius: 15,
  padding: 20,
  alignItems: 'center',
  flex: 1, // Takes full height of left column
  justifyContent: 'center', // Centers content vertically
  shadowColor: '#4f46e5',
  shadowOpacity: 0.1,
  shadowRadius: 10,
},
  quizIcon: { marginBottom: 15 },
 detailTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#636e72',
  marginBottom: 12,
  textAlign: 'center',
  lineHeight: 24,
},
detailSubject: {
  fontSize: 16,
  color: '#4f46e5',
  fontWeight: '600',
  marginBottom: 10,
  textAlign: 'center',
},
detailText: {
  fontSize: 15,
  color: '#636e72',
  marginBottom: 8,
  textAlign: 'center',
  fontWeight: '500',
},
  configurationSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#6e5ce7', marginBottom: 20, textAlign: 'center' },
  configButton: {
    backgroundColor: '#00b894',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  configButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '85%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#2d3436', marginBottom: 20 },
  uploadPdfButton: {
    backgroundColor: '#a29bfe',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
    width: '100%',
  },
  uploadPdfButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center',  lineHeight: 24, },
  generatedQuestionsContainer: {
    width: '100%',
    padding: 10,
    maxHeight: 350,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 10,
    marginBottom: 15,
  },
  generatedQuestionsTitle: { fontSize: 16, fontWeight: 'bold', color: '#2d3436', marginBottom: 10 },
  questionItem: {
    backgroundColor: '#f4f7fc',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    position: 'relative',
  },
  questionText: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#2d3436', marginRight: 10 },
  correctAnswerText: { fontSize: 14, fontWeight: 'bold', color: '#00b894', marginTop: 8 },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  enhanceButton: {
    backgroundColor: '#fdcb6e',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
  },
  enhanceButtonText: { color: '#2d3436', fontSize: 14, fontWeight: 'bold' },
  addQuestionButton: {
    backgroundColor: '#00b894',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  addQuestionButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  closeModalButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#dfe6e9',
  },
  closeModalButtonText: { color: '#2d3436', fontWeight: 'bold' },
  errorTextSmall: { color: '#d63031', fontSize: 14, marginTop: 5, marginBottom: 10, textAlign: 'center' },
  optionsContainer: {
    marginTop: 10,
    marginBottom: 5,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#dfe6e9',
  },
  optionText: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 3,
  },
  addedQuestionsSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  addedQuestionsList: {
    maxHeight: 300,
  },
  noQuestionsText: {
    textAlign: 'center',
    color: '#636e72',
    fontStyle: 'italic',
    marginTop: 10,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  questionMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    position: 'absolute',
    right: 15,
    zIndex: 10, // Ensure menu is on top
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  menuButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  menuButtonText: {
    fontSize: 14,
    color: '#2d3436',
  },
  // Styles for Update Modal
  updateModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '85%',
    alignItems: 'center',
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
    color: '#2d3436',
  },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 150 : 50,
  },
  pickerItem: {
    height: 150,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  optionLabel: {
    fontWeight: 'bold',
    marginRight: 10,
    width: 20,
  },
  optionTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 8,
    marginRight: 10,
    fontSize: 14,
  },
  addOptionButton: {
    backgroundColor: '#00b894',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  addOptionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  modalActionButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  modalActionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  comparisonContainer: {
    width: '100%',
    marginTop: 10,
  },
  comparisonColumn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    marginBottom: 15,
  },
  comparisonHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 8,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#dfe6e9',
    paddingBottom: 5,
  },
   detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Use flex-start for better alignment with long text
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
    marginTop: 1, // Adjust to vertically align with text
  },
 
  correctAnswerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00b894',
    flex: 1, // Ensures text wraps
  },
   resetButton: {
    backgroundColor: '#e74c3c',
    marginTop: 10,
  },
  // Add these new styles to your existing styles object
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
  backgroundColor: '#fff',
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
},
lottieAnimation: {
  width: 85,
  height: 85,
  borderRadius:20,
},
scrollContent: {
  flexGrow: 1,
  paddingBottom: 140, // Increase from 120 to 140 to give more space
  paddingRight: 20,
  paddingLeft: 20,
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
validateButton: {
  backgroundColor: 'Transparent',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 18,
  paddingHorizontal: 30,
  borderRadius: 15,
  shadowRadius: 12,
},
validateButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
twoColumnContainer: {
  flexDirection: 'row',
  height: 280, // Fixed height for the container
  marginBottom: 20,
  gap: 15,
},
leftColumn: {
  flex: 1, // 50% width
  height: '100%',
},
rightColumn: {
  flex: 1, // 50% width
  height: '100%',
  gap: 10,
},
topHalf: {
  flex: 1, // 50% of right column height
  borderRadius: 15,
},
bottomHalf: {
  flex: 1, // 50% of right column height
},
configButtonHalf: {
  backgroundColor: 'Transparent',
  flex: 1,
  borderRadius: 15,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 15,
  shadowColor: '#4f46e5',
  shadowOpacity: 0.3,
  shadowRadius: 10,
},
resetButtonHalf: {
  backgroundColor: '#e74c3c',
  shadowColor: '#e74c3c',
},
configButtonSubText: {
  color: 'rgba(255,255,255,0.8)',
  fontSize: 12,
  fontWeight: '500',
  marginTop: 4,
  textAlign: 'center',
},
});