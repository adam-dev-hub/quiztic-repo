import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter,useLocalSearchParams } from 'expo-router';
import { Client, Databases, ID } from 'react-native-appwrite';
import { LinearGradient } from 'expo-linear-gradient';
import { showToast } from "../../lib/toasthelper";
import SmartText from "../../components/SmartText";

// Appwrite Configuration
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('""');
const databases = new Databases(client);

const DATABASE_ID = '685ae2ba0012dcb2feda';
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';

// Academic year options
const ACADEMIC_YEARS = [
  '2025-2026',
  '2026-2027',
  '2027-2028'
];

// Semester options
const SEMESTERS = [
  { id: '1', label: 'Semester 1', value: 'S1' },
  { id: '2', label: 'Semester 2', value: 'S2' },
  { id: 'full', label: 'Full Year', value: 'Full Year' },
];

// Department/Faculty options
const DEPARTMENTS = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Business',
  'Economics',
  'Literature',
  'Other',
];

// Study level options
const STUDY_LEVELS = [
  { id: 'bachelor1', label: 'Bachelor Year 1', value: 'L1' },
  { id: 'bachelor2', label: 'Bachelor Year 2', value: 'L2' },
  { id: 'bachelor3', label: 'Bachelor Year 3', value: 'L3' },
  { id: 'master1', label: 'Master Year 1', value: 'M1' },
  { id: 'master2', label: 'Master Year 2', value: 'M2' },
  { id: 'phd', label: 'PhD', value: 'PhD' },
];

// Days of the week
const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Monday', short: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { id: 'thursday', label: 'Thursday', short: 'Thu' },
  { id: 'friday', label: 'Friday', short: 'Fri' },
  { id: 'saturday', label: 'Saturday', short: 'Sat' },
  { id: 'sunday', label: 'Sunday', short: 'Sun' },
];

const CreateClassroomScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [department, setDepartment] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [academicYear, setAcademicYear] = useState(ACADEMIC_YEARS[0]);
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');
  const [maxStudents, setMaxStudents] = useState('');
  const [schedule, setSchedule] = useState({});
  const [room, setRoom] = useState('');
  
  // Modal states
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [semesterModalVisible, setSemesterModalVisible] = useState(false);
  const [yearModalVisible, setYearModalVisible] = useState(false);
  const [customDepartmentModalVisible, setCustomDepartmentModalVisible] = useState(false);
  const [customDepartmentInput, setCustomDepartmentInput] = useState('');
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // New schedule state for better time management
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');
  const [tempRoom, setTempRoom] = useState('');
  const [tempSessionType, setTempSessionType] = useState('Lecture');

  const SESSION_TYPES = ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Workshop','TP','TD','Project'];

  const { profId: professorId } = useLocalSearchParams();
  console.log("Passed Professor ID:", professorId);
  

  const validateForm = () => {
    if (!className.trim()) {
      showToast('Please enter a class name');
      return false;
    }
    if (!classCode.trim()) {
      showToast('Please enter a class code');
      return false;
    }
    if (!department) {
      showToast('Please select a department');
      return false;
    }
    if (!studyLevel) {
      showToast('Please select a study level');
      return false;
    }
    if (!semester) {
      showToast('Please select a semester');
      return false;
    }
    return true;
  };

  const handleCreateClassroom = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const classroomData = {
        professorId,
        name: className.trim(),
        classCode: classCode.trim().toUpperCase(),
        department,
        studyLevel,
        academicYear,
        semester,
        description: description.trim(),
        maxStudents: maxStudents ? parseInt(maxStudents) : null,
        schedule: JSON.stringify(schedule),
        room: room.trim(),
        createdAt: new Date().toISOString(),
        isActive: true,
        studentCount: 0,
      };

      await databases.createDocument(
        DATABASE_ID,
        CLASSROOMS_COLLECTION_ID,
        ID.unique(),
        classroomData
      );

      showToast('Classroom created successfully!');
      router.back();
    } catch (error) {
      console.error('Failed to create classroom:', error);
      showToast('Failed to create classroom. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openScheduleForDay = (day) => {
    setSelectedDay(day);
    setTempStartTime('');
    setTempEndTime('');
    setTempRoom('');
    setTempSessionType('Lecture');
    setTimeout(() => setScheduleModalVisible(true), 50);  };

  const validateTimeFormat = (time) => {
    // Validate HH:MM format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const checkTimeConflict = (dayId, newStart, newEnd) => {
    if (!schedule[dayId]) return false;
    
    const newStartMin = parseTime(newStart);
    const newEndMin = parseTime(newEnd);
    
    return schedule[dayId].some(session => {
      const existingStartMin = parseTime(session.start);
      const existingEndMin = parseTime(session.end);
      
      // Check if times overlap
      return (newStartMin < existingEndMin && newEndMin > existingStartMin);
    });
  };

  const addSessionToDay = () => {
    if (!tempStartTime.trim() || !tempEndTime.trim()) {
      showToast('Please enter both start and end times');
      return;
    }

    if (!validateTimeFormat(tempStartTime) || !validateTimeFormat(tempEndTime)) {
      showToast('Please use HH:MM format (e.g., 09:00)');
      return;
    }

    const startMinutes = parseTime(tempStartTime);
    const endMinutes = parseTime(tempEndTime);

    if (startMinutes >= endMinutes) {
      showToast('End time must be after start time');
      return;
    }

    if (checkTimeConflict(selectedDay.id, tempStartTime, tempEndTime)) {
      showToast('This time slot conflicts with an existing session');
      return;
    }

    const newSchedule = { ...schedule };
    if (!newSchedule[selectedDay.id]) {
      newSchedule[selectedDay.id] = [];
    }

    newSchedule[selectedDay.id].push({
      start: tempStartTime.trim(),
      end: tempEndTime.trim(),
      room: tempRoom.trim(),
      type: tempSessionType,
    });

    // Sort sessions by start time
    newSchedule[selectedDay.id].sort((a, b) => parseTime(a.start) - parseTime(b.start));

    setSchedule(newSchedule);
    setTempStartTime('');
    setTempEndTime('');
    setTempRoom('');
    setTempSessionType('Lecture');
  };

  const removeSession = (dayId, sessionIndex) => {
    const newSchedule = { ...schedule };
    newSchedule[dayId].splice(sessionIndex, 1);
    if (newSchedule[dayId].length === 0) {
      delete newSchedule[dayId];
    }
    setSchedule(newSchedule);
  };

  const getTotalSessionsCount = () => {
    return Object.values(schedule).reduce((total, sessions) => total + sessions.length, 0);
  };

  const getTotalWeeklyHours = () => {
    let totalMinutes = 0;
    Object.values(schedule).forEach(sessions => {
      sessions.forEach(session => {
        totalMinutes += parseTime(session.end) - parseTime(session.start);
      });
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  };

  const renderSelectorModal = (visible, setVisible, items, selectedValue, onSelect, title) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <SmartText style={styles.modalTitle}>{title}</SmartText>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#2d3436" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item, index) => typeof item === 'string' ? item : item.id}
            renderItem={({ item }) => {
              const label = typeof item === 'string' ? item : item.label;
              const value = typeof item === 'string' ? item : item.value;
              const isSelected = selectedValue === value;
              
              return (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    isSelected && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    onSelect(value);
                    setVisible(false);
                  }}
                >
                  <SmartText style={[
                    styles.modalItemText,
                    isSelected && styles.modalItemTextSelected
                  ]}>
                    {label}
                  </SmartText>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={20} color="#4f46e5" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  const weeklyHours = getTotalWeeklyHours();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      
      <LinearGradient
        colors={['#4f46e5', "#7b84f0"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <SmartText style={styles.headerTitle}>Create New Classroom</SmartText>
          <SmartText style={styles.headerSubtitle}>Set up your class configuration</SmartText>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="information" size={20} color="#4f46e5" />
              <SmartText style={styles.sectionTitle}>Basic Information</SmartText>
            </View>

            <View style={styles.inputGroup}>
              <SmartText style={styles.label}>
                Class Name <SmartText style={styles.required}>*</SmartText>
              </SmartText>
              <TextInput
                style={styles.input}
                placeholder="e.g., IoT 3B"
                value={className}
                onChangeText={setClassName}
                placeholderTextColor="#95a5a6"
              />
            </View>

            <View style={styles.inputGroup}>
              <SmartText style={styles.label}>
                Class Subject <SmartText style={styles.required}>*</SmartText>
              </SmartText>
              <TextInput
                style={styles.input}
                placeholder="e.g., Big Data 2026"
                value={classCode}
                onChangeText={setClassCode}
                autoCapitalize="characters"
                placeholderTextColor="#95a5a6"
              />
            </View>

            <View style={styles.inputGroup}>
              <SmartText style={styles.label}>Description</SmartText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief description of the class..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#95a5a6"
              />
            </View>
          </View>

          {/* Academic Configuration Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="school" size={20} color="#4f46e5" />
              <SmartText style={styles.sectionTitle}>Academic Configuration</SmartText>
            </View>

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setDepartmentModalVisible(true)}
            >
              <View style={styles.selectorContent}>
                <SmartText style={styles.selectorLabel}>
                  Department <SmartText style={styles.required}>*</SmartText>
                </SmartText>
                <SmartText style={[styles.selectorValue, !department && styles.placeholder]}>
                  {department || 'Select department'}
                </SmartText>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#95a5a6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setLevelModalVisible(true)}
            >
              <View style={styles.selectorContent}>
                <SmartText style={styles.selectorLabel}>
                  Study Level <SmartText style={styles.required}>*</SmartText>
                </SmartText>
                <SmartText style={[styles.selectorValue, !studyLevel && styles.placeholder]}>
                  {studyLevel ? STUDY_LEVELS.find(l => l.value === studyLevel)?.label : 'Select level'}
                </SmartText>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#95a5a6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setYearModalVisible(true)}
            >
              <View style={styles.selectorContent}>
                <SmartText style={styles.selectorLabel}>Academic Year</SmartText>
                <SmartText style={styles.selectorValue}>{academicYear}</SmartText>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#95a5a6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setSemesterModalVisible(true)}
            >
              <View style={styles.selectorContent}>
                <SmartText style={styles.selectorLabel}>
                  Semester <SmartText style={styles.required}>*</SmartText>
                </SmartText>
                <SmartText style={[styles.selectorValue, !semester && styles.placeholder]}>
                  {semester ? SEMESTERS.find(s => s.value === semester)?.label : 'Select semester'}
                </SmartText>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#95a5a6" />
            </TouchableOpacity>
          </View>

          {/* Class Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cog" size={20} color="#4f46e5" />
              <SmartText style={styles.sectionTitle}>Class Details</SmartText>
            </View>

            <View style={styles.inputGroup}>
              <SmartText style={styles.label}>Maximum Students</SmartText>
              <TextInput
                style={styles.input}
                placeholder="e.g., 30"
                value={maxStudents}
                onChangeText={setMaxStudents}
                keyboardType="number-pad"
                placeholderTextColor="#95a5a6"
              />
            </View>

            <View style={styles.inputGroup}>
              <SmartText style={styles.label}>Default Room/Location</SmartText>
              <TextInput
                style={styles.input}
                placeholder="e.g., Building A, Room 301"
                value={room}
                onChangeText={setRoom}
                placeholderTextColor="#95a5a6"
              />
              <SmartText style={styles.helperText}>Can be overridden for individual sessions</SmartText>
            </View>
          </View>

          {/* Weekly Schedule Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#4f46e5" />
              <View style={{ flex: 1 }}>
                <SmartText style={styles.sectionTitle}>Weekly Schedule</SmartText>
                {getTotalSessionsCount() > 0 && (
                  <SmartText style={styles.scheduleStats}>
                    {getTotalSessionsCount()} session{getTotalSessionsCount() > 1 ? 's' : ''} • 
                    {weeklyHours.hours}h {weeklyHours.minutes > 0 ? `${weeklyHours.minutes}m` : ''} per week
                  </SmartText>
                )}
              </View>
            </View>

            <SmartText style={styles.helperText}>
              Tap on a day to add class sessions with specific times and rooms
            </SmartText>
              
            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => {
                const hasSessions = schedule[day.id] && schedule[day.id].length > 0;
                return (
                  <TouchableOpacity
                    key={day.id}
                    style={[
                      styles.dayButton,
                      hasSessions && styles.dayButtonActive
                    ]}
                    onPress={() => openScheduleForDay(day)}
                  >
                    <SmartText style={[
                      styles.dayButtonText,
                      hasSessions && styles.dayButtonTextActive
                    ]}>
                      {day.short}
                    </SmartText>
                    {hasSessions && (
                      <View style={styles.sessionBadge}>
                        <SmartText style={styles.sessionBadgeText}>
                          {schedule[day.id].length}
                        </SmartText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Display weekly timetable */}
            {Object.keys(schedule).length > 0 && (
              <View style={styles.timetableContainer}>
                <SmartText style={styles.timetableTitle}>Weekly Timetable</SmartText>
                {Object.entries(schedule).map(([dayId, sessions]) => {
                  const day = DAYS_OF_WEEK.find(d => d.id === dayId);
                  return (
                    <View key={dayId} style={styles.timetableDay}>
                      <View style={styles.timetableDayHeader}>
                        <SmartText style={styles.timetableDayLabel}>{day.label}</SmartText>
                        <SmartText style={styles.timetableDayHours}>
                          {sessions.reduce((total, s) => 
                            total + (parseTime(s.end) - parseTime(s.start)), 0) / 60}h
                        </SmartText>
                      </View>
                      {sessions.map((session, index) => (
                        <View key={index} style={styles.timetableSession}>
                          <View style={styles.sessionTimeContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#4f46e5" />
                            <SmartText style={styles.sessionTime}>
                              {session.start} - {session.end}
                            </SmartText>
                          </View>
                          <View style={styles.sessionDetails}>
                            <View style={styles.sessionTypeTag}>
                              <SmartText style={styles.sessionTypeText}>{session.type}</SmartText>
                            </View>
                            {session.room && (
                              <View style={styles.sessionRoomContainer}>
                                <MaterialCommunityIcons name="map-marker" size={14} color="#636e72" />
                                <SmartText style={styles.sessionRoom}>{session.room}</SmartText>
                              </View>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => removeSession(dayId, index)}
                            style={styles.deleteSessionButton}
                          >
                            <MaterialCommunityIcons name="close-circle" size={20} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information-outline" size={20} color="#3498db" />
            <SmartText style={styles.infoText}>
              Set up your weekly schedule now. You can always modify it later in the classroom settings.
            </SmartText>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateClassroom}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#95a5a6', '#7f8c8d'] : ['#4f46e5', "#7b84f0"]}
              style={styles.createButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <>
                  <MaterialCommunityIcons name="loading" size={20} color="#fff" />
                  <SmartText style={styles.createButtonText}>Creating...</SmartText>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#fff" />
                  <SmartText style={styles.createButtonText}>Create Classroom</SmartText>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      {/* Department Modal */}
      <Modal
        visible={departmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDepartmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <SmartText style={styles.modalTitle}>Select Department</SmartText>
              <TouchableOpacity onPress={() => setDepartmentModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#2d3436" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={DEPARTMENTS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = department === item;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      isSelected && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      if (item === 'Other') {
                        setDepartmentModalVisible(false);
                        setCustomDepartmentModalVisible(true);
                      } else {
                        setDepartment(item);
                        setDepartmentModalVisible(false);
                      }
                    }}
                  >
                    <SmartText style={[
                      styles.modalItemText,
                      isSelected && styles.modalItemTextSelected
                    ]}>
                      {item}
                    </SmartText>
                    {isSelected && item !== 'Other' && (
                      <MaterialCommunityIcons name="check" size={20} color="#4f46e5" />
                    )}
                    {item === 'Other' && (
                      <MaterialCommunityIcons name="pencil" size={20} color="#4f46e5" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Custom Department Input Modal */}
      <Modal
        visible={customDepartmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCustomDepartmentModalVisible(false);
          setCustomDepartmentInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '40%' }]}>
            <View style={styles.modalHeader}>
              <SmartText style={styles.modalTitle}>Enter Department Name</SmartText>
              <TouchableOpacity onPress={() => {
                setCustomDepartmentModalVisible(false);
                setCustomDepartmentInput('');
              }}>
                <MaterialCommunityIcons name="close" size={24} color="#2d3436" />
              </TouchableOpacity>
            </View>
            
            <View style={{ padding: 20 }}>
              <TextInput
                style={[styles.input, { marginBottom: 20 }]}
                placeholder="Enter department name"
                value={customDepartmentInput}
                onChangeText={setCustomDepartmentInput}
                autoFocus
                placeholderTextColor="#95a5a6"
              />
              
              <TouchableOpacity
                style={{
                  backgroundColor: customDepartmentInput.trim() ? '#4f46e5' : '#95a5a6',
                  padding: 15,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (customDepartmentInput.trim()) {
                    setDepartment(customDepartmentInput.trim());
                    setCustomDepartmentModalVisible(false);
                    setCustomDepartmentInput('');
                  }
                }}
                disabled={!customDepartmentInput.trim()}
              >
                <SmartText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                  Confirm
                </SmartText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enhanced Schedule Builder Modal */}
      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', flex: 1 }]}>
            <View style={styles.modalHeader}>
              <SmartText style={styles.modalTitle}>
                {selectedDay?.label} Schedule
              </SmartText>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#2d3436" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              <View style={{ padding: 20 }}>
                {/* Existing sessions */}
                {selectedDay && schedule[selectedDay.id] && schedule[selectedDay.id].length > 0 && (
                  <View style={{ marginBottom: 25 }}>
                    <SmartText style={styles.sectionLabel}>Scheduled Sessions</SmartText>
                    {schedule[selectedDay.id].map((session, index) => (
                      <View key={index} style={styles.existingSessionCard}>
                        <View style={styles.existingSessionHeader}>
                          <View style={styles.sessionTypeTagModal}>
                            <SmartText style={styles.sessionTypeTextModal}>{session.type}</SmartText>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeSession(selectedDay.id, index)}
                            style={styles.deleteIconButton}
                          >
                            <MaterialCommunityIcons name="delete" size={20} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.existingSessionBody}>
                          <View style={styles.existingSessionRow}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color="#4f46e5" />
                            <SmartText style={styles.existingSessionText}>
                              {session.start} - {session.end}
                            </SmartText>
                          </View>
                          {session.room && (
                            <View style={styles.existingSessionRow}>
                              <MaterialCommunityIcons name="map-marker" size={18} color="#636e72" />
                              <SmartText style={styles.existingSessionText}>{session.room}</SmartText>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add new session form */}
                <SmartText style={styles.sectionLabel}>Add New Session</SmartText>
                
                {/* Session Type Selector */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.subLabel}>Session Type</SmartText>
                  <View style={styles.sessionTypeGrid}>
                    {SESSION_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.sessionTypeButton,
                          tempSessionType === type && styles.sessionTypeButtonActive
                        ]}
                        onPress={() => setTempSessionType(type)}
                      >
                        <SmartText style={[
                          styles.sessionTypeButtonText,
                          tempSessionType === type && styles.sessionTypeButtonTextActive
                        ]}>
                          {type}
                        </SmartText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Time Inputs */}
                <View style={styles.timeInputsRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                    <SmartText style={styles.subLabel}>Start Time</SmartText>
                    <TextInput
                      style={styles.input}
                      placeholder="09:00"
                      value={tempStartTime}
                      onChangeText={setTempStartTime}
                      keyboardType="numbers-and-punctuation"
                      placeholderTextColor="#95a5a6"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <SmartText style={styles.subLabel}>End Time</SmartText>
                    <TextInput
                      style={styles.input}
                      placeholder="11:00"
                      value={tempEndTime}
                      onChangeText={setTempEndTime}
                      keyboardType="numbers-and-punctuation"
                      placeholderTextColor="#95a5a6"
                    />
                  </View>
                </View>

                {/* Room Input */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.subLabel}>Room/Location (Optional)</SmartText>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Room 301 or leave blank for default"
                    value={tempRoom}
                    onChangeText={setTempRoom}
                    placeholderTextColor="#95a5a6"
                  />
                </View>

                {/* Quick Time Presets */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.subLabel}>Quick Time Presets</SmartText>
                  <View style={styles.presetGrid}>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setTempStartTime('08:30');
                        setTempEndTime('10:00');
                      }}
                    >
                      <SmartText style={styles.presetButtonText}>08:30-10:00</SmartText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setTempStartTime('10:15');
                        setTempEndTime('11:45');
                      }}
                    >
                      <SmartText style={styles.presetButtonText}>10:15-11:45</SmartText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setTempStartTime('13:00');
                        setTempEndTime('14:30');
                      }}
                    >
                      <SmartText style={styles.presetButtonText}>13:00-14:30</SmartText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.presetButton}
                      onPress={() => {
                        setTempStartTime('14:45');
                        setTempEndTime('16:15');
                      }}
                    >
                      <SmartText style={styles.presetButtonText}>14:45-16:15</SmartText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.addSessionButton}
                  onPress={addSessionToDay}
                >
                  <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
                  <SmartText style={styles.addSessionButtonText}>Add Session</SmartText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setScheduleModalVisible(false)}
                >
                  <SmartText style={styles.doneButtonText}>Done</SmartText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Other Modals */}
      {renderSelectorModal(
        levelModalVisible,
        setLevelModalVisible,
        STUDY_LEVELS,
        studyLevel,
        setStudyLevel,
        'Select Study Level'
      )}
      {renderSelectorModal(
        semesterModalVisible,
        setSemesterModalVisible,
        SEMESTERS,
        semester,
        setSemester,
        'Select Semester'
      )}
      {renderSelectorModal(
        yearModalVisible,
        setYearModalVisible,
        ACADEMIC_YEARS,
        academicYear,
        setAcademicYear,
        'Select Academic Year'
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: 45,
    paddingBottom: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
  },
  headerContent: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3436',
    marginLeft: 8,
  },
  scheduleStats: {
    fontSize: 12,
    color: '#636e72',
    marginLeft: 8,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3436',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636e72',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 12,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#2d3436',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 6,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  selectorContent: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#636e72',
    marginBottom: 4,
  },
  selectorValue: {
    fontSize: 14,
    color: '#2d3436',
    fontWeight: '500',
  },
  placeholder: {
    color: '#95a5a6',
    fontWeight: '400',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  dayButton: {
    width: '13%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    position: 'relative',
  },
  dayButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  dayButtonText: {
    fontSize: 11,
    color: '#636e72',
    fontWeight: '600',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  sessionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timetableContainer: {
    marginTop: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
  },
  timetableTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 15,
  },
  timetableDay: {
    marginBottom: 15,
  },
  timetableDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timetableDayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
  },
  timetableDayHours: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4f46e5',
  },
  timetableSession: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
  },
  sessionTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionTime: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
  },
  sessionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionTypeTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sessionTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e7d32',
  },
  sessionRoomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionRoom: {
    marginLeft: 4,
    fontSize: 12,
    color: '#636e72',
  },
  deleteSessionButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#2c3e50',
    lineHeight: 18,
  },
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 40,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  createButtonDisabled: {
    shadowOpacity: 0.1,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3436',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  modalItemSelected: {
    backgroundColor: '#f5f3ff',
  },
  modalItemText: {
    fontSize: 15,
    color: '#2d3436',
  },
  modalItemTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  existingSessionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  existingSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTypeTagModal: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  sessionTypeTextModal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
  deleteIconButton: {
    padding: 4,
  },
  existingSessionBody: {
    gap: 6,
  },
  existingSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  existingSessionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2d3436',
  },
  sessionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionTypeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    backgroundColor: '#fff',
  },
  sessionTypeButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  sessionTypeButtonText: {
    fontSize: 13,
    color: '#636e72',
    fontWeight: '500',
  },
  sessionTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  timeInputsRow: {
    flexDirection: 'row',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  presetButtonText: {
    fontSize: 12,
    color: '#636e72',
    fontWeight: '500',
  },
  addSessionButton: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  addSessionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CreateClassroomScreen;