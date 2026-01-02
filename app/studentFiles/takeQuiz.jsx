// studentFiles/takeQuiz.jsx
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, ID, Query } from "react-native-appwrite";
import { showToast } from "../../lib/toasthelper"

import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { account } from "../../lib/appwrite";
import LottieView from 'lottie-react-native';
import SmartText from "../../components/SmartText";

// Appwrite setup
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("");

const databases = new Databases(client);

const DATABASE_ID = "685ae2ba0012dcb2feda";
const QUIZ_PARTICIPANTS_COLLECTION_ID = "687ec780001053a5ec08";
const ACTIVE_QUIZZES_COLLECTION_ID = "68764f2a001a9f312390";
const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254";
const CLASSROOM_LOCATION_THRESHOLD_DEFAULT = 100;

const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => x * Math.PI / 180;
  const R = 6371e3;
  const lat1 = toRad(coords1.latitude);
  const lon1 = toRad(coords1.longitude);
  const lat2 = toRad(coords2.latitude);
  const lon2 = toRad(coords2.longitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function TakeQuiz() {
  const router = useRouter();
  const { quizData } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quizDetails, setQuizDetails] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [quizSessionConfig, setQuizSessionConfig] = useState(null);
  const [currentStudentLocation, setCurrentStudentLocation] = useState(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
  const [currentStudentId, setCurrentStudentId] = useState(null);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [manuallyGrantedAccess, setManuallyGrantedAccess] = useState(false);

  useEffect(() => {
    const fetchStudentInfo = async () => {
      try {
        const user = await account.get();
        const response = await databases.listDocuments(
          DATABASE_ID,
          STUDENTS_COLLECTION_ID,
          [Query.equal("stmail", user.email)]
        );
        if (response.total > 0) {
          const studentDoc = response.documents[0];
          setCurrentStudentId(studentDoc.stcin);
        } else {
          setError("Student profile not found.");
        }
      } catch {
        setError("Please log in to join the quiz.");
      }
    };
    fetchStudentInfo();
  }, []);

  useEffect(() => {
    const parseAndFetchConfig = async () => {
      if (!quizData) {
        setError("Quiz data is missing.");
        setLoading(false);
        return;
      }
      let parsedQrData;
      try {
        parsedQrData = JSON.parse(quizData);
      } catch {
        setError("Invalid QR code data format.");
        setLoading(false);
        return;
      }

      const { quizId, sessionId, config } = parsedQrData;
      if (!quizId || !sessionId || !config) {
        setError("Incomplete quiz data from QR code.");
        setLoading(false);
        return;
      }

      setQuizDetails({ id: quizId, sessionId });

      try {
        const activeQuizSession = await databases.getDocument(DATABASE_ID, ACTIVE_QUIZZES_COLLECTION_ID, sessionId);
        setQuizSessionConfig({ ...config, ...JSON.parse(activeQuizSession.config), is_started: activeQuizSession.is_started });
      } catch {
        setError("Failed to load quiz session details.");
        setLoading(false);
      }
    };
    parseAndFetchConfig();
  }, [quizData]);

  useEffect(() => {
    const getLocation = async () => {
      if (!quizSessionConfig?.trackLocation) {
        setLocationPermissionStatus('not_required');
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionStatus('denied');
        Alert.alert("Location Permission Denied", "Please allow location access.");
        return;
      }

      setLocationPermissionStatus('granted');
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentStudentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      } catch {
        setLocationPermissionStatus('error_fetching');
        Alert.alert("Location Error", "Unable to retrieve your location.");
      }
    };

    if (quizSessionConfig) getLocation();
  }, [quizSessionConfig]);

  useEffect(() => {
    if (
      quizSessionConfig &&
      locationPermissionStatus !== null &&
      currentStudentId &&
      !hasAttemptedJoin &&
      (!quizSessionConfig.trackLocation || currentStudentLocation !== null)
    ) {
      processQuizJoin();
    }
  }, [quizSessionConfig, locationPermissionStatus, currentStudentId, currentStudentLocation, hasAttemptedJoin]);

  useEffect(() => {
    let interval;
    if (accessStatus === 'waiting_for_launch' && quizDetails?.sessionId) {
      interval = setInterval(async () => {
        try {
          const sessionDoc = await databases.getDocument(DATABASE_ID, ACTIVE_QUIZZES_COLLECTION_ID, quizDetails.sessionId);
          if (sessionDoc.is_started) {
            clearInterval(interval);
            router.replace({
              pathname: "/studentFiles/quizQuestionScreen",
              params: {
                quizId: quizDetails.id,
                sessionId: quizDetails.sessionId,
                studentId: currentStudentId
              }
            });
          }
        } catch (err) {
          console.warn("Error checking quiz start status:", err.message);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [accessStatus, quizDetails, currentStudentId]);

  useEffect(() => {
    let refreshInterval;

    if (
      (accessStatus === 'denied' || accessStatus === 'waiting_for_launch') &&
      quizSessionConfig?.trackLocation &&
      currentStudentId &&
      quizDetails?.sessionId
    ) {
      console.log("🔄 Starting auto-refresh of access status...");

      refreshInterval = setInterval(async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();

          if (status !== 'granted') {
            console.warn("⛔ Location permission still denied");
            return;
          }

          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const newLoc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };

          console.log("📍 Auto-refreshed location:", newLoc);

         if (!manuallyGrantedAccess) {
  setCurrentStudentLocation(newLoc);
  setHasAttemptedJoin(false);
} else {
  console.log("🛑 Skipping auto-refresh due to manual access.");
}

        } catch (err) {
          console.warn("⌚ Auto-refresh location fetch failed:", err.message);
        }
      }, 10000);
    }

    return () => clearInterval(refreshInterval);
  }, [accessStatus, quizSessionConfig, currentStudentId, quizDetails]);

  const processQuizJoin = async () => {
    setHasAttemptedJoin(true);
    setLoading(true);
    if (manuallyGrantedAccess) {
  console.log("🔓 Skipping re-verification due to manual access grant.");
  setAccessStatus('granted');
  setError(null);
  setLoading(false);
  return;
}

    if (!quizDetails || !quizDetails.id || !quizDetails.sessionId || !quizSessionConfig || !currentStudentId) {
      console.error("⌚ Invalid state in processQuizJoin:", {
        quizDetails,
        quizSessionConfig,
        currentStudentId,
      });
      setError("Invalid quiz session data. Please scan the QR code again.");
      setLoading(false);
      return;
    }

    let newAccessStatus = 'denied';
    let newAccessReason = '';
    let distance = null;

    const { trackLocation, professorLocation, locationRange, is_started } = quizSessionConfig;

    if (trackLocation) {
      if (locationPermissionStatus !== 'granted') {
        newAccessReason = "Location access denied.";
      } else if (!professorLocation || !currentStudentLocation) {
        newAccessReason = "Professor's or student's location not available.";
      } else {
        try {
          const profCoords = typeof professorLocation === 'string'
            ? JSON.parse(professorLocation)
            : professorLocation;

          distance = haversineDistance(currentStudentLocation, profCoords);
          const threshold = locationRange || CLASSROOM_LOCATION_THRESHOLD_DEFAULT;

          if (distance <= threshold) {
            newAccessStatus = is_started ? 'granted' : 'waiting_for_launch';
            newAccessReason = is_started ? 'In range, quiz started.' : 'In range, waiting for start.';
          } else {
            newAccessReason = `Too far from quiz location (${distance.toFixed(0)}m).`;
          }
        } catch (err) {
          console.error("⌚ Error calculating distance:", err);
          newAccessReason = "Error calculating distance.";
        }
      }
    } else {
      newAccessStatus = is_started ? 'granted' : 'waiting_for_launch';
      newAccessReason = is_started ? 'Quiz started.' : 'Waiting for launch.';
    }

    setAccessStatus(newAccessStatus);
    setError(newAccessStatus === 'denied' ? newAccessReason : null);

    try {
      const existing = await databases.listDocuments(
        DATABASE_ID,
        QUIZ_PARTICIPANTS_COLLECTION_ID,
        [Query.equal("session_id", quizDetails.sessionId), Query.equal("student_id", currentStudentId)]
      );
      if (existing.total > 0 && existing.documents[0].manually_denied === true) {
  console.log("🚫 Access permanently denied by professor.");
  setAccessStatus('denied');
  setError("Access has been denied by the professor.");
  setLoading(false);
  return;
}

     if (existing.total > 0 && existing.documents[0].manually_granted === true) {
  const isStarted = quizSessionConfig?.is_started;
  setManuallyGrantedAccess(true);

  if (isStarted) {
    setAccessStatus('granted');
    setError(null);
    router.replace({
      pathname: "/studentFiles/quizQuestionScreen",
      params: {
        quizId: quizDetails.id,
        sessionId: quizDetails.sessionId,
        studentId: currentStudentId
      }
    });
  } else {
    setAccessStatus('waiting_for_launch');
    setError(null);
  }

  setLoading(false);
  return;
}

      const participantData = {
        access_status: newAccessStatus,
        access_reason: newAccessReason,
        join_timestamp: new Date().toISOString(),
        student_location: currentStudentLocation ? JSON.stringify(currentStudentLocation) : null,
        distance: distance !== null ? distance.toFixed(0) : null,
      };

      if (existing.total > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          QUIZ_PARTICIPANTS_COLLECTION_ID,
          existing.documents[0].$id,
          participantData
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          QUIZ_PARTICIPANTS_COLLECTION_ID,
          ID.unique(),
          {
            quiz_id: quizDetails.id,
            session_id: quizDetails.sessionId,
            student_id: currentStudentId,
            ...participantData
          }
        );
      }

      if (newAccessStatus === '') {
        router.replace({
          pathname: "/studentFiles/quizQuestionScreen",
          params: {
            quizId: quizDetails.id,
            sessionId: quizDetails.sessionId,
            studentId: currentStudentId
          }
        });
      }

    } catch (err) {
      console.error("⌚ Failed to save participant:", err);
      setError("Failed to join quiz.");
    } finally {
      setLoading(false);
    }
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
            <SmartText style={styles.loadingText}>Joining Quiz...</SmartText>
            <SmartText style={styles.loadingSubText}>Please wait while we verify your access</SmartText>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient colors={["#f5f5f5", "#e0e0e0"]} style={{ flex: 1 }}>
        
        {/* Enhanced Header */}
        <LinearGradient colors={["#6c5ce7", "#a29bfe"]} style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View style={styles.leftSection}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.replace('/studentFiles/studentQuizs')}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.textSection}>
                <SmartText style={styles.headerTitle}>Join Quiz</SmartText>
                <SmartText style={styles.headerSubtitle}>Verifying your access...</SmartText>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.lottieContainer}>
                <LottieView
                  source={require('../../animations/check.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.container}>
          {error ? (
            <View style={styles.statusCard}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={80} color="#d63031" />
              </View>
              <SmartText style={styles.statusTitle}>Access Denied</SmartText>
              <SmartText style={styles.statusMessage}>{error}</SmartText>
              
              <TouchableOpacity
                style={styles.retryButton}
                onPress={async () => {
                  setLoading(true);
                  setError(null);
                  setHasAttemptedJoin(false);
                  setAccessStatus(null);

                  try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                      setLocationPermissionStatus('denied');
                      Alert.alert("Location Permission Denied", "Please allow location access.");
                      setLoading(false);
                      return;
                    }

                    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                    const newLoc = {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude
                    };

                    setLocationPermissionStatus('granted');
                    setCurrentStudentLocation(newLoc);

                  } catch (err) {
                    console.error("⌚ Failed to re-fetch location:", err);
                    setLocationPermissionStatus('error_fetching');
                    setError("Unable to get location.");
                    setLoading(false);
                  }
                }}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
                <SmartText style={styles.retryButtonText}>Try Again</SmartText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/studentFiles/studentQuizs')}
              >
                <SmartText style={styles.secondaryButtonText}>Back to Quizzes</SmartText>
              </TouchableOpacity>
            </View>
          ) : accessStatus === 'waiting_for_launch' ? (
            <View style={styles.statusCard}>
              <View style={styles.iconContainer}>
                <LottieView
                  source={require('../../animations/loading_animation.json')}
                  autoPlay
                  loop
                  style={styles.waitingAnimation}
                />
              </View>
              <SmartText style={styles.statusTitle}>Waiting for Launch</SmartText>
              <SmartText style={styles.statusMessage}>
                You're successfully connected! The quiz will start automatically when your professor launches it.
              </SmartText>
              
              <View style={styles.waitingIndicator}>
                <View style={styles.pulseContainer}>
                  <View style={styles.pulse} />
                  <View style={[styles.pulse, styles.pulse2]} />
                  <View style={[styles.pulse, styles.pulse3]} />
                </View>
                <SmartText style={styles.waitingText}>Waiting for teacher...</SmartText>
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/studentFiles/studentQuizs')}
              >
                <SmartText style={styles.secondaryButtonText}>Leave and Return Later</SmartText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6c5ce7',
  },
  
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
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    marginTop: 20,
  },
  loadingSubText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    textAlign: 'center',
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
    width: 80,
    height: 80,
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: 350,
    width: '100%',
  },

  iconContainer: {
    marginBottom: 25,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 50,
  },

  waitingAnimation: {
    width: 120,
    height: 120,
  },

  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2d3436',
    marginBottom: 15,
    textAlign: 'center',
  },

  statusMessage: {
    fontSize: 16,
    color: '#636e72',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },

  waitingIndicator: {
    alignItems: 'center',
    marginBottom: 30,
  },

  pulseContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  pulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6c5ce7',
  },

  pulse2: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.6)',
  },

  pulse3: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
  },

  waitingText: {
    fontSize: 16,
    color: '#6c5ce7',
    fontWeight: '600',
  },

  retryButton: {
    backgroundColor: '#6c5ce7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },

  buttonIcon: {
    marginRight: 8,
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    width: '100%',
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
});