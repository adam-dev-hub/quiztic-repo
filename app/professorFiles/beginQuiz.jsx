import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
  TextInput
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, Query, ID } from "react-native-appwrite";
import { showToast } from "../../lib/toasthelper"
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import LottieView from 'lottie-react-native';
import SmartText from "../../components/SmartText";


// Initialize Appwrite client
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("""");

const databases = new Databases(client);

const DATABASE_ID = "685ae2ba0012dcb2feda";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";
const ACTIVE_QUIZZES_COLLECTION_ID = "68764f2a001a9f312390";
const QUIZ_PARTICIPANTS_COLLECTION_ID = "687ec780001053a5ec08";
const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254"; // The student database ID you provided

const locationRanges = [50, 70, 90, 100, 500, 1000]; // in meters

// Haversine formula to calculate distance between two lat/lon points
const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371e3; // metres

  const lat1 = toRad(coords1.latitude);
  const lon1 = toRad(coords1.longitude);
  const lat2 = toRad(coords2.latitude);
  const lon2 = toRad(coords2.longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in metres
};

const getStatusColor = (status) => {
  switch (status) {
    case 'granted':
      return '#27ae60'; // Green
    case 'denied':
      return '#e74c3c'; // Red
    case 'waiting_for_launch':
      return '#f39c12'; // Orange
    default:
      return '#636e72'; // Gray
  }
};

export default function BeginQuiz() {
  const router = useRouter();
  const { id: quizId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [quizDetails, setQuizDetails] = useState(null);
  const [error, setError] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrImageUri, setQrImageUri] = useState(null);
  const qrCodeRef = useRef(null);

  // Quiz configuration states
  const [trackLocation, setTrackLocation] = useState(true);
  const [locationRange, setLocationRange] = useState(100); // Default location range
  const [professorLocation, setProfessorLocation] = useState(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [quizParts, setQuizParts] = useState([{ name: 'Part 1', questions: '' }]);
  const [currentQuizSessionId, setCurrentQuizSessionId] = useState(null);
  const [registerAsSupport, setRegisterAsSupport] = useState(true);
  const [allowSelfTesting, setAllowSelfTesting] = useState(false);
  const [timePerQuestion, setTimePerQuestion] = useState(30); // Time per question in seconds
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [studentCountReached, setStudentCountReached] = useState(false);
  const [launchingQuiz, setLaunchingQuiz] = useState(false);
  const [webCode, setWebCode] = useState(null);


  // Fetch quiz details
  useEffect(() => {
    const fetchQuizDetails = async () => {
      if (!quizId) {
        setError("Quiz ID is missing");
        setLoading(false);
        return;
      }

      try {
        const quiz = await databases.getDocument(
          DATABASE_ID,
          QUIZ_INFO_COLLECTION_ID,
          quizId
        );
        setQuizDetails(quiz);
      } catch (err) {
        console.error("Failed to fetch quiz details:", err);
        setError("Failed to load quiz details");
        showToast("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };

    fetchQuizDetails();
  }, [quizId]);

  // Generate QR code image when qrValue changes
 useEffect(() => {
  const generateQRCodeImage = async () => {
    if (!qrCodeRef.current || !qrValue) return;

    try {
      const dataURL = await new Promise((resolve) => {
        qrCodeRef.current.toDataURL((data) => resolve(data));
      });

      const fileUri = FileSystem.cacheDirectory + "quiz-qr-code.png";

      // Fix: Use string literal instead of FileSystem.EncodingType.Base64
      await FileSystem.writeAsStringAsync(fileUri, dataURL, {
        encoding: 'base64', // Changed from FileSystem.EncodingType.Base64
      });

      setQrImageUri(fileUri);
    } catch (error) {
      console.error("Error generating QR code image:", error);
      // Don't break the flow, just log the error
    }
  };

  if (qrModalVisible && qrValue) {
    generateQRCodeImage();
  }
}, [qrValue, qrModalVisible]);


  // Effect to listen for participant updates
  useEffect(() => {
    if (qrModalVisible && currentQuizSessionId) { 
      const unsubscribe = client.subscribe(`databases.${DATABASE_ID}.collections.${QUIZ_PARTICIPANTS_COLLECTION_ID}.documents`, response => {
        if (response.payload.session_id === currentQuizSessionId &&
            (response.events.includes(`databases.*.collections.${QUIZ_PARTICIPANTS_COLLECTION_ID}.documents.*.create`) ||
             response.events.includes(`databases.*.collections.${QUIZ_PARTICIPANTS_COLLECTION_ID}.documents.*.update`))) {
          fetchParticipants(currentQuizSessionId);
        }
      });

      fetchParticipants(currentQuizSessionId); // Initial fetch

      return () => {
        unsubscribe();
      };
    }
  }, [qrModalVisible, currentQuizSessionId, professorLocation]); 

  const fetchProfessorLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access location was denied. Location tracking will be disabled.');
      setTrackLocation(false);
      return null;
    }

    let location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  };

  const validateQuizParts = () => {
    const totalQuestions = quizDetails?.['quiz-nb-question'];
    if (!totalQuestions) {
        showToast("Could not determine total number of questions.");
        return false;
    }

    for (const part of quizParts) {
        if (!part.questions.trim()) {
            showToast(`Questions for '${part.name}' cannot be empty.`);
            return false;
        }
        const questionEntries = part.questions.split(',');
        for (const entry of questionEntries) {
            const trimmedEntry = entry.trim();
            if (!trimmedEntry) continue; 

            if (trimmedEntry.includes('-')) {
                const rangeParts = trimmedEntry.split('-');
                if (rangeParts.length !== 2 || rangeParts.some(p => p.trim() === '')) {
                     showToast(`Invalid range format in '${part.name}': ${trimmedEntry}`);
                     return false;
                }
                const [start, end] = rangeParts.map(n => parseInt(n.trim()));
                if (isNaN(start) || isNaN(end) || start <= 0 || end > totalQuestions || start > end) {
                    showToast(`Invalid question range in '${part.name}'. Questions must be between 1 and ${totalQuestions}.`);
                    return false;
                }
            } else {
                const num = parseInt(trimmedEntry);
                if (isNaN(num) || num <= 0 || num > totalQuestions) {
                    showToast(`Invalid question number in '${part.name}'. Questions must be between 1 and ${totalQuestions}.`);
                    return false;
                }
            }
        }
    }
    return true; 
  };
  
  // ⭐ New function to manually grant access
  // ⭐ Function to manually grant access
const handleGrantAccess = async (participantId) => {
  try {
    await databases.updateDocument(
      DATABASE_ID,
      QUIZ_PARTICIPANTS_COLLECTION_ID,
      participantId,
      { 
        access_status: 'waiting_for_launch',
        access_reason: 'Manual override by professor',
        manually_granted: true,
        manually_denied: false
      }
    );
    showToast("Access granted manually.");
  } catch (err) {
    console.error("Failed to grant manual access:", err);
    showToast("Failed to update access status.");
  }
};

// ⭐ Function to manually deny access
const handleDenyAccess = async (participantId) => {
  try {
    await databases.updateDocument(
      DATABASE_ID,
      QUIZ_PARTICIPANTS_COLLECTION_ID,
      participantId,
      { 
        access_status: 'denied',
        access_reason: 'Manual denial by professor',
        manually_granted: false,
        manually_denied: true
      }
    );
    showToast("Access denied manually.");
  } catch (err) {
    console.error("Failed to deny manual access:", err);
    showToast("Failed to update access status.");
  }
};



  const handleBeginQuiz = async () => {
    if (!quizId) {
      showToast("Quiz ID is missing");
      return;
    }

    if (!continuousMode) {
        if (!validateQuizParts()) {
            return;
        }
    }

    setSaving(true);
    let profLoc = null;

    if (trackLocation) {
      profLoc = await fetchProfessorLocation();
      if (!profLoc) {
        setSaving(false);
        return;
      }
      setProfessorLocation(profLoc); 
    }

    try {
      // Prepare the configuration payload
      const configPayload = {
        trackLocation,
        locationRange: trackLocation ? locationRange : null,
        professorLocation: trackLocation ? profLoc : null,
        continuousMode,
        quizParts: !continuousMode ? quizParts : null,
        timePerQuestion,
        shuffleQuestions,
        registerAsSupport,
        allowSelfTesting,
        is_started: false, 
      };

      let sessionToUseId = null;
      let existingSession = null;

      // Check for an existing active session for this quiz
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          ACTIVE_QUIZZES_COLLECTION_ID,
          [
            Query.equal("quiz_id", quizId),
            Query.equal("is_active", true),
            Query.equal("is_started", false),
            Query.isNull("is_completed"), // Assuming 'is_completed' is null for ongoing sessions
            Query.limit(1) // We only need one existing session
          ]
        );

        if (response.documents.length > 0) {
          existingSession = response.documents[0];
          sessionToUseId = existingSession.$id;
          // Update the existing session with new config
          await databases.updateDocument(
            DATABASE_ID,
            ACTIVE_QUIZZES_COLLECTION_ID,
            sessionToUseId,
            {
              config: JSON.stringify(configPayload)
            }
          );
          setWebCode(existingSession.web_code || null);
          showToast("Existing quiz session updated successfully!");
        }
      } catch (err) {
        console.warn("Error checking for existing quiz session:", err);
        // Continue to create a new session if checking fails
      }

      if (!sessionToUseId) {
        // No existing session found or an error occurred, create a new one
        sessionToUseId = ID.unique();
        const newWebCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setWebCode(newWebCode);
        await databases.createDocument(
          DATABASE_ID,
          ACTIVE_QUIZZES_COLLECTION_ID,
          sessionToUseId,
          {
            quiz_id: quizId,
            session_id: sessionToUseId,
            is_active: true,
            is_started: false, 
            config: JSON.stringify(configPayload),
            is_completed: null, // Ensure this is explicitly set for new sessions
            web_code: newWebCode,
          }
        );
        showToast("New quiz session created successfully!");
      }

      setCurrentQuizSessionId(sessionToUseId);

      const qrData = JSON.stringify({
        quizId,
        sessionId: sessionToUseId,
        timestamp: Date.now(),
        config: configPayload // Use the latest config
      });
      setQrValue(qrData);

      // Update quiz info state regardless of new or existing session
      await databases.updateDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        quizId,
        { "quiz-state": "active" }
      );

      setQrModalVisible(true);

    } catch (err) {
      console.error("Failed to begin quiz:", err);
      showToast("Failed to start quiz session");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPart = () => {
    setQuizParts([...quizParts, { name: `Part ${quizParts.length + 1}`, questions: '' }]);
  };

  const handleRemovePart = (index) => {
    const newParts = quizParts.filter((_, i) => i !== index);
    setQuizParts(newParts);
  };

  const handlePartChange = (index, field, value) => {
    const newParts = [...quizParts];
    if (field === 'questions') {
      const sanitizedValue = value.replace(/[^0-9,-]/g, '');
      newParts[index][field] = sanitizedValue;
    } else {
      newParts[index][field] = value;
    }
    setQuizParts(newParts);
  };

  const handleShareQR = async () => {
    try {
      if (!qrImageUri) {
        showToast("QR code not ready");
        return;
      }
      await Sharing.shareAsync(qrImageUri, { dialogTitle: "Share Quiz QR Code", mimeType: "image/png", });
    } catch (err) {
      console.error("Failed to share QR code:", err);
      showToast("Failed to share QR code");
    }
  };

  const [isWebCodeModalVisible, setWebCodeModalVisible] = useState(false);
  const handleShowWebCode = () => {
  if (!webCode) {
    showToast("Web code not available.");
    return;
  }
  setWebCodeModalVisible(true);
};

  const fetchParticipants = async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_PARTICIPANTS_COLLECTION_ID,
        [
          Query.equal("session_id", sessionId),
          Query.orderDesc("join_timestamp")
        ]
      );
      
      const participantsWithDetails = await Promise.all(
        response.documents.map(async (p) => {
          let studentDisplayName = p.student_name || p.student_id;
          let distance = p.distance ? parseFloat(p.distance) : null;
          let participantLocation = p.location; 

          if (typeof participantLocation === 'string') {
            try {
              participantLocation = JSON.parse(participantLocation);
            } catch (e) {
              console.error("Failed to parse participant location string:", e);
              participantLocation = null;
            }
          }
          
          if (!p.student_name && p.student_id) { 
            try {
              const studentResponse = await databases.listDocuments(
                DATABASE_ID,
                STUDENTS_COLLECTION_ID,
                [Query.equal("stcin", p.student_id)], 
                ['stname', 'stfamilyname']
              );
              if (studentResponse.documents.length > 0) {
                const studentDoc = studentResponse.documents[0]; 
                if (studentDoc.stname && studentDoc.stfamilyname) {
                  studentDisplayName = `${studentDoc.stname} ${studentDoc.stfamilyname}`;
                } else if (studentDoc.stname) {
                  studentDisplayName = studentDoc.stname;
                }
              }
            } catch (nameError) {
              console.warn(`Could not fetch name for stcin ${p.student_id}:`, nameError);
            }
          }

          if (distance === null && trackLocation && professorLocation && participantLocation?.latitude && participantLocation?.longitude) {
            distance = haversineDistance(professorLocation, participantLocation);
          }

          return {
            ...p,
            studentDisplayName,
            distance,
          };
        })
      );
      setParticipants(participantsWithDetails);
      setStudentCountReached(participantsWithDetails.length >= quizDetails?.["quiz-nb-participant"]);
    } catch (err) {
      console.error("Failed to fetch participants:", err);
      showToast("Failed to fetch participants");
    }
  };

  const handleLaunchQuiz = async () => {
    if (!currentQuizSessionId) {
      showToast("No active quiz session to launch.");
      return;
    }
    setLaunchingQuiz(true);
    try {
      await databases.updateDocument(
        DATABASE_ID,
        ACTIVE_QUIZZES_COLLECTION_ID,
        currentQuizSessionId,
        { is_started: true }
      );
      await databases.updateDocument(
        DATABASE_ID,
        QUIZ_INFO_COLLECTION_ID,
        quizId,
        { "quiz-state": "ongoing" }
      );
      showToast("Quiz launched successfully!");
      setLaunchingQuiz(false);
      const waitingList = await databases.listDocuments(
      DATABASE_ID,
      QUIZ_PARTICIPANTS_COLLECTION_ID,
      [Query.equal("session_id", currentQuizSessionId), Query.equal("access_status", "waiting_for_launch")]
    );

    // 3️⃣ Update each one to granted
    for (const participant of waitingList.documents) {
      await databases.updateDocument(
        DATABASE_ID,
        QUIZ_PARTICIPANTS_COLLECTION_ID,
        participant.$id,
        {
          access_status: "granted",
          access_reason: "Quiz launched by professor"
        }
      );
    }
      router.push({
        pathname: "/professorFiles/liveQuiz",
        params: {
          quizId: quizId,
          sessionId: currentQuizSessionId,
          continuousMode: continuousMode,
          quizParts: continuousMode ? null : JSON.stringify(quizParts),
          trackLocation: trackLocation,
          professorLocation: trackLocation ? JSON.stringify(professorLocation) : null,
          locationRange: trackLocation ? locationRange : null,
          timePerQuestion: timePerQuestion,
          shuffleQuestions: shuffleQuestions,
        }
      });
      setQrModalVisible(false); 
    } catch (err) {
      console.error("Failed to launch quiz:", err);
      showToast("Failed to launch quiz.");
      setLaunchingQuiz(false);
    }
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
        <SmartText style={styles.loadingTextn}>Loading Quiz Details...</SmartText>
      </View>
    </LinearGradient>
  </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <SmartText style={styles.errorText}>{error}</SmartText>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SmartText style={styles.backButtonText}>Go Back</SmartText>
        </TouchableOpacity>
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
        style={styles.backButtonr}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.textSection}>
        <SmartText style={styles.headerTitle}>Quiz Session</SmartText>
        <SmartText style={styles.headerSubtitle}>Configure and start your quiz session</SmartText>
      </View>
    </View>

    <View style={styles.rightSection}>
      <View style={styles.lottieContainer}>
        <LottieView
          source={require('../../animations/edited-settings.json')}
          autoPlay
          loop
          style={styles.lottieAnimation}
        />
      </View>
    </View>
  </View>
</LinearGradient>

      
  <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
    {/* Enhanced Quiz Session Settings */}
    <View style={styles.enhancedSettingSection}>
      <View style={styles.settingSectionHeader}>
        <View style={styles.settingIconContainer}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#4f46e5" />
        </View>
        <SmartText style={styles.enhancedSettingHeader}>Quiz Session Settings</SmartText>
      </View>

      {/* Location Tracking */}
      <View style={styles.enhancedSettingItem}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Track Location</SmartText>
            <SmartText style={styles.settingDescription}>Monitor student locations during quiz</SmartText>
          </View>
        </View>
        <Switch
          onValueChange={setTrackLocation}
          value={trackLocation}
          trackColor={{ false: "#ddd", true: "#a29bfe" }}
          thumbColor={trackLocation ? "#4f46e5" : "#f4f3f4"}
        />
      </View>

      {trackLocation && (
        <View style={styles.enhancedLocationRangeContainer}>
          <SmartText style={styles.locationRangeTitle}>
            <MaterialCommunityIcons name="radar" size={16} color="#4f46e5" /> Location Range
          </SmartText>
          <View style={styles.enhancedLocationRangeOptions}>
            {locationRanges.map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.enhancedLocationRangeButton,
                  locationRange === range && styles.enhancedLocationRangeButtonActive
                ]}
                onPress={() => setLocationRange(range)}
              >
                <SmartText style={[
                  styles.enhancedLocationRangeButtonText,
                  locationRange === range && styles.enhancedLocationRangeButtonTextActive
                ]}>{range}m</SmartText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Continuous Mode */}
      <View style={styles.enhancedSettingItem}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="progress-clock" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Continuous Mode</SmartText>
            <SmartText style={styles.settingDescription}>Present all questions in sequence</SmartText>
          </View>
        </View>
        <Switch
          onValueChange={setContinuousMode}
          value={continuousMode}
          trackColor={{ false: "#ddd", true: "#a29bfe" }}
          thumbColor={continuousMode ? "#4f46e5" : "#f4f3f4"}
        />
      </View>

      {!continuousMode && (
        <View style={styles.enhancedQuizPartsContainer}>
          <SmartText style={styles.quizPartsTitle}>
            <MaterialCommunityIcons name="view-module" size={16} color="#4f46e5" /> Define Quiz Parts
          </SmartText>
          {quizParts.map((part, index) => (
            <View key={index} style={styles.enhancedQuizPartInputRow}>
              <TextInput
                style={styles.enhancedQuizPartNameInput}
                value={part.name}
                onChangeText={(text) => handlePartChange(index, 'name', text)}
                placeholder={`Part ${index + 1} Name`}
              />
              <TextInput
                style={styles.enhancedQuizPartQuestionsInput}
                value={part.questions}
                onChangeText={(text) => handlePartChange(index, 'questions', text)}
                placeholder="1-5, 8, 10-12"
                keyboardType="numbers-and-punctuation"
              />
              {quizParts.length > 1 && (
                <TouchableOpacity onPress={() => handleRemovePart(index)} style={styles.enhancedRemovePartButton}>
                  <MaterialCommunityIcons name="minus-circle" size={20} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={handleAddPart} style={styles.enhancedAddPartButton}>
            <MaterialCommunityIcons name="plus-circle" size={20} color="#00b894" />
            <SmartText style={styles.enhancedAddPartButtonText}>Add Part</SmartText>
          </TouchableOpacity>
        </View>
      )}

      {/* Time per Question */}
      <View style={styles.enhancedSettingItem}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="timer-outline" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Time per Question</SmartText>
            <SmartText style={styles.settingDescription}>Seconds allowed per question</SmartText>
          </View>
        </View>
        <TextInput
          style={styles.enhancedTimeInput}
          keyboardType="numeric"
          value={String(timePerQuestion)}
          onChangeText={(text) => {
            const parsedValue = Number(text);
            if (isNaN(parsedValue) || text.trim() === '') {
              setTimePerQuestion(text.trim() === '' ? 0 : parsedValue);
            } else if (parsedValue > 120) {
              setTimePerQuestion(30);
            } else {
              setTimePerQuestion(parsedValue);
            }
          }}
        />
      </View>

      {/* Shuffle Questions */}
      <View style={styles.enhancedSettingItem}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="shuffle" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Shuffle Questions</SmartText>
            <SmartText style={styles.settingDescription}>Randomize question order</SmartText>
          </View>
        </View>
        <Switch
          onValueChange={setShuffleQuestions}
          value={shuffleQuestions}
          trackColor={{ false: "#ddd", true: "#a29bfe" }}
          thumbColor={shuffleQuestions ? "#4f46e5" : "#f4f3f4"}
        />
      </View>

      {/* Register as Support */}
      <View style={styles.enhancedSettingItem}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="history" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Register as Support</SmartText>
            <SmartText style={styles.settingDescription}>Enable support mode features</SmartText>
          </View>
        </View>
        <Switch
          onValueChange={setRegisterAsSupport}
          value={registerAsSupport}
          trackColor={{ false: "#ddd", true: "#a29bfe" }}
          thumbColor={registerAsSupport ? "#4f46e5" : "#f4f3f4"}
        />
      </View>

      {/* Allow Self-Testing */}
      <View style={[styles.enhancedSettingItem, { borderBottomWidth: 0 }]}>
        <View style={styles.settingItemLeft}>
          <View style={styles.settingIconBg}>
            <MaterialCommunityIcons name="auto-fix" size={20} color="#4f46e5" />
          </View>
          <View style={styles.settingTextContainer}>
            <SmartText style={styles.enhancedSettingLabel}>Allow Self-Testing</SmartText>
            <SmartText style={styles.settingDescription}>Students can test themselves</SmartText>
          </View>
        </View>
        <Switch
          onValueChange={setAllowSelfTesting}
          value={allowSelfTesting}
          trackColor={{ false: "#ddd", true: "#a29bfe" }}
          thumbColor={allowSelfTesting ? "#4f46e5" : "#f4f3f4"}
        />
      </View>
    </View>
  </ScrollView>

  {/* Fixed Bottom Button */}
  <View style={styles.fixedBottomSection}>
    <TouchableOpacity
      style={styles.enhancedBeginQuizButton}
      onPress={handleBeginQuiz}
      disabled={saving}
    >
      {saving ? (
        <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
      ) : (
        <MaterialCommunityIcons name="play-circle" size={20} color="#fff" style={{ marginRight: 10 }} />
      )}
      <SmartText style={styles.enhancedBeginQuizButtonText}>
        {saving ? 'Starting Session...' : 'Begin Quiz Session'}
      </SmartText>
    </TouchableOpacity>
  </View>
</LinearGradient>

      <Modal
        animationType="slide"
        transparent={true}
        visible={qrModalVisible}
        onRequestClose={() => setQrModalVisible(!qrModalVisible)}
      >
        <View style={styles.qrModalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}>
            <View style={styles.qrModalContent}>
              <SmartText style={styles.qrModalTitle}>Scan to Join Quiz</SmartText>
              <View style={styles.qrCodeContainer}>
                {qrValue ? (
                  <QRCode
                    value={qrValue}
                    size={200}
                    color="black"
                    backgroundColor="white"
                    getRef={qrCodeRef}
                  />
                ) : (
                  <ActivityIndicator size="large" color="#4f46e5" />
                )}
              </View>
              <SmartText style={styles.qrModalSubtitle}>Session ID: {currentQuizSessionId}</SmartText>

             <View style={styles.qrBbuttonRowContainer}>
  <View style={styles.qrButtonRow}>
    <TouchableOpacity style={[styles.qrButton, styles.shareButton]} onPress={handleShareQR}>
      <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
      <SmartText style={styles.qrButtonText}>Share QR</SmartText>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.qrButton, styles.shareWebButton]} onPress={handleShowWebCode}>
      <MaterialCommunityIcons name="form-textbox-password" size={20} color="#000" />
      <SmartText style={[styles.qrButtonText, { color: '#000' }]}>Short Code</SmartText>
    </TouchableOpacity>
  </View>
</View>

             <TouchableOpacity
  style={[styles.launchQuizButton, launchingQuiz && styles.disabledLaunchButton]}
  onPress={handleLaunchQuiz}
  disabled={launchingQuiz}
  activeOpacity={0.8}
>
  <LinearGradient
    colors={['#4f46e5', '#a29bfe', '#74b9ff']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.gradientButton}
  >
    {launchingQuiz ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <SmartText style={styles.launchQuizButtonText}>Launch Quiz</SmartText>
    )}
  </LinearGradient>
</TouchableOpacity>

              <ScrollView style={styles.participantsSectionScroll}>
              <View style={styles.participantsSection}>
                <SmartText style={styles.participantsTitle}>
                  Participants ({participants.length}/{quizDetails?.['quiz-nb-participant']})
                </SmartText>
                {participants.length === 0 ? (
                  <SmartText style={styles.noParticipantsText}>Waiting for students to join...</SmartText>
                ) : (
                  <View style={styles.participantsList}>
                    {/* ⭐ UPDATED PARTICIPANT ITEM WITH GRANT ACCESS BUTTON ⭐ */}
                    {participants.map((p, index) => (
                      <View key={p.$id} style={styles.participantItem}>
                        <View style={styles.participantHeader}>
                          <SmartText style={styles.participantName} numberOfLines={1}>{index + 1}. {p.studentDisplayName}</SmartText>
                          <View style={[styles.participantStatus, { backgroundColor: getStatusColor(p.access_status) }]}>
                            <SmartText style={styles.participantStatusText}>
                              {p.access_status?.replace(/_/g, ' ')}
                            </SmartText>
                          </View>
                        </View>
                        <View style={styles.participantBody}>
                          {p.distance !== null ? (
                            <SmartText style={styles.participantDetail}>
                              <MaterialCommunityIcons name="map-marker-distance" size={14} color="#636e72" />
                              {` ${p.distance.toFixed(0)}m`}
                              {p.distance > locationRange && <SmartText style={{ color: '#e74c3c' }}> (Out of Range)</SmartText>}
                            </SmartText>
                          ) : (
                            <SmartText style={styles.participantDetail}>
                              <MaterialCommunityIcons name="map-marker-off" size={14} color="#aaa" />
                              {' No location'}
                            </SmartText>
                          )}
                          <SmartText style={styles.participantDetail}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color="#636e72" />
                            {` ${new Date(p.join_timestamp).toLocaleTimeString()}`}
                          </SmartText>
                        </View>
                        {p.access_status === 'denied' && (
  <View style={styles.grantAccessContainer}>
    <TouchableOpacity
      style={styles.grantAccessButton}
      onPress={() => handleGrantAccess(p.$id)}
    >
      <SmartText style={styles.grantAccessButtonText}>Grant Access</SmartText>
    </TouchableOpacity>
  </View>
)}

{p.access_status === 'waiting_for_launch' && (
  <View style={styles.grantAccessContainer}>
    <TouchableOpacity
      style={styles.denyAccessButton}
      onPress={() => handleDenyAccess(p.$id)}
    >
      <SmartText style={styles.denyAccessButtonText}>Deny Access</SmartText>
    </TouchableOpacity>
  </View>
)}
                      </View>
                    ))}
                  </View>
                )}
                {studentCountReached && (
                  <SmartText style={styles.studentCountWarning}>
                    Maximum participant count reached!
                  </SmartText>
                )}
              </View>
              </ScrollView> 

              <TouchableOpacity style={styles.closeButton} onPress={() => setQrModalVisible(false)}>
                <SmartText style={styles.closeButtonText}>Close</SmartText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
  animationType="slide"
  transparent={true}
  visible={isWebCodeModalVisible}
  onRequestClose={() => setWebCodeModalVisible(false)}
>
  <View style={styles.centeredView}>
    <View style={styles.modalView}>
      <SmartText style={styles.modalTitle}>Short Code</SmartText>
      <SmartText style={styles.modalMessage}>
        Students can join the quiz by entering the short code. Also Professor can show the Qr code on web by visiting the website below and entering the short code.
      </SmartText>
      <SmartText style={styles.modalMessage}>Website:</SmartText>
      <Pressable
        onPress={() => Linking.openURL('https://code-for-qr-code.appwrite.network')}
      >
        <SmartText style={styles.modalLink}>
          https://code-for-qr-code.appwrite.network
        </SmartText>
      </Pressable>
      <SmartText style={styles.modalMessage}>Access Code:</SmartText>
      <SmartText style={styles.modalCode}>{webCode}</SmartText>

      <Pressable
        style={styles.modalCloseButton}
        onPress={() => setWebCodeModalVisible(false)}
      >
        <SmartText style={styles.modalCloseText}>Close</SmartText>
      </Pressable>
    </View>
  </View>
</Modal>

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
  backButtonr: {
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
  loadingTextn: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 20,
  },container: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 15,
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#d63031',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#4f46e5',
    padding: 15,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    color: '#d63031',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingSection: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  settingHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4f46e5",
    marginBottom: 15,
    textAlign: "center",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 10,
  },
  locationRangeContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationRangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  locationRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a29bfe',
    margin: 5,
    backgroundColor: '#fff',
  },
  locationRangeButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  locationRangeButtonText: {
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  locationRangeButtonTextActive: {
    color: '#fff',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
  },
  quizPartsContainer: {
    marginTop: 5,
    paddingTop: 5,
    borderTopColor: '#eee',
  },
  settingSubHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 10,
  },
  quizPartInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  quizPartNameInput: {
    flex: 0.4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    fontSize: 14,
  },
  quizPartQuestionsInput: {
    flex: 0.6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  removePartButton: {
    marginLeft: 10,
    padding: 5,
  },
  addPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf7e6',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#00b894',
  },
  addPartButtonText: {
    color: '#00b894',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  beginQuizButton: {
    backgroundColor: '#4f46e5',
    padding: 18,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  beginQuizButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  qrModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 15,
  },
  qrCodeContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  qrModalSubtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrBbuttonRowContainer: {
  width: '97%',
  alignSelf: 'center', // Align with the launch button
  marginBottom: 15, // Move the margin to the container
},
qrButtonRow: {
  flexDirection: 'row',
  justifyContent: 'space-between', // Distribute space evenly
  width: '100%',
  // Remove gap here
},
qrButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 10,
  width: '48%', // Set a specific width for each button
  minHeight: 50,
},
  qrButtonText: {
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#fff',
  },
  shareButton: {
    backgroundColor: '#a29bfe', 
  },
  shareWebButton: {
    backgroundColor: '#74b9ff', 
  },
 launchQuizButton: {
  borderRadius: 12,
  overflow: 'hidden',
  width: '97%',        // 🔥 Match QR row width // Align with center just like QR row
  justifyContent: 'center',
  minHeight: 50,
},
 disabledLaunchButton: {
  opacity: 0.6,
},
gradientButton: {
  paddingVertical: 14,
  paddingHorizontal: 28,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  width:'100%',
},
launchQuizButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
  closeButton: {
    marginTop: 20,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#4f46e5',
    fontWeight: 'bold',
    fontSize: 16,
  },
  participantsSection: {
    width: '100%',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  participantsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3436',
    textAlign: 'center',
    marginBottom: 15,
  },
  participantsList: {
    width: '100%',
    maxHeight: 350, 
  },
  participantItem: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  participantName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#343a40',
    flex: 1,
    marginRight: 8,
  },
  participantStatus: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden'
  },
  participantStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
    color: '#fff',
  },
  participantBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  participantDetail: {
    fontSize: 13,
    color: '#6c757d',
    display: 'flex',
    alignItems: 'center',
  },
  noParticipantsText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  studentCountWarning: {
    marginTop: 15,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#d35400',
    textAlign: 'center',
  },
  // ⭐ NEW STYLES FOR GRANT ACCESS BUTTON ⭐
  grantAccessContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    alignItems: 'center',
  },
  grantAccessButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  grantAccessButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  participantsSectionScroll: {
    width: '100%',
    marginTop: 10,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#34495e',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
    textAlign: 'center',
  },
  modalLink: {
    fontSize: 16,
    color: '#007bff',
    textDecorationLine: 'underline',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalCode: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#d35400',
    marginTop: 5,
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    marginTop: 15,
  },
  modalCloseText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 120, // Space for fixed bottom section
  }, enhancedSettingSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginTop: 0,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    overflow: 'hidden',
  },

  settingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#f8f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4ff',
  },

  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8e4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  enhancedSettingHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4f46e5",
  },

  enhancedSettingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },

  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 15,
  },

  settingIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  settingTextContainer: {
    flex: 1,
  },

  enhancedSettingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2d3436",
    marginBottom: 2,
  },

  settingDescription: {
    fontSize: 13,
    color: "#636e72",
    lineHeight: 18,
  },

  // Enhanced location range container
  enhancedLocationRangeContainer: {
    backgroundColor: '#f8f9ff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8e4ff',
  },

  locationRangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
    marginBottom: 15,
    textAlign: 'center',
  },

  enhancedLocationRangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },

  enhancedLocationRangeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e8e4ff',
    backgroundColor: '#fff',
    minWidth: 60,
    alignItems: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  enhancedLocationRangeButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
    transform: [{ scale: 1.05 }],
  },

  enhancedLocationRangeButtonText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },

  enhancedLocationRangeButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Enhanced time input
  enhancedTimeInput: {
    borderWidth: 2,
    borderColor: '#e8e4ff',
    borderRadius: 12,
    padding: 12,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3436',
    backgroundColor: '#fff',
  },

  // Enhanced quiz parts container
  enhancedQuizPartsContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 20,
    backgroundColor: '#f8f9ff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e8e4ff',
  },

  quizPartsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
    marginBottom: 15,
    textAlign: 'center',
  },

  enhancedQuizPartInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  enhancedQuizPartNameInput: {
    flex: 0.4,
    borderWidth: 1,
    borderColor: '#e8e4ff',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },

  enhancedQuizPartQuestionsInput: {
    flex: 0.6,
    borderWidth: 1,
    borderColor: '#e8e4ff',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },

  enhancedRemovePartButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffe6e6',
  },

  enhancedAddPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6fff0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#00b894',
    shadowColor: "#00b894",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  enhancedAddPartButtonText: {
    color: '#00b894',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },

  // Fixed bottom section
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

  enhancedBeginQuizButton: {
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

  enhancedBeginQuizButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  denyAccessButton: {
  backgroundColor: '#e74c3c',
  paddingVertical: 8,
  paddingHorizontal: 15,
  borderRadius: 6,
},
denyAccessButtonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 13,
},

});