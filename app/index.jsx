import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Canvas, LinearGradient, Fill, interpolateColors, vec } from "@shopify/react-native-skia";
import { useSharedValue, useDerivedValue, withTiming } from "react-native-reanimated";
import SmartText from "../components/SmartText";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

export default function RoleSelector() {
  const router = useRouter();
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Animation value for color interpolation
  const colorProgress = useSharedValue(0);
  
  const roles = [
    {
      id: "student",
      title: "Student",
      subtitle: "Access courses & quizzes",
      gifSource: require('../assets/student.gif'),
      staticSource: require('../assets/student.png'), // Optional: static version when not selected
      features: ["Browse Courses", "Take Quizzes", "Track Progress", "Evaluate Knowledge", "Learn and Play"],
      color: "#6c5ce7",
      route: "/login",
      gradientColors: ["#6c5ce7", "#8b7ce9", "#a29bfe"]
    },
    {
      id: "professor",
      title: "Professor",
      subtitle: "Manage courses & quizzes",
      gifSource: require('../assets/teacherr.gif'),
      staticSource: require('../assets/teacherr.png'),
      features: ["Create Courses", "Manage Quizzes", "Organize Classrooms", "Planify the Curricula", "Monitor Students"],
      color: "#6366f1", // Indigo–blue with purple undertones
  route: "/professor-login",
  gradientColors: ["#4f46e5", "#7b84f0", "#2f279e"]


 // Green gradient
    },
    {
      id: "administrator",
      title: "Administrator",
      subtitle: "System administration",
      gifSource: require('../assets/admin.gif'),
      staticSource: require('../assets/admin.png'),
      features: ["User Management", "System Settings", "Overall Analytics", "Maintain Platform", "Evaluate Pedagogy"],
      color: "#7c9d92", // vivid pastel emerald with a purple undertone
  route: "/adminAuthentification",
  gradientColors: ["#6d28d9", "#8b5cf6", "#34d399"] // Amber gradient
    }
  ];

  // Animate color change when role is selected
  useEffect(() => {
    colorProgress.value = withTiming(selectedCardIndex, { duration: 800 });
  }, [selectedCardIndex]);

  // Calculate interpolated colors based on selected role
  const gradientColors = useDerivedValue(() => {
    const inputRange = [0, 1, 2];
    const outputColors1 = roles.map(role => role.gradientColors[0]);
    const outputColors2 = roles.map(role => role.gradientColors[1]);
    const outputColors3 = roles.map(role => role.gradientColors[2]);
    
    return [
      interpolateColors(colorProgress.value, inputRange, outputColors1),
      interpolateColors(colorProgress.value, inputRange, outputColors2),
      interpolateColors(colorProgress.value, inputRange, outputColors3)
    ];
  }, [selectedCardIndex]);

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleGetStarted = () => {
    router.push(roles[selectedCardIndex].route);
  };

  const handleCardPress = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCardIndex(index);
  };

  const selectedRole = roles[selectedCardIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <View style={styles.container}>
        {/* Skia Canvas for animated background */}
        <Canvas style={styles.canvas}>
          <Fill>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={gradientColors}
            />
          </Fill>
        </Canvas>
        
        {/* Animated Background Circles */}
        <View style={styles.backgroundCircle1} />
        <View style={styles.backgroundCircle2} />
        <View style={styles.backgroundCircle3} />

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with PNG Logo */}
          <View style={styles.headerContainer}>
            <View style={styles.logoSection}>
              <View style={styles.logoIconContainer}>
                <Image
                  source={require('../assets/toastlogo.png')}
                  style={{width: 45, height: 45}}
                />
              </View>
              <View>
                <Image
                  source={require('../assets/slogan.png')}
                  style={styles.logoPng}
                />
                <SmartText style={styles.logoSubtext}>Better Teaching</SmartText>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <SmartText style={styles.statNumber}>12.5K+</SmartText>
                <SmartText style={styles.statLabel}>Active Users</SmartText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <SmartText style={styles.statNumber}>450+</SmartText>
                <SmartText style={styles.statLabel}>Courses</SmartText>
              </View>
            </View>
          </View>

          {/* Centered Main Container with Card List */}
          <View style={styles.centeredWrapper}>
            <View style={styles.mainContainer}>
              <SmartText style={styles.sectionTitle}>Choose Your Role</SmartText>
              
              {/* Unified Container */}
              <View style={styles.unifiedContainer}>
                {roles.map((role, index) => {
                  const isSelected = selectedCardIndex === index;
                  
                  return (
                    <View key={role.id}>
                      <TouchableOpacity
                        style={[
                          styles.card,
                          { 
                            backgroundColor: isSelected ? role.color : '#e0e0e0',
                            marginBottom: isSelected ? 10 : (index < roles.length - 1 ? 15 : 0)
                          }
                        ]}
                        onPress={() => handleCardPress(index)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.cardContent}>
                          {/* GIF/Image Container */}
                          <View style={[
                            styles.iconContainer,
                            { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)' }
                          ]}>
                            <Image
                              source={isSelected ? role.gifSource : (role.staticSource || role.gifSource)}
                              style={styles.gifImage}
                              resizeMode="contain"
                            />
                          </View>
                          
                          <View style={styles.textContainer}>
                            <SmartText style={[
                              styles.cardTitle,
                              { color: isSelected ? '#fff' : '#333' }
                            ]}>
                              {role.title}
                            </SmartText>
                            <SmartText style={[
                              styles.cardSubtitle,
                              { color: isSelected ? 'rgba(255,255,255,0.9)' : '#666' }
                            ]}>
                              {role.subtitle}
                            </SmartText>
                          </View>
                          
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Inline Features - One Line */}
                      {isSelected && (
                        <View style={styles.inlineFeaturesContainer}>
                          <SmartText style={styles.inlineFeaturesText}>
                            {role.features.join(' • ')}
                          </SmartText>
                        </View>
                      )}

                      {/* Spacing between cards */}
                      {isSelected && index < roles.length - 1 && (
                        <View style={{ height: 15 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Section */}
        <View style={styles.fixedBottomSection}>
          {/* Role Indicator Dots */}
          <View style={styles.indicatorContainer}>
            {roles.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.indicator,
                  index === selectedCardIndex && styles.indicatorActive,
                  index === selectedCardIndex && { backgroundColor: roles[index].color }
                ]}
                onPress={() => setSelectedCardIndex(index)}
              />
            ))}
          </View>

          {/* Get Started Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: selectedRole.color }]}
            onPress={handleGetStarted}
          >
            <SmartText style={styles.actionButtonText}>Continue as {roles[selectedCardIndex].title}</SmartText>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6c5ce7',
  },
  container: {
    flex: 1,
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundCircle1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backgroundCircle2: {
    position: 'absolute',
    top: 200,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backgroundCircle3: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 140,
  },
  headerContainer: {
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPng: {
    width: 140,
    height: 24,
    tintColor: '#fff',
    marginLeft: -28,
    marginRight: 34,
  },
  logoSubtext: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  centeredWrapper: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  mainContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    paddingLeft: 4,
    textAlign: 'Left',
  },
  unifiedContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  gifImage: {
    width: 48,
    height: 48,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  inlineFeaturesContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inlineFeaturesText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
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
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
    marginHorizontal: 5,
  },
  indicatorActive: {
    width: 24,
    borderRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
});