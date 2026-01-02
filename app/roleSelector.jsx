import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';

export default function RoleSelector() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(null);

  const handleGetStarted = () => {
    if (selectedRole === "student") {
      router.push("/login");
    } else if (selectedRole === "professor") {
      router.push("/professor-login");
    }
  };
  

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#6c5ce7" barStyle="light-content" />
      <LinearGradient
        colors={['#f5f5f5', '#e0e0e0']}
        style={styles.background}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <LinearGradient
            colors={['#6c5ce7', '#a29bfe']}
            style={styles.headerContainer}
          >
            <Text style={styles.headerTitle}>Welcome to QuizTIC</Text>
            <Text style={styles.headerSubtitle}>Select your role to continue</Text>
          </LinearGradient>

          {/* Role Selection Cards */}
          <View style={styles.cardsContainer}>
            {/* Student Card */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedRole === "student" && styles.cardSelected
              ]}
              onPress={() => setSelectedRole("student")}
            >
              <View style={styles.cardContent}>
                <View style={[
                  styles.iconContainer,
                  selectedRole === "student" && styles.iconContainerSelected
                ]}>
                  <MaterialCommunityIcons
                    name="brain"
                    size={32}
                    color={selectedRole === "student" ? "#fff" : "#6c5ce7"}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[
                    styles.cardTitle,
                    selectedRole === "student" && styles.cardTitleSelected
                  ]}>
                    Student
                  </Text>
                  <Text style={[
                    styles.cardSubtitle,
                    selectedRole === "student" && styles.cardSubtitleSelected
                  ]}>
                    Access courses & quizs
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Professor Card */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedRole === "professor" && styles.cardSelected
              ]}
              onPress={() => setSelectedRole("professor")}
            >
              <View style={styles.cardContent}>
                <View style={[
                  styles.iconContainer,
                  selectedRole === "professor" && styles.iconContainerSelected
                ]}>
                  <FontAwesome5
                    name="chalkboard-teacher"
                    size={28}
                    color={selectedRole === "professor" ? "#fff" : "#6c5ce7"}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[
                    styles.cardTitle,
                    selectedRole === "professor" && styles.cardTitleSelected
                  ]}>
                    Professor
                  </Text>
                  <Text style={[
                    styles.cardSubtitle,
                    selectedRole === "professor" && styles.cardSubtitleSelected
                  ]}>
                    Manage courses & quizs
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Get Started Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              !selectedRole && styles.actionButtonDisabled
            ]}
            onPress={handleGetStarted}
            disabled={!selectedRole}
          >
            <Text style={styles.actionButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6c5ce7',
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
   headerContainer: {
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 30,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  cardsContainer: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: '#6c5ce7',
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 3,
  },
  cardTitleSelected: {
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  cardSubtitleSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  actionButton: {
    backgroundColor: '#6c5ce7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: '#b2b2b2',
    shadowColor: "#b2b2b2",
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});