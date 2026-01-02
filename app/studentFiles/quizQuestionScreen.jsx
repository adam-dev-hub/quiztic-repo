import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  Modal,
  AppState,
  KeyboardAvoidingView,
  BackHandler, // Import BackHandler
  Alert, // Keep Alert for the back button handler
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  Layout,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Client, Databases, Query ,ID, Functions} from "react-native-appwrite";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import SmartText from "../../components/SmartText";




const { height } = Dimensions.get('window');

const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1") // Your Appwrite Endpoint
  .setProject(""); // Your Appwrite Project ID

const databases = new Databases(client);

// --- Your Appwrite Collection IDs ---
const DATABASE_ID = '685ae2ba0012dcb2feda';
const QUESTIONS_COLLECTION = '68764f2a001a9f312389';
const ACTIVE_QUIZ_COLLECTION = '68764f2a001a9f312390';
const SUBMISSIONS_COLLECTION = '687ec5cd0008660447d4';
const PROFILES_COLLECTION = '685aec0b0015ee8e5254';


// --- Context for Theme and Accessibility ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [textSize, setTextSize] = useState('medium');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log("Toggling theme to:", newTheme);
      return newTheme;
    });
  };
  
  const increaseTextSize = () => {
    setTextSize((prev) => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'large';
    });
  };

  const decreaseTextSize = () => {
    setTextSize((prev) => {
      if (prev === 'large') return 'medium';
      if (prev === 'medium') return 'small';
      return 'small';
    });
  };

  const getThemeColors = () => {
    return theme === 'light'
      ? {
          background: '#f0f2f5',
          cardBackground: '#fff',
          text: '#2c3e50',
          secondaryText: '#636e72',
          border: '#dfe6e9',
          primary: '#6c5ce7',
          gradientStart: '#6c5ce7',
          gradientEnd: '#a29bfe',
          correct: '#00b894',
          incorrect: '#d63031',
          selected: '#e9e7fd',
          streakBg: '#fffbe6',
          streakText: '#f39c12',
          coin: '#FFD700',
          avatarHappy: '#00b894',
          avatarNeutral: '#fdcb6e',
          avatarSad: '#d63031',
        }
      : {
          background: '#1a1a2e',
          cardBackground: '#2a0040',
          text: '#e0e0e0',
          secondaryText: '#b0b0b0',
          border: '#4a4a60',
          primary: '#8e44ad',
          gradientStart: '#2c3e50',
          gradientEnd: '#34495e',
          correct: '#2ecc71',
          incorrect: '#e74c3c',
          selected: '#4a2a60',
          streakBg: '#3a3a4e',
          streakText: '#ffeaa7',
          coin: '#FFD700',
          avatarHappy: '#2ecc71',
          avatarNeutral: '#f39c12',
          avatarSad: '#e74c3c',
        };
  };

  const getTextSizeMultiplier = () => {
    if (textSize === 'small') return 0.8;
    if (textSize === 'large') return 1.2;
    return 1.0;
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        textSize,
        increaseTextSize,
        decreaseTextSize,
        soundEnabled,
        getThemeColors,
        getTextSizeMultiplier,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// --- Helper Functions ---
const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3;
  if (!coords1 || !coords2) return Infinity;
  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.latitude)) * Math.cos(toRad(coords2.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
const screenWidth = Dimensions.get("window").width;

// --- Reusable Components ---

// CustomAlert Component
const CustomAlert = ({ visible, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel' }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const scaleValue = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scaleValue.value = withSpring(1, {
        speed: 10,
        bounciness: 8,
      });
    } else {
      scaleValue.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
    };
  });

  return (
    <Modal transparent={true} animationType="fade" visible={visible} onRequestClose={onCancel}>
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
          <View style={modalStyles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity
                style={[modalStyles.button, { backgroundColor: colors.border }]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <SmartText style={[modalStyles.buttonText, { color: colors.text }]}>{cancelText}</SmartText>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[modalStyles.button, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <SmartText style={[modalStyles.buttonText, { color: '#fff' }]}>{confirmText}</SmartText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// QuestionHeader Component
const QuestionHeader = ({
  currentQuestionIndex,
  totalQuestions,
  score,
  timer,
  timePerQuestion,
  streakCount,
  coins,
  config,
  onBuyPowerUp,
  onToggleSettings,
  onToggleHelp,
  helpExpanded
}) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const [settingsActive, setSettingsActive] = useState(false);

  const timerBarWidth = (timer / timePerQuestion) * 100;
  const progressValue = useSharedValue(timerBarWidth);

  useEffect(() => {
    progressValue.value = withTiming(timerBarWidth, {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [timerBarWidth]);

  const animatedTimerBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value}%`,
      backgroundColor: timer < 10 ? colors.incorrect : colors.correct,
    };
  });

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.headerGradient}
    >
      {/* --- Top Row: Lottie + Text on left | Buttons on right --- */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        {/* Left side: Character + Motivation */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <LottieView
            source={require("../../animations/star_burst.json")}
            autoPlay
            loop
            style={{ width: 90, height: 90, marginLeft: -25, marginRight: -20 }}
          />
          <SmartText
            style={{
              color: colors.text,
              fontSize: 14 * textSizeMultiplier,
              marginLeft: 8,
            }}
          >
            Earn coins to get help!
          </SmartText>
        </View>

        {/* Right side: Buttons */}
        <View style={{ flexDirection: "row" }}>
          {/* Settings Button */}
          <TouchableOpacity
            style={{
              backgroundColor: settingsActive ? colors.secondary : colors.primary,
              padding: 8,
              borderRadius: 20,
              marginRight: 8,
            }}
            onPress={() => {
              setSettingsActive(!settingsActive);
              onToggleSettings();
            }}
          >
            <MaterialCommunityIcons
              name="cog"
              size={22 * textSizeMultiplier}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Help Button */}
          <TouchableOpacity
            style={{
              backgroundColor: helpExpanded ? colors.accent : colors.primary,
              padding: 8,
              borderRadius: 20,
            }}
onPress={onToggleHelp}          >
            <MaterialCommunityIcons
              name="lifebuoy"
              size={22 * textSizeMultiplier}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- Main Info Row (Question order + Score) --- */}
      <View style={styles.header}>
        <View style={styles.headerItem}>
          <MaterialCommunityIcons
            name="progress-question"
            size={20 * textSizeMultiplier}
            color="#fff"
          />
          <SmartText style={[styles.headerText, { fontSize: 16 * textSizeMultiplier }]}>
            {currentQuestionIndex + 1}/{totalQuestions}
          </SmartText>
        </View>

        <View style={styles.headerItem}>
          <MaterialCommunityIcons
            name="trophy"
            size={20 * textSizeMultiplier}
            color="#fff"
          />
          <SmartText style={[styles.headerText, { fontSize: 16 * textSizeMultiplier }]}>
            Score: {score}
          </SmartText>
        </View>
      </View>

      {/* Timer Bar */}
      <View style={[styles.timerContainer, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.timerBar, animatedTimerBarStyle]} />
      </View>

      {/* Streak */}
      {streakCount > 0 && (
        <View style={styles.streakDisplay}>
          <LottieView
            source={require("../../animations/Fire.json")}
            autoPlay
            loop
            style={{ width: 30, height: 30 }}
          />
          <SmartText
            style={[
              styles.streakDisplayText,
              { color: colors.streakText, fontSize: 16 * textSizeMultiplier },
            ]}
          >
            {streakCount}x Streak!
          </SmartText>
        </View>
      )}
    </LinearGradient>
  );
};
// --- NEW: HintContainer Component ---
const HintContainer = ({ hintText, onClose }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const progress = useSharedValue(100);

  useEffect(() => {
    progress.value = withTiming(0, { duration: 10000, easing: Easing.linear });
    const timerId = setTimeout(onClose, 10000);
    return () => clearTimeout(timerId);
  }, [onClose]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return { width: `${progress.value}%` };
  });

  return (
    <Animated.View
      style={{
        marginBottom: 12,
        marginTop: -7,
        padding: 15,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.primary,
        backgroundColor: colors.cardBackground,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4, // ensures shadow shows on Android
      }}
      layout={Layout.springify()}
      entering={FadeIn}
      exiting={FadeOut}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons
          name="lightbulb-on-outline"
          size={20 * textSizeMultiplier}
          color={colors.primary}
        />
        <SmartText
          style={{
            fontWeight: 'bold',
            marginLeft: 6,
            color: colors.text,
            fontSize: 18 * textSizeMultiplier,
          }}
        >
          Hint
        </SmartText>
      </View>

      {/* Hint Text */}
      <SmartText
        style={{
          marginBottom: 10,
          textAlign: 'center',
          lineHeight: 20,
          color: colors.secondaryText,
          fontSize: 16 * textSizeMultiplier,
        }}
      >
        {hintText}
      </SmartText>

      {/* Timer bar */}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          marginTop: 6,
          backgroundColor: colors.border,
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 3,
              backgroundColor: colors.primary,
            },
            animatedProgressStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
};



// AnswerOptions Component
const AnswerOptions = ({ options, selectedOption, onSelectOption, hasAnswered, correctOption, isTrueFalse }) => {
  const { getThemeColors, getTextSizeMultiplier, soundEnabled } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const scaleValue = useSharedValue(1);

  const handlePress = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    scaleValue.value = withTiming(0.95, { duration: 100 }, () => {
      scaleValue.value = withTiming(1, { duration: 200 });
    });

    onSelectOption(key);
  };

  return (
    <View>
      {Object.entries(options).map(([key, value]) => {
        const isSelected = selectedOption === key;
        const isCorrect = key.toLowerCase() === correctOption?.toLowerCase();

        const optionBgColor = useSharedValue(colors.cardBackground);
        const optionBorderColor = useSharedValue(colors.border);
        const optionTextColor = useSharedValue(colors.text);

        useEffect(() => {
          if (hasAnswered) { // Corrected 'hasAnswerered' to 'hasAnswered'
            if (isCorrect) {
              optionBgColor.value = withTiming(colors.correct);
              optionBorderColor.value = withTiming(colors.correct);
              optionTextColor.value = withTiming('#fff');
            } else if (isSelected) {
              optionBgColor.value = withTiming(colors.incorrect);
              optionBorderColor.value = withTiming(colors.incorrect);
              optionTextColor.value = withTiming('#fff');
            }
          } else if (isSelected) {
            optionBgColor.value = withTiming(colors.selected);
            optionBorderColor.value = withTiming(colors.primary);
            optionTextColor.value = withTiming(colors.text);
          } else {
            optionBgColor.value = withTiming(colors.cardBackground);
            optionBorderColor.value = withTiming(colors.border);
            optionTextColor.value = withTiming(colors.text);
          }
        }, [hasAnswered, isCorrect, isSelected, colors]);

        const animatedOptionStyle = useAnimatedStyle(() => {
            return {
                transform: [{ scale: scaleValue.value }],
                backgroundColor: optionBgColor.value,
                borderColor: optionBorderColor.value,
            };
        });

        const animatedTextStyle = useAnimatedStyle(() => {
            return {
                color: optionTextColor.value,
                fontWeight: (hasAnswered && (isCorrect || isSelected)) ? 'bold' : 'normal',
                fontSize: 18 * textSizeMultiplier,
            };
        });


        return (
          <TouchableOpacity
            key={key}
            onPress={() => !hasAnswered && handlePress(key)}
            disabled={hasAnswered}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.optionButton,
              animatedOptionStyle
            ]}>
              <Animated.Text style={animatedTextStyle}>
                {!isTrueFalse && `${key}. `}{value}
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// OrderingQuestion Component
const OrderingQuestion = ({ orderingItems, setOrderingItems, hasAnswered }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  const renderItem = useCallback(({ item, drag, isActive }) => (
    <TouchableOpacity
      style={[
        styles.orderingItem,
        {
          backgroundColor: isActive ? colors.selected : colors.cardBackground,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
      onLongPress={drag}
      disabled={hasAnswered}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name="drag-vertical"
        size={28 * textSizeMultiplier}
        color={colors.secondaryText}
      />
      <SmartText style={[styles.orderingText, { color: colors.text, fontSize: 18 * textSizeMultiplier }]}>
        {item.label}
      </SmartText>
    </TouchableOpacity>
  ), [hasAnswered, colors, textSizeMultiplier]);

  return (
    <DraggableFlatList
      data={orderingItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      onDragEnd={({ data }) => !hasAnswered && setOrderingItems(data)}
      scrollEnabled={false}
      containerStyle={{ paddingHorizontal: 10 }}
    />
  );
};

// FillInTheBlankQuestion Component
const FillInTheBlankQuestion = ({
  question,
  fillInBlankAnswers,
  handleFillInBlankChange,
  hasAnswered,
  correctOption,
  fillInBlankRefs,
  isHintVisible,
  setIsHintVisible,
  hintText,
  setPaused
}) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  const questionParts = question.split("____");
  let correctAnswersForPlaceholders = [];

  if (correctOption && typeof correctOption === 'string') {
    correctAnswersForPlaceholders = correctOption.split(',').map(s => s.trim());
  }

  return (
    <View style={styles.fillInBlankContainer}>
      <SmartText style={[styles.questionText, { color: colors.text, fontSize: 22 * textSizeMultiplier }]}>
        {questionParts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < questionParts.length - 1 && (
              <SmartText style={[styles.blankPlaceholder, { color: colors.primary, fontSize: 22 * textSizeMultiplier }]}>
                [{index + 1}]
              </SmartText>
            )}
          </React.Fragment>
        ))}
      </SmartText>
      <View>{isHintVisible && (
            <HintContainer
              hintText={hintText}
              onClose={() => {
                setIsHintVisible(false);
                setPaused(false);
              }}
            />
          )}</View>
      

      {correctAnswersForPlaceholders.map((correctAnswer, index) => (
        <View key={index} style={styles.textInputWrapper}>
          <SmartText style={[styles.blankIndexLabel, { color: colors.secondaryText, fontSize: 18 * textSizeMultiplier }]}>
            {index + 1}.
          </SmartText>
          <TextInput
            ref={fillInBlankRefs.current[index]}
            style={[
              styles.fillInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.cardBackground,
                color: colors.text,
                fontSize: 16 * textSizeMultiplier,
              },
              hasAnswered && (
                fillInBlankAnswers[index]?.trim().toLowerCase() === correctAnswer?.trim().toLowerCase()
                  ? { borderColor: colors.correct }
                  : { borderColor: colors.incorrect }
              )
            ]}
            value={fillInBlankAnswers[index]}
            onChangeText={(text) => handleFillInBlankChange(text, index)}
            placeholder={`Answer for blank ${index + 1}`}
            placeholderTextColor={colors.secondaryText}
            editable={!hasAnswered}
            returnKeyType={index === correctAnswersForPlaceholders.length - 1 ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (index < correctAnswersForPlaceholders.length - 1) {
                fillInBlankRefs.current[index + 1]?.current.focus();
              }
            }}
          />
        </View>
      ))}
    </View>
  );
};

// AvatarFeedback Component
const AvatarFeedback = ({ mood, streakCount }) => {
  const { getThemeColors } = useContext(AppContext);
  const colors = getThemeColors();

  const getAvatarAnimation = () => {
    if (streakCount >= 3) {
      return require('../../animations/happy_dance.json');
    }
    switch (mood) {
      case 'happy':
        return require('../../animations/happy.json');
      case 'neutral':
        return require('../../animations/neutral.json');
      case 'sad':
        return require('../../animations/sad.json');
      default:
        return require('../../animations/neutral.json');
    }
  };

  return (
    <View style={styles.avatarContainer}>
      <LottieView
        source={getAvatarAnimation()}
        autoPlay
        loop
        style={{ width: 120, height: 120 }}
      />
    </View>
  );
};
const Podium = ({ leaderboard, studentId }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const currentUserIndex = leaderboard.findIndex(item => item.studentId === studentId);
  const currentUser = leaderboard[currentUserIndex];

  const getMotivationalMessage = () => {
    if (currentUserIndex === 0) {
      return "You're in the lead! Keep up the great work to stay at the top!";
    }
    if (currentUserIndex > 0) {
      const personAhead = leaderboard[currentUserIndex - 1];
      const scoreDiff = personAhead.score - currentUser.score;
      if (scoreDiff <= 1) {
        return `You're just behind ${personAhead.studentName}! Answer this next one correctly and quickly to overtake them!`;
      }
      return `You're doing great! Keep pushing to climb higher on the leaderboard!`;
    }
    return "Give it your best shot to get on the leaderboard!";
  };

  return (
    <View style={[styles.podiumContainer, { backgroundColor: colors.cardBackground }]}>
      <SmartText style={[styles.podiumTitle, { color: colors.text, fontSize: 20 * textSizeMultiplier }]}>
        Live Leaderboard
      </SmartText>
      <View style={styles.podiumRanks}>
        {leaderboard.slice(0, 3).map((player, index) => (
          <View key={player.studentId} style={[styles.podiumRank, index === 0 && styles.firstPlace]}>
            <SmartText style={styles.podiumRankText}>{index + 1}</SmartText>
            <SmartText style={styles.podiumName}>{player.studentName || 'Anonymous'}</SmartText>
            <SmartText style={styles.podiumScore}>{player.score} pts</SmartText>
          </View>
        ))}
      </View>
      {currentUser && (
        <View style={styles.motivationalBox}>
          <SmartText style={[styles.motivationalText, { color: colors.secondaryText, fontSize: 14 * textSizeMultiplier }]}>
            {getMotivationalMessage()}
          </SmartText>
        </View>
      )}
    </View>
  );
};
// FeedbackOverlay Component
const FeedbackOverlay = ({feedbackTitle, feedbackSubtitle,
  answerStatus,
  streakCount,
  timeTaken,
  onNextQuestion,
  isLastQuestion,
  score,
  leaderboard,
  studentId,
  totalQuestions
}) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  const getAvatarMood = () => {
  if (answerStatus === 'timeout') return 'neutral';
  if (answerStatus === 'incorrect') return 'sad';
  if (answerStatus === 'correct') {
    if (streakCount >= 3) return 'excited';
    return 'happy';
  }
  return 'neutral';
};


  const comboMultiplier = Math.max(1, Math.floor(streakCount / 2));
  const coinsEarned = answerStatus === 'correct' ? (10 + streakCount * 5 + (timeTaken < 5 ? 5 : 0)) : 0;

  return (
    <View style={[styles.feedbackContainer, { backgroundColor: colors.background }]}>
      <AvatarFeedback mood={getAvatarMood()} streakCount={streakCount} />



       <SmartText style={[styles.feedbackTitle, { color: colors.text, fontSize: 32 * textSizeMultiplier }]}>
        {feedbackTitle}
      </SmartText>

      <SmartText style={[styles.feedbackSubtitle, { color: colors.secondaryText, fontSize: 18 * textSizeMultiplier, }]}>
        {feedbackSubtitle}
      </SmartText>

      {answerStatus === 'correct' && (
        <>
          {streakCount > 1 && (
            <View style={[styles.streakContainer, { backgroundColor: colors.streakBg }]}>
              <LottieView
                source={require('../../animations/fire_sparkles.json')}
                autoPlay
                loop
                style={{ width: 60, height: 60, marginLeft: -10 }}
              />
              <SmartText style={[styles.streakText, { color: colors.streakText, fontSize: 18 * textSizeMultiplier }]}>
                {streakCount}x Streak! (x{comboMultiplier} bonus)
              </SmartText>
            </View>
          )}
        </>
      )}

      <SmartText style={[styles.feedbackTime, { color: colors.secondaryText, fontSize: 16 * textSizeMultiplier }]}>
        You answered in {timeTaken.toFixed(1)} seconds
      </SmartText>
      <View><Podium leaderboard={leaderboard} studentId={studentId} /></View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: colors.primary }]}
        onPress={onNextQuestion}
        activeOpacity={0.7}
      >
        <SmartText style={[styles.submitButtonText, { fontSize: 18 * textSizeMultiplier }]}>
          {isLastQuestion ? 'View Summary' : 'Next Question'}
        </SmartText>
      </TouchableOpacity>
    </View>
  );
};

// SettingsPanel Component
const SettingsPanel = () => {
  const {
    toggleTheme,
    increaseTextSize,
    decreaseTextSize,
    soundEnabled,
    getThemeColors
  } = useContext(AppContext);
  const colors = getThemeColors();

  const progress = useSharedValue(0); // For theme button rotation

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 180}deg` }],
    };
  });

  const handlePressTheme = () => {
    progress.value = withTiming(progress.value + 1, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
    });
    toggleTheme();
  };


  return (
    <View style={styles.settingsPanel}>
      <TouchableOpacity onPress={handlePressTheme} style={styles.settingButton} activeOpacity={0.7}>
        <Animated.View style={animatedStyle}>
          <MaterialCommunityIcons
            name={colors.theme === 'light' ? 'moon-waning-gibbous' : 'white-balance-sunny'}
            size={24}
            color={colors.primary}
          />
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity onPress={increaseTextSize} style={styles.settingButton} activeOpacity={0.7}>
        <MaterialIcons name="format-size" size={24} color={colors.primary} />
        <SmartText style={{color: colors.primary, fontSize: 12}}>A+</SmartText>
      </TouchableOpacity>

      <TouchableOpacity onPress={decreaseTextSize} style={styles.settingButton} activeOpacity={0.7}>
        <MaterialIcons name="format-size" size={24} color={colors.primary} />
        <SmartText style={{color: colors.primary, fontSize: 12}}>A-</SmartText>
      </TouchableOpacity>

    </View>
  );
};

// ProgressBar Component
const ProgressBar = ({ progress, coins, currentQuestionIndex, totalQuestions }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const widthAnim = useSharedValue(0);
  const screenWidth = Dimensions.get('window').width;

const progressBarStyle = useAnimatedStyle(() => {
  return {
    width: widthAnim.value,
  };
});


 useEffect(() => {
  const progressRatio = (currentQuestionIndex ) / totalQuestions;
  widthAnim.value = withTiming(progressRatio * screenWidth, { duration: 400 });
}, [currentQuestionIndex]);


  return (
    <View style={[styles.progressBarContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
<Animated.View style={[styles.progressBarFill, progressBarStyle]} />
      <SmartText style={[styles.progressText, { color: colors.text, fontSize: 14 * textSizeMultiplier }]}>
        {/* This text now accurately shows progress, e.g., "1/10" when on the first question */}
        Progress: {Math.min(currentQuestionIndex , totalQuestions)}/{totalQuestions}
      </SmartText>

      <View style={styles.coinsDisplay}>
        <MaterialCommunityIcons name="cash" size={20 * textSizeMultiplier} color={colors.coin} />
        <SmartText style={[styles.coinsText, { color: colors.text, fontSize: 16 * textSizeMultiplier }]}>
          {coins}
        </SmartText>
      </View>
    </View>
  );
};
// LoadingAndErrorState Component
const LoadingAndErrorState = ({ isLoading, error, onGoBack, isOutOfRange, onGoBackToQuizzes }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LottieView
          source={require('../../animations/loading_animation.json')}
          autoPlay
          loop
          style={{ width: 150, height: 150 }}
        />
        <SmartText style={[styles.loadingText, { color: colors.primary, fontSize: 16 * textSizeMultiplier }]}>
          Loading Quiz...
        </SmartText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={60 * textSizeMultiplier} color={colors.incorrect} />
        <SmartText style={[styles.errorText, { color: colors.incorrect, fontSize: 18 * textSizeMultiplier }]}>
          {error}
        </SmartText>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={onGoBack}
          activeOpacity={0.7}
        >
          <SmartText style={[styles.submitButtonText, { fontSize: 18 * textSizeMultiplier }]}>
            Go Back
          </SmartText>
        </TouchableOpacity>
      </View>
    );
  }

  if (isOutOfRange) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="map-marker-off" size={60 * textSizeMultiplier} color={colors.incorrect} />
        <SmartText style={[styles.errorText, { color: colors.incorrect, fontSize: 18 * textSizeMultiplier }]}>
          You are out of the allowed quiz area!
        </SmartText>
        <SmartText style={[styles.messageText, { color: colors.secondaryText, fontSize: 16 * textSizeMultiplier }]}>
          Please return to the designated location to continue.
        </SmartText>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={onGoBackToQuizzes} // This line has been changed
          activeOpacity={0.7}
        >
          <SmartText style={styles.submitButtonText}>Go Back and refresh!</SmartText>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
};
const HelpButton = ({ coins, onBuy, config, totalQuestions }) => {
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();
  const [expanded, setExpanded] = useState(false);

  const dynamicCost = (type) => {
    if (!config) return 20;
    const maxCoins = totalQuestions * 10; // adjust logic based on your reward system
    const base = type === "extraTime" ? config.timePerQuestion : config.timePerQuestion / 2;
    return Math.max(5, Math.floor((base / config.timePerQuestion) * (maxCoins / 2.5)));
  };

  return (
    <View style={{ alignItems: "center", marginVertical: 10 }}>
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary,
          padding: 12,
          borderRadius: 20,
        }}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <SmartText style={{ color: "#fff", fontSize: 16 * textSizeMultiplier }}>Help ðŸ’¡</SmartText>
      </TouchableOpacity>

      {expanded && (
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          {["extraTime", "hint"].map((type) => {
            const cost = dynamicCost(type);
            return (
              <TouchableOpacity
                key={type}
                style={{
                  backgroundColor: coins >= cost ? colors.primary : colors.border,
                  borderRadius: 12,
                  padding: 10,
                  marginHorizontal: 8,
                  opacity: coins >= cost ? 1 : 0.5,
                }}
                onPress={() => coins >= cost && onBuy({ id: type, cost })}
                disabled={coins < cost}
              >
                <SmartText style={{ color: "#fff", fontSize: 14 * textSizeMultiplier }}>
                  {type === "extraTime" ? "Extra Time" : "Hint"} ({cost}ðŸ’°)
                </SmartText>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// --- Main QuizQuestionScreen Component ---
function QuizQuestionScreen() {
  const router = useRouter();
  const { quizId, sessionId, studentId } = useLocalSearchParams();
  const { getThemeColors, getTextSizeMultiplier } = useContext(AppContext);
  const colors = getThemeColors();
  const textSizeMultiplier = getTextSizeMultiplier();


  // --- Core State ---
  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [submittedQuestionsCount, setSubmittedQuestionsCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [hintText, setHintText] = useState('');
  const [paused, setPaused] = useState(false);
  





  // --- UI & Interaction State ---
  const [timer, setTimer] = useState(30);
  const [timeTaken, setTimeTaken] = useState(0);
  const [answerStatus, setAnswerStatus] = useState('unanswered');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertOnConfirm, setAlertOnConfirm] = useState(() => () => {});
  const [alertOnCancel, setAlertOnCancel] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const appState = useRef(AppState.currentState);
  const [feedbackTitle, setFeedbackTitle] = useState('');
const [feedbackSubtitle, setFeedbackSubtitle] = useState('');
const [isHintVisible, setIsHintVisible] = useState(false);


const handleGoBackToQuizzes = () => {
    router.replace('/studentFiles/studentQuizs');
  };
  const dynamicCost = (type) => {
  if (!config) return 20;
  const maxCoins = totalQuestions * 10;
  const base = type === "extraTime" ? config.timePerQuestion : config.timePerQuestion / 2;
  return Math.max(
    5,
    Math.floor((base / config.timePerQuestion) * (maxCoins / 2.5))
  );
};
const fetchLeaderboard = async () => {
    try {
      const submissionsRes = await databases.listDocuments(
        DATABASE_ID,
        SUBMISSIONS_COLLECTION,
        [
          Query.equal('quiz_id', quizId),
          Query.equal('session_id', sessionId),
          Query.limit(500),
        ]
      );

      // Get the unique list of student CINs from submissions
      const studentIds = [...new Set(submissionsRes.documents.map(s => s.student_id))];

      // Fetch all matching profiles in ONE query using the correct attribute 'stcin'
      let profiles = [];
      if (studentIds.length > 0) {
        const profilesRes = await databases.listDocuments(
          DATABASE_ID,
          PROFILES_COLLECTION,
          [
            Query.equal('stcin', studentIds) // CORRECTED: Use 'stcin' here
          ]
        );
        profiles = profilesRes.documents;
      }

      const processed = processSubmissionsForLeaderboard(submissionsRes.documents, profiles);
      setLeaderboard(processed);
    } catch (err) {
      console.error("Leaderboard update failed:", err);
    }
  };

const handleBuyPowerUp = (item) => {
  setCoins(prev => prev - item.cost);

  if (item.id === 'extraTime') {
    const base = config?.timePerQuestion || 30;
    const bonus = Math.max(5, Math.floor(base * 0.3)); // scale with time per question
    setTimer(prev => prev + bonus);
    showAlert('Power-Up Activated!', `You gained +${bonus}s extra time!`, () => {});
    setHelpExpanded((prev) => !prev);
  }

 if (item.id === 'hint') {
  const explanation = currentQuestion?.explanation?.trim();
  setHintText(explanation || "No explanation available.");
  setIsHintVisible(true);
  setPaused(true); // pause timer
  setHelpExpanded((prev) => !prev);
}

};

 const progressPercentage = totalQuestions > 0 ? (submittedQuestionsCount / totalQuestions) * 100 : 0;
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [achievements, setAchievements] = useState([]);

  // --- Input State ---
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillInBlankAnswers, setFillInBlankAnswers] = useState([]);
  const [orderingItems, setOrderingItems] = useState([]);
  const fillInBlankRefs = useRef([]);

  // --- Location Tracking ---
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const locationSubscription = useRef(null);

  // --- Custom Alert Function ---
  const showAlert = useCallback((title, message, onConfirm, onCancel = null) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOnConfirm(() => {
      setAlertVisible(false);
      onConfirm();
    });
    setAlertOnCancel(onCancel ? () => {
      setAlertVisible(false);
      onCancel();
    } : null);
    setAlertVisible(true);
  }, []);

  const processSubmissionsForLeaderboard = (submissions, profiles) => {
    const studentData = {};

   submissions.forEach(sub => {
  if (!studentData[sub.student_id]) {
    const profile = profiles.find(p => p.stcin === sub.student_id); 

    const fullName = profile
      ? `${profile.stname || ''} ${profile.stfamilyname || ''}`.trim()
      : 'Anonymous';

    studentData[sub.student_id] = {
      studentId: sub.student_id,
      studentName: fullName,
      score: 0,
      totalTime: 0,
      lastSubmissionTime: new Date(0),
    };
  }

      studentData[sub.student_id].score += sub.score === "1" ? 1 : 0;
      studentData[sub.student_id].totalTime += parseFloat(sub.time_taken || "0");
      const subDate = new Date(sub.submission_date);
      if (subDate > studentData[sub.student_id].lastSubmissionTime) {
        studentData[sub.student_id].lastSubmissionTime = subDate;
      }
    });

    return Object.values(studentData).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.totalTime !== b.totalTime) {
        return a.totalTime - b.totalTime;
      }
      return a.lastSubmissionTime - b.lastSubmissionTime;
    });
  };
  // --- New function to send events to Appwrite with JSON string ---

  // --- Data Fetching Effect ---
 useEffect(() => {
  const fetchData = async () => {
    if (!quizId || !sessionId || !studentId) {
      setError("Missing Quiz, Session, or Student ID.");
      setIsLoading(false);
      return;
    }
    

    try {
      const [questionsRes, activeQuizRes, submissionsRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, QUESTIONS_COLLECTION, [Query.equal('quiz_id', quizId), Query.limit(100)]),
        databases.getDocument(DATABASE_ID, ACTIVE_QUIZ_COLLECTION, sessionId),
        databases.listDocuments(DATABASE_ID, SUBMISSIONS_COLLECTION, [
          Query.equal('quiz_id', quizId),
          Query.equal('session_id', sessionId),
          Query.limit(500), // Increased limit for leaderboard
        ]),
      ]);
      // Get the unique list of student CINs from submissions
const studentIds = [...new Set(submissionsRes.documents.map(s => s.student_id))];
// Fetch all matching profiles in ONE query using the correct attribute 'stcin'
let profiles = [];
if (studentIds.length > 0) {
  const profilesRes = await databases.listDocuments(
    DATABASE_ID,
    PROFILES_COLLECTION,
    [
      Query.equal('stcin', studentIds) // CORRECTED: Use 'stcin' here
    ]
  );
  profiles = profilesRes.documents;
}


      const quizConfig = JSON.parse(activeQuizRes.config);
      setConfig(quizConfig);
      setTimer(quizConfig.timePerQuestion || 30);

      let fetchedQuestions = questionsRes.documents;
      setTotalQuestions(fetchedQuestions.length);
      const allSubmissions = submissionsRes.documents;
      const mySubmissions = allSubmissions.filter(s => s.student_id === studentId);
      const submittedCount = mySubmissions.length;

      const processedLeaderboard = processSubmissionsForLeaderboard(allSubmissions, profiles);
      setLeaderboard(processedLeaderboard);

      let resumeQuestions = [];
      let startFrom = 0;
      let totalCoinsEarned = 0;
      let lastStreak = 0;

      if (submittedCount > 0) {
        // Sort submissions by submission_date ascending
        mySubmissions.sort((a, b) => new Date(a.submission_date) - new Date(b.submission_date));

        const lastSubmission = mySubmissions[submittedCount - 1];
        const totalCoinsEarned = mySubmissions.reduce((sum, s) => sum + parseInt(s.coins_earned || "0"), 0);
        lastStreak = parseInt(lastSubmission.current_streak || "0");

        if (quizConfig.shuffleQuestions) {
          const submittedIds = new Set(mySubmissions.map((s) => s.question_id));
          resumeQuestions = fetchedQuestions.filter((q) => !submittedIds.has(q.$id));
          resumeQuestions = shuffleArray(resumeQuestions);
        } else {
          fetchedQuestions.sort((a, b) => a.question_num - b.question_num);
          const lastQuestion = fetchedQuestions.find((q) => q.$id === lastSubmission.question_id);
          const lastNum = lastQuestion?.question_num ?? 0;
          resumeQuestions = fetchedQuestions.filter((q) => q.question_num > lastNum);
        }

        setScore(mySubmissions.filter((s) => s.score === "1").length);
        setCoins(totalCoinsEarned);
        setStreakCount(lastStreak);
        setSubmittedQuestionsCount(submittedCount);
      } else {
        // No submissions yet
        resumeQuestions = quizConfig.shuffleQuestions
          ? shuffleArray(fetchedQuestions)
          : fetchedQuestions.sort((a, b) => a.question_num - b.question_num);
      }

      setQuestions(resumeQuestions);

      if (resumeQuestions.length === 0 && submittedCount > 0) {
        setError("You have already completed all questions in this quiz.");
      }
    } catch (err) {
      setError("Failed to load quiz data. Please try again.");
      console.error("Data Fetching Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchData();
   const unsubscribe = client.subscribe(
  `databases.${DATABASE_ID}.collections.${SUBMISSIONS_COLLECTION}.documents`,
  response => {
    if (response.events.includes('databases.*.collections.*.documents.*.create')) {
      if (!showFeedback) {
        fetchLeaderboard(); // only update leaderboard during quiz
      } else {
        // optional: defer update until overlay is closed
        setTimeout(fetchLeaderboard, 2000);
      }
    }
  }
);

  return () => {
    unsubscribe();
  };
}, [quizId, sessionId, studentId]);

  // --- Location Tracking Effect ---
  useEffect(() => {
    if (config?.trackLocation) {
      const startWatching = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert(
            "Location Required",
            "Location access is mandatory for this quiz. You will be disqualified if it's not enabled.",
            () => setIsOutOfRange(true)
          );
          return;
        }

        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (location) => {
            const profCoords = config.professorLocation;
            const studentCoords = location.coords;
            const distance = haversineDistance(studentCoords, profCoords);
            if (distance > (config.locationRange || 100)) {
              setIsOutOfRange(true);
              showAlert(
                "Out of Range",
                "You have moved too far from the quiz location. Please return to the designated area.",
                () => {}
              );
            } else {
              setIsOutOfRange(false);
            }
          }
        );
      };
      startWatching();
    }
    return () => {
      locationSubscription.current?.remove();
    };
  }, [config, showAlert]);

  // --- Timer Effect ---
useEffect(() => {
  if (isLoading || hasAnswered || showFeedback || !config || paused) return;

  const interval = setInterval(() => {
    setTimer((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        handleAnswerSubmit(true);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isLoading, hasAnswered, showFeedback, currentQuestionIndex, config, paused]);

  // --- Reset State for New Question ---
  const currentQuestion = questions[currentQuestionIndex];
 useEffect(() => {
 
    if (currentQuestion && config) {
      setQuestionStartTime(Date.now());

     
      setHasAnswered(false);
      setShowFeedback(false);
      setAnswerStatus('unanswered');
      setTimer(config.timePerQuestion || 30);
      setTimeTaken(0);
      setSelectedOption(null);

      const normalizedType = currentQuestion.question_type.toLowerCase().replace(/ /g, '-');

      if (normalizedType === 'ordering') {
        try {
          const options = currentQuestion.options && Array.isArray(JSON.parse(currentQuestion.options))
            ? JSON.parse(currentQuestion.options)
            : [];
          setOrderingItems(shuffleArray(options.map((opt, i) => ({ id: `item-${i}`, label: opt }))));
        } catch (e) {
          console.error("Failed to parse ordering options:", e);
          setOrderingItems([]);
        }
      } else if (normalizedType === 'fill-in-the-blank') {
        let correctAnswersForBlanks = [];
        if (currentQuestion.correct_option && typeof currentQuestion.correct_option === 'string') {
          correctAnswersForBlanks = currentQuestion.correct_option.split(',').map(s => s.trim());
        }
        setFillInBlankAnswers(correctAnswersForBlanks.map(() => ""));
        fillInBlankRefs.current = correctAnswersForBlanks.map(() => React.createRef());
      }
    }


    
}, [currentQuestionIndex, questions, config]);

  // --- Answer Submission Logic ---
  // ... inside QuizQuestionScreen component
const handleAnswerSubmit = useCallback(async (isTimeout = false) => {
  if (hasAnswered) return;

  const timeSpent = (config.timePerQuestion || 30) - timer;
  setTimeTaken(timeSpent);
  setHasAnswered(true);
  setIsHintVisible(false);
  setPaused(false); // pause timer
  setHelpExpanded(false);

  let isCorrect = false;
  let studentAnswer = '';
  const normalizedType = currentQuestion.question_type.toLowerCase().replace(/ /g, '-');

  // --- Answer Validation ---
  switch (normalizedType) {
    case 'multiple-choice':
      studentAnswer = selectedOption;
      isCorrect = selectedOption === currentQuestion.correct_option;
      break;
    case 'true/false':
      studentAnswer = selectedOption;
      isCorrect = selectedOption?.toLowerCase() === currentQuestion.correct_option?.toLowerCase();
      break;
    case 'ordering':
      studentAnswer = orderingItems.map(item => item.label).join(',');
      isCorrect = studentAnswer === currentQuestion.correct_option;
      break;
    case 'fill-in-the-blank':
      let correctAnswersExpected = [];
      if (currentQuestion.correct_option && typeof currentQuestion.correct_option === 'string') {
        correctAnswersExpected = currentQuestion.correct_option.split(',').map(s => s.trim());
      }
      studentAnswer = JSON.stringify(fillInBlankAnswers);
      const trimmedStudentAnswers = fillInBlankAnswers.map(a => a.trim().toLowerCase());
      const trimmedCorrectAnswers = correctAnswersExpected.map(a => a.trim().toLowerCase());
      isCorrect = JSON.stringify(trimmedStudentAnswers) === JSON.stringify(trimmedCorrectAnswers);
      break;
    default:
      console.warn("Unknown question type encountered:", normalizedType);
      break;
  }
  setSubmittedQuestionsCount(prev => prev + 1);


  let newStreakCount = streakCount;
  let coinsEarnedThisQuestion = 0;
  let currentAnswerStatus = 'unanswered';

  // --- New feedback generation logic ---
  let generatedTitle = '';
  let generatedSubtitle = '';
  const getRandomMessage = (type, field) => {
    const messages = {
      correct: {
        titles: ['Excellent!', 'Spot On!', 'Perfect!', 'You Got It!', 'Nailed It!'],
        subtitles: ['You\'re crushing it!', 'That was brilliant!', 'Your knowledge is impressive!', 'Keep up the great work!']
      },
      incorrect: {
        titles: ['Oops, Not Quite!', 'Try Again Next Time!', 'Keep Practicing!', 'Almost There!'],
        subtitles: ['You\'ll get it next time!', 'Mistakes help us learn!', 'Don\'t give up!', 'Review and try again!']
      },
      timeout: {
        titles: ['Time Ran Out!', 'Too Slow!', 'Next Time, Faster!', 'Out of Time!'],
        subtitles: ['Speed up a bit next time!', 'Watch the timer!', 'Quick thinking helps!', 'Time management is key!']
      }
    };
    const messagesArray = messages[type]?.[field] || [];
    return messagesArray[Math.floor(Math.random() * messagesArray.length)] || '';
  };

  if (isTimeout) {
    currentAnswerStatus = 'timeout';
    newStreakCount = 0;
    setStreakCount(0);
    generatedTitle = getRandomMessage('timeout', 'titles');
    generatedSubtitle = getRandomMessage('timeout', 'subtitles');
  } else if (isCorrect) {
    currentAnswerStatus = 'correct';
    setScore((prev) => prev + 1);
    newStreakCount = newStreakCount + 1;
    setStreakCount(newStreakCount);

    // Coin rewards
    coinsEarnedThisQuestion = 10 + (newStreakCount - 1) * 5;
    if (timeSpent < 5) {
      coinsEarnedThisQuestion += 5;
      if (!achievements.includes('Fast Thinker')) {
        setAchievements((prev) => [...prev, 'Fast Thinker']);
        showAlert('Achievement Unlocked!', 'You are a Fast Thinker! (+5 bonus coins)', () => {});
      }
    }
    setCoins((prev) => prev + coinsEarnedThisQuestion);

    if (newStreakCount === 3 && !achievements.includes('3x Streak')) {
      setAchievements((prev) => [...prev, '3x Streak']);
      showAlert('Achievement Unlocked!', '3 questions correct in a row! Keep it up!', () => {});
    } else if (newStreakCount === 5 && !achievements.includes('5x Streak Master')) {
      setAchievements((prev) => [...prev, '5x Streak Master']);
      showAlert('Achievement Unlocked!', '5x Streak Master! Amazing!', () => {});
    }

    if (timeSpent < 5 && newStreakCount > 0) {
      generatedTitle = 'Lightning Fast! ';
    } else if (newStreakCount >= 3) {
      generatedTitle = ` ${newStreakCount}x Streak! `;
    } else {
      generatedTitle = getRandomMessage('correct', 'titles');
    }
    generatedSubtitle = getRandomMessage('correct', 'subtitles');

  } else {
    currentAnswerStatus = 'incorrect';
    newStreakCount = 0;
    setStreakCount(0);
    generatedTitle = getRandomMessage('incorrect', 'titles');
    generatedSubtitle = getRandomMessage('incorrect', 'subtitles');
  }

  setAnswerStatus(currentAnswerStatus);
  setFeedbackTitle(generatedTitle);
  setFeedbackSubtitle(generatedSubtitle);

  // --- Submit to Appwrite ---
  try {
    const submissionData = {
      quiz_id: quizId,
      session_id: sessionId,
      student_id: studentId,
      question_id: currentQuestion.$id,
      student_answer: String(studentAnswer),
      score: isCorrect ? "1" : "0",
      time_taken: timeSpent.toString(),
      is_timeout: isTimeout,
      submission_date: new Date().toISOString(),
      question_difficulty: currentQuestion.difficulty,
      coins_earned: coinsEarnedThisQuestion.toString(),
      current_streak: newStreakCount.toString(),
    };
    await databases.createDocument(DATABASE_ID, SUBMISSIONS_COLLECTION, ID.unique(), submissionData);
  } catch (err) {
    console.error("Submission Error:", err);
    showAlert("Submission Failed", "Your answer could not be saved. Please check your connection.", () => {});
  } finally {
    setShowFeedback(true);
  }
}, [hasAnswered, timer, config, currentQuestion, selectedOption, orderingItems, fillInBlankAnswers, studentId, streakCount, achievements, showAlert]);

  // --- Navigation to Next Question or Summary ---
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      router.replace({
        pathname: '/studentFiles/quizSummary', // This should match the file path
        params: {
          finalScore: score,
          totalQuestions: totalQuestions,
          quizId: quizId,
          sessionId: sessionId, // Pass sessionId and studentId
          studentId: studentId,
          totalCoins: coins,
        },
      });
    }
  }, [currentQuestionIndex, questions.length, router, score, quizId, coins, totalQuestions]);

  // --- Character Input Logic for Fill-in-the-Blank ---
  const handleFillInBlankChange = useCallback((text, index) => {
    const newAnswers = [...fillInBlankAnswers];
    newAnswers[index] = text;
    setFillInBlankAnswers(newAnswers);
  }, [fillInBlankAnswers]);

  // --- Render Question by Type ---
  const renderQuestionByType = useCallback(() => {
  if (!currentQuestion) return null;

  const normalizedType = currentQuestion.question_type.toLowerCase().replace(/ /g, '-');
  const questionText = currentQuestion.question;

  switch (normalizedType) {
    case 'multiple-choice': {
      let mcqOptionsMap = {};
      try {
        if (currentQuestion.options && typeof currentQuestion.options === 'string') {
          const parsedOptions = JSON.parse(currentQuestion.options);
          if (typeof parsedOptions === 'object' && parsedOptions !== null && !Array.isArray(parsedOptions)) {
            mcqOptionsMap = parsedOptions;
          }
        }
      } catch (e) {
        console.error("Failed to parse options for MCQ:", e);
      }
      return (
        <>
          <SmartText style={[styles.questionText, { color: colors.text, fontSize: 22 * textSizeMultiplier }]}>
            {questionText}
          </SmartText>

          {isHintVisible && (
            <HintContainer
              hintText={hintText}
              onClose={() => {
                setIsHintVisible(false);
                setPaused(false);
              }}
            />
          )}

          <AnswerOptions
            options={mcqOptionsMap}
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            hasAnswered={hasAnswered}
            correctOption={currentQuestion.correct_option}
            isTrueFalse={false}
            disabled={paused}
          />
        </>
      );
    }

    case 'true/false':
      return (
        <>
          <SmartText style={[styles.questionText, { color: colors.text, fontSize: 22 * textSizeMultiplier }]}>
            {questionText}
          </SmartText>

          {isHintVisible && (
            <HintContainer
              hintText={hintText}
              onClose={() => {
                setIsHintVisible(false);
                setPaused(false);
              }}
            />
          )}

          <AnswerOptions
            options={{ True: 'True', False: 'False' }}
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            hasAnswered={hasAnswered}
            correctOption={currentQuestion.correct_option}
            isTrueFalse={true}
            disabled={paused}
          />
        </>
      );

    case 'ordering':
      return (
        <>
          <SmartText style={[styles.questionText, { color: colors.text, fontSize: 22 * textSizeMultiplier }]}>
            {questionText}
          </SmartText>

          {isHintVisible && (
            <HintContainer
              hintText={hintText}
              onClose={() => {
                setIsHintVisible(false);
                setPaused(false);
              }}
            />
          )}

          <OrderingQuestion
            orderingItems={orderingItems}
            setOrderingItems={setOrderingItems}
            hasAnswered={hasAnswered}
            disabled={paused}
          />
        </>
      );

    case 'fill-in-the-blank':
      return (
        <>

          <FillInTheBlankQuestion
            question={questionText}
            fillInBlankAnswers={fillInBlankAnswers}
            handleFillInBlankChange={handleFillInBlankChange}
            hasAnswered={hasAnswered}
            correctOption={currentQuestion.correct_option}
            fillInBlankRefs={fillInBlankRefs}
            disabled={paused}
            isHintVisible={isHintVisible}
      setIsHintVisible={setIsHintVisible}
      hintText={hintText}
      setPaused={setPaused}
          />
        </>
      );

    default:
      return (
        <SmartText style={[styles.errorText, { color: colors.incorrect }]}>
          Unsupported question type: {currentQuestion.question_type}
        </SmartText>
      );
  }
}, [
  currentQuestion,
  selectedOption,
  hasAnswered,
  orderingItems,
  fillInBlankAnswers,
  handleFillInBlankChange,
  colors,
  textSizeMultiplier,
  isHintVisible,
  hintText,
  paused,
]);


  // --- MAIN RENDER ---
  if (isLoading || error || isOutOfRange) {
    return (
      <LoadingAndErrorState
        isLoading={isLoading}
        error={error}
        onGoBack={() => router.replace('/studentFiles/studentQuizs')}
        isOutOfRange={isOutOfRange}
        onGoBackToQuizzes={handleGoBackToQuizzes}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.gradientStart} barStyle="light-content" />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onConfirm={alertOnConfirm}
        onCancel={alertOnCancel}
      />

     {showSettings && (
    <SettingsPanel />
  )}

  <QuestionHeader
  currentQuestionIndex={currentQuestionIndex}
  totalQuestions={questions.length}
  score={score}
  timer={timer}
  timePerQuestion={config?.timePerQuestion}
  streakCount={streakCount}
  coins={coins}
  config={config}
  onBuyPowerUp={handleBuyPowerUp}
  onToggleSettings={() => setShowSettings((prev) => !prev)}
  onToggleHelp={() => setHelpExpanded((prev) => !prev)}
  helpExpanded={helpExpanded}
/>
{helpExpanded && (
  <View style={{ flexDirection: "row", justifyContent: "center", marginTop : 15, marginBottom:0 }}>
    {["extraTime", "hint"].map((type) => {
      const cost = dynamicCost(type); // put this in parent now
      return (
        <TouchableOpacity
          key={type}
          style={{
            backgroundColor: coins >= cost ? colors.primary : colors.border,
            borderRadius: 10,
            padding: 8,
            marginHorizontal: 5,
            flexDirection: "row",
            alignItems: "center",
            opacity: coins >= cost ? 1 : 0.5,
          }}
          onPress={() => coins >= cost && handleBuyPowerUp({ id: type, cost })}
          disabled={coins < cost}
        >
          <SmartText style={{ color: "#fff", fontSize: 13 }}>
            {type === "extraTime" ? "Extra Time" : "Hint"}
          </SmartText>
          <MaterialCommunityIcons name="cash" size={18} color="#ffd700" style={{ marginLeft: 5 }} />
          <SmartText style={{ color: "#fff", fontSize: 13, marginLeft: 3 }}>{cost}</SmartText>
        </TouchableOpacity>
      );
    })}
  </View>
)}
    

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {!showFeedback ? (
          <>
            <View style={styles.questionContainer}>
  {renderQuestionByType()}
</View>
            {!hasAnswered && (
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={() => handleAnswerSubmit(false)}
                disabled={isOutOfRange}
                activeOpacity={0.7}
              >
                <SmartText style={[styles.submitButtonText, { fontSize: 18 * textSizeMultiplier }]}>
                  Submit Answer
                </SmartText>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <FeedbackOverlay
            answerStatus={answerStatus}
            streakCount={streakCount}
            timeTaken={timeTaken}
            onNextQuestion={handleNextQuestion}
            isLastQuestion={currentQuestionIndex === questions.length - 1}
            score={score}
            totalQuestions={totalQuestions}
            feedbackTitle={feedbackTitle}
            feedbackSubtitle={feedbackSubtitle}
            leaderboard={leaderboard}
            studentId={studentId}
          />
        )}
      </ScrollView>

      <ProgressBar
        progress={progressPercentage}
        coins={coins}
        currentQuestionIndex={submittedQuestionsCount}
        totalQuestions={totalQuestions}
      />
    </SafeAreaView>
    
  );
}

// --- Styles ---
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 15 },
  errorText: { textAlign: 'center', marginTop: 15, fontWeight: 'bold' },
  messageText: { textAlign: 'center', marginTop: 10 },
  podiumContainer: {
    width: '100%',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
  },
  podiumTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  podiumRanks: {
    // Basic styling for ranks container
  },
  podiumRank: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  firstPlace: {
    backgroundColor: '#FFD70020', // Light gold for 1st place
    borderRadius: 8,
  },
  podiumRankText: { fontWeight: 'bold' },
  podiumName: { flex: 1, marginHorizontal: 10 },
  podiumScore: { fontWeight: 'bold' },
  motivationalBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f2f5',
    borderRadius: 8,
  },
  motivationalText: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  helpButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  powerUpOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  powerUpButton: {
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 8,
  },
  powerUpText: {
    color: '#fff',
  },
  settingsPanel: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 15,
    paddingTop: 10,
    marginTop: 30,
    marginBottom: 5,
  },
  settingButton: {
    marginLeft: 15,
    alignItems: 'center',
  },

  headerGradient: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 5,
  },
  timerContainer: {
    height: 8,
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    borderRadius: 4,
  },
  streakDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  streakDisplayText: {
    fontWeight: 'bold',
    marginLeft: 5,
  },

  contentContainer: {
    flexGrow: 1,
    paddingRight: 20,
    paddingLeft: 20,
    paddingBottom: 20,
    paddingTop:15,
  },
  questionContainer: {
    marginBottom: 20,
    marginTop: 0,
    minHeight: 150
  },
  questionText: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 25
  },

  optionButton: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  optionText: {},

  orderingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    borderWidth: 1,
  },
  orderingText: {
    marginLeft: 10
  },

  fillInBlankContainer: {
    alignItems: 'center'
  },
  blankPlaceholder: {
    fontWeight: 'bold',
    marginHorizontal: 4
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 15
  },
  blankIndexLabel: {
    fontWeight: 'bold',
    marginRight: 10
  },
  fillInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
  },

  submitButton: {
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },

  feedbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: Dimensions.get('window').height * 0.6,
    marginTop:-10,
  },
  avatarContainer: {
    marginBottom: 5,
  },
  feedbackTitle: {
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    marginTop: 5,
    textAlign: 'center',
    marginHorizontal: 30,
  },
  feedbackTime: {
    marginTop: 5,
    marginBottom: 30
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15,
    overflow: 'hidden',
  },
  streakText: {
    fontWeight: 'bold',
    marginLeft: -5
  },
  coinsEarnedText: {
    fontWeight: 'bold',
    marginLeft: 8,
  },

  progressBarContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
 progressBarFill: {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 20,
  backgroundColor: '#6c5ce7', // â† Add this (or use your theme color)
},
  progressText: {
    zIndex: 1,
  },
  coinsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  coinsText: {
    fontWeight: 'bold',
    marginLeft: 5,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
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
export default function QuizQuestionScreenWrapper() {
  return (
    <AppProvider>
      <QuizQuestionScreen />
    </AppProvider>
  );
}