import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import SmartText from "../../components/SmartText";

const courses = [
  {
    id: "1",
    name: "Algebra I",
    subject: "Mathematics",
    icon: "function-variant",
    color: "#a29bfe",
    iconBg: "#6c5ce7",
  },
  {
    id: "2",
    name: "Biology Basics",
    subject: "Biology",
    icon: "leaf",
    color: "#b2bec3",
    iconBg: "#00b894",
  },
  {
    id: "3",
    name: "Modern History",
    subject: "History",
    icon: "book-open-page-variant",
    color: "#ffeaa7",
    iconBg: "#fdcb6e",
  },
];

const CourseCard = ({ icon, name, subject, color, iconBg, onSeeMore }) => (
  <View style={[styles.card, { backgroundColor: color }]}>
    <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
      <MaterialCommunityIcons name={icon} size={28} color="#fff" />
    </View>
    <SmartText style={styles.cardTitle}>{name}</SmartText>
    <SmartText style={styles.cardSubject}>{subject}</SmartText>
    <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7} style={{ marginTop: 8 }}>
      <SmartText style={styles.seeMore}>See more</SmartText>
    </TouchableOpacity>
  </View>
);

export default function StudentCourses() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={{ width: '100%', alignItems: 'flex-start', marginBottom: 10, marginTop: 30 }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 12,
            elevation: 4,
            marginLeft: 10,
            marginTop: 5,
          }}
          onPress={() => { router.push('/studentDashboard') }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#6c5ce7',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </View>
          <SmartText style={{ color: '#6c5ce7', fontWeight: 'bold', fontSize: 15 }}>
            Return to Dashboard
          </SmartText>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.cardsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.cardsRow}>
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              icon={course.icon}
              name={course.name}
              subject={course.subject}
              color={course.color}
              iconBg={course.iconBg}
              onSeeMore={() => {}}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#6c5ce7",
  },
  cardsContainer: {
    paddingBottom: 20,
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  card: {
    width: "31%",
    borderRadius: 20,
    padding: 15,
    height: 180,
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#6c5ce7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 15,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2c3e50",
    opacity: 0.95,
    marginTop: 8,
  },
  cardSubject: {
    fontSize: 13,
    color: "#636e72",
    opacity: 0.8,
    marginBottom: 4,
  },
  seeMore: {
    color: "#6c5ce7",
    textDecorationLine: "underline",
    fontWeight: "bold",
    fontSize: 13,
    opacity: 0.95,
  },
});
