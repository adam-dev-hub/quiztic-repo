import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { 
  Brain,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Target,
  TrendingUp,
  FileText,
  BookOpen
} from 'lucide-react-native';
import { Client, Databases, ID } from 'react-native-appwrite';
import { showToast } from "../../lib/toasthelper";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons} from '@expo/vector-icons';
import SmartText from "../../components/SmartText";
import LottieView from 'lottie-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

// Appwrite Configuration
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('""');
const databases = new Databases(client);

const DATABASE_ID = '685ae2ba0012dcb2feda';
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';
const CURRICULUM_PLANS_COLLECTION_ID = 'curriculum_plans';
const VERCEL_API_URL = 'https://generate-curriculum-two.vercel.app/api/generate-curriculum';

const PlanifyScreen = () => {
  const router = useRouter();
  const { profId: professorId, classroomId, classroomName, autoOpenModal } = useLocalSearchParams();
  const viewShotRef = useRef();
  
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPlanView, setShowPlanView] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  
  const [planningInputs, setPlanningInputs] = useState({
    courseDescription: '',
    learningObjectives: [''],
    additionalContext: '',
    focusAreas: ['theory', 'practical', 'assessment'],
    teachingStyle: 'interactive',
    courseTopics: ['']
  });

  useEffect(() => {
    // Force a clean 4-second loading screen
    setLoading(true);

    const timer = setTimeout(() => {
      fetchClassroom();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoOpenModal === 'true' && classroom && !loading) {
      setPlanningInputs({
        courseDescription: classroom.description || '',
        learningObjectives: [''],
        additionalContext: '',
        focusAreas: ['theory', 'practical', 'assessment'],
        teachingStyle: 'interactive',
        courseTopics: ['']
      });
      
      if (classroom.hasPlan && classroom.planId) {
        loadExistingPlan(classroom.planId);
      } else {
        setShowPlanModal(true);
      }
    }
  }, [autoOpenModal, classroom, loading]);

  const fetchClassroom = async () => {
    try {
      setLoading(true);
      const doc = await databases.getDocument(
        DATABASE_ID,
        CLASSROOMS_COLLECTION_ID,
        classroomId
      );

      const formattedClassroom = {
        id: doc.$id,
        name: doc.name,
        code: doc.classCode,
        description: doc.description,
        hasPlan: doc.planId ? true : false,
        planId: doc.planId || null
      };

      setClassroom(formattedClassroom);
    } catch (error) {
      console.error('Error fetching classroom:', error);
      showToast('Failed to load classroom');
    } finally {
      setLoading(false);
    }
  };

  const addObjectiveField = () => {
    setPlanningInputs({
      ...planningInputs,
      learningObjectives: [...planningInputs.learningObjectives, '']
    });
  };

  const removeObjectiveField = (index) => {
    const newObjectives = planningInputs.learningObjectives.filter((_, i) => i !== index);
    setPlanningInputs({
      ...planningInputs,
      learningObjectives: newObjectives.length > 0 ? newObjectives : ['']
    });
  };

  const updateObjective = (index, value) => {
    const newObjectives = [...planningInputs.learningObjectives];
    newObjectives[index] = value;
    setPlanningInputs({
      ...planningInputs,
      learningObjectives: newObjectives
    });
  };

  const addTopicField = () => {
    setPlanningInputs({
      ...planningInputs,
      courseTopics: [...planningInputs.courseTopics, '']
    });
  };

  const removeTopicField = (index) => {
    const newTopics = planningInputs.courseTopics.filter((_, i) => i !== index);
    setPlanningInputs({
      ...planningInputs,
      courseTopics: newTopics.length > 0 ? newTopics : ['']
    });
  };

  const updateTopic = (index, value) => {
    const newTopics = [...planningInputs.courseTopics];
    newTopics[index] = value;
    setPlanningInputs({
      ...planningInputs,
      courseTopics: newTopics
    });
  };

  const toggleFocusArea = (area) => {
    const newFocusAreas = planningInputs.focusAreas.includes(area)
      ? planningInputs.focusAreas.filter(a => a !== area)
      : [...planningInputs.focusAreas, area];
    
    setPlanningInputs({
      ...planningInputs,
      focusAreas: newFocusAreas.length > 0 ? newFocusAreas : ['theory']
    });
  };

  const handleGeneratePlan = async () => {
    if (!classroom) return;
    
    const cleanObjectives = planningInputs.learningObjectives.filter(obj => obj.trim());
    const cleanTopics = planningInputs.courseTopics.filter(topic => topic.trim());

    if (!planningInputs.courseDescription.trim() && !classroom.description) {
      showToast('Please provide a course description');
      return;
    }

    setIsProcessing(true);
    try {
      const requestBody = {
        classroomId: classroom.id,
        professorId,
        courseDescription: planningInputs.courseDescription.trim() || classroom.description,
        learningObjectives: cleanObjectives.length > 0 ? cleanObjectives : undefined,
        additionalContext: planningInputs.additionalContext.trim() || undefined,
        focusAreas: planningInputs.focusAreas,
        teachingStyle: planningInputs.teachingStyle,
        courseTopics: cleanTopics.length > 0 ? cleanTopics : undefined
      };

      const response = await fetch(VERCEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to generate curriculum');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to generate curriculum');
      }

      const planDocument = await databases.createDocument(
        DATABASE_ID,
        CURRICULUM_PLANS_COLLECTION_ID,
        ID.unique(),
        {
          classroomId: classroom.id,
          professorId,
          generatedAt: new Date().toISOString(),
          overview: JSON.stringify(data.plan.overview),
          curriculumPhases: JSON.stringify(data.plan.curriculumPhases),
          assessmentPlan: JSON.stringify(data.plan.assessmentPlan),
          recommendations: JSON.stringify(data.plan.recommendations),
          materialSuggestions: JSON.stringify(data.plan.materialSuggestions),
          learningObjectives: JSON.stringify(data.plan.learningObjectives),
        }
      );

      await databases.updateDocument(
        DATABASE_ID,
        CLASSROOMS_COLLECTION_ID,
        classroom.id,
        { planId: planDocument.$id }
      );

      setCurrentPlan(data.plan);
      setClassroom({ ...classroom, hasPlan: true, planId: planDocument.$id });
      setShowPlanModal(false);
      setShowPlanView(true);

      showToast('Curriculum plan generated successfully!');
    } catch (error) {
      console.error('Curriculum generation error:', error);
      Alert.alert('Error', error.message || 'Failed to generate curriculum plan. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadExistingPlan = async (planId) => {
    try {
      setIsProcessing(true);
      setCurrentPlan(null);
      setShowPlanView(false);

      const planDoc = await databases.getDocument(
        DATABASE_ID,
        CURRICULUM_PLANS_COLLECTION_ID,
        planId
      );

      const safeParse = async (value, fallback = null) => {
        if (!value) return fallback;
        if (typeof value === "object") return value;

        if (typeof value === "string") {
          return await new Promise(resolve =>
            setTimeout(() => {
              try {
                resolve(JSON.parse(value));
              } catch (err) {
                console.warn("Failed to parse JSON field:", value, err);
                resolve(fallback);
              }
            }, 0)
          );
        }

        return fallback;
      };

      let reconstructedPlan = {};

      if (planDoc.planData) {
        reconstructedPlan = await safeParse(planDoc.planData, {});
      } else {
        reconstructedPlan = {
          overview: await safeParse(planDoc.overview, {}),
          curriculumPhases: await safeParse(planDoc.curriculumPhases, []),
          assessmentPlan: await safeParse(planDoc.assessmentPlan, {}),
          weeklyTopics: await safeParse(planDoc.weeklyTopics, undefined),
          recommendations: await safeParse(planDoc.recommendations, {}),
          materialSuggestions: await safeParse(planDoc.materialSuggestions, {}),
          learningObjectives: await safeParse(planDoc.learningObjectives, []),
          teachingStrategies: await safeParse(planDoc.teachingStrategies, []),
          metadata: {
            generatedAt: planDoc.generatedAt,
            lastModified: planDoc.lastModified,
            professorId: planDoc.professorId,
            classroomId: planDoc.classroomId,
          }
        };
      }

      const cleanedPlan = {
        overview: reconstructedPlan.overview || {},
        curriculumPhases: Array.isArray(reconstructedPlan.curriculumPhases)
          ? reconstructedPlan.curriculumPhases
          : [],
        assessmentPlan: reconstructedPlan.assessmentPlan || {},
        recommendations: reconstructedPlan.recommendations || {},
        materialSuggestions: reconstructedPlan.materialSuggestions || {},
        learningObjectives: Array.isArray(reconstructedPlan.learningObjectives)
          ? reconstructedPlan.learningObjectives
          : [],
        teachingStrategies: Array.isArray(reconstructedPlan.teachingStrategies)
          ? reconstructedPlan.teachingStrategies
          : [],
        weeklyTopics: reconstructedPlan.weeklyTopics || null,
        metadata: reconstructedPlan.metadata || {}
      };

      setCurrentPlan(cleanedPlan);
      setShowPlanView(true);

    } catch (error) {
      console.error("Error loading plan:", error);
      showToast("Failed to load curriculum plan");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPDF = async () => {
  try {
    const htmlContent = generatePlanHTML(currentPlan, classroom);

    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
    });

    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
    });

    showToast('PDF exported successfully!');
  } catch (error) {
    console.error('PDF export error:', error);
    Alert.alert('Error', 'Failed to export PDF. Please try again.');
  }
};

  const generatePlanHTML = (plan, classroom) => {
    const overview = plan.overview || {};
    const totalHours = overview.totalHours || 1;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Curriculum Plan - ${classroom?.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #2c3e50;
          line-height: 1.6;
        }
        .header {
          background: linear-gradient(135deg, #4f46e5 0%, #a29bfe 100%);
          color: white;
          padding: 30px;
          border-radius: 15px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          opacity: 0.9;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .dashboard-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
        }
        .dashboard-value {
          font-size: 32px;
          font-weight: bold;
          color: #4f46e5;
          margin: 10px 0;
        }
        .dashboard-label {
          font-size: 12px;
          color: #636e72;
          text-transform: uppercase;
        }
        .section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
        }
        .phase-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 15px;
        }
        .phase-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .distribution-bar {
          height: 8px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .objective-item {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }
        .objective-number {
          min-width: 30px;
          height: 30px;
          background: #4f46e5;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #f0f0f0;
        }
        th {
          background: #f8f9fa;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Curriculum Plan</h1>
        <p>${classroom?.name} (${classroom?.code})</p>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="dashboard-value">${overview.totalWeeks || 0}</div>
          <div class="dashboard-label">Total Weeks</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-value">${overview.totalHours || 0}h</div>
          <div class="dashboard-label">Total Hours</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-value">${overview.effectivenessScore || 0}%</div>
          <div class="dashboard-label">Effectiveness</div>
        </div>
      </div>

      ${overview.rationale ? `
        <div class="section">
          <div class="section-title">Plan Overview</div>
          <p>${overview.rationale}</p>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Time Distribution</div>
        <div class="distribution-bar" style="width: ${(overview.lectureHours / totalHours) * 100}%; background: #4f46e5;"></div>
        <p>Lectures: ${overview.lectureHours || 0}h</p>
        <div class="distribution-bar" style="width: ${(overview.practicalHours / totalHours) * 100}%; background: #00b894;"></div>
        <p>Practical: ${overview.practicalHours || 0}h</p>
        <div class="distribution-bar" style="width: ${(overview.assessmentHours / totalHours) * 100}%; background: #fdcb6e;"></div>
        <p>Assessment: ${overview.assessmentHours || 0}h</p>
      </div>

      ${plan.learningObjectives && plan.learningObjectives.length > 0 ? `
        <div class="section">
          <div class="section-title">Learning Objectives</div>
          ${plan.learningObjectives.map((obj, i) => `
            <div class="objective-item">
              <div class="objective-number">${i + 1}</div>
              <div>${obj}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${plan.curriculumPhases && plan.curriculumPhases.length > 0 ? `
        <div class="section">
          <div class="section-title">Curriculum Phases</div>
          ${plan.curriculumPhases.map(phase => `
            <div class="phase-card">
              <div class="phase-header">
                <strong>Phase ${phase.phaseNumber}: ${phase.name}</strong>
                <span>${phase.weeks} weeks (${phase.weekRange})</span>
              </div>
              <p>${phase.focus}</p>
              ${phase.activities ? `<p><strong>Activities:</strong> ${phase.activities.join(', ')}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${plan.assessmentPlan ? `
        <div class="section">
          <div class="section-title">Assessment Strategy</div>
          ${plan.assessmentPlan.philosophy ? `<p><em>${plan.assessmentPlan.philosophy}</em></p>` : ''}
          ${plan.assessmentPlan.quizSchedule ? `
            <table>
              <tr>
                <th>Quiz</th>
                <th>Type</th>
                <th>Week</th>
                <th>Weight</th>
                <th>Topics</th>
              </tr>
              ${plan.assessmentPlan.quizSchedule.map(quiz => `
                <tr>
                  <td>${quiz.quizNumber}</td>
                  <td>${quiz.type}</td>
                  <td>${quiz.week}</td>
                  <td>${quiz.weight}%</td>
                  <td>${quiz.topics ? quiz.topics.join(', ') : ''}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
        </div>
      ` : ''}

      ${plan.recommendations ? `
        <div class="section">
          <div class="section-title">AI Recommendations</div>
          ${Object.entries(plan.recommendations).map(([category, items]) => 
            Array.isArray(items) && items.length > 0 ? `
              <h4 style="color: #4f46e5; text-transform: capitalize;">${category}</h4>
              <ul>
                ${items.map(item => `<li>${item}</li>`).join('')}
              </ul>
            ` : ''
          ).join('')}
        </div>
      ` : ''}
    </body>
    </html>
    `;
  };

  // Full Screen Plan View Component
  const PlanDetailsView = () => {
    if (!currentPlan) return null;
    
    const overview = currentPlan.overview;
    const lectureHours = overview.lectureHours || 0;
    const practicalHours = overview.practicalHours || 0;
    const assessmentHours = overview.assessmentHours || 0;
    const totalHours = overview.totalHours || (lectureHours + practicalHours + assessmentHours) || 1;
    const totalQuizzes = currentPlan.assessmentPlan?.totalQuizzes || 0;

    const getWidth = (hours) => `${(hours / totalHours) * 100}%`;
    const lectureWidth = getWidth(lectureHours);
    const practicalWidth = getWidth(practicalHours);
    const assessmentWidth = getWidth(assessmentHours);

    const handleScheduleQuizzes = () => {
      router.push({
        pathname: './schedule-quizzes',
        params: {
          classroomId: classroom.id, 
          profId: professorId, 
          planId: classroom.planId
        }
      });
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient colors={['#4f46e5', "#7b84f0"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} >
            <TouchableOpacity onPress={() => { setShowPlanView(false); setCurrentPlan(null); router.back(); }} style={styles.backButton} >
              <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <SmartText style={styles.headerTitle}>Curriculum Plan</SmartText>
              <SmartText style={styles.headerSubtitle}>{classroom?.name}</SmartText>
            </View>
            <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF} >
              <SmartText style={styles.exportButtonText}>Export PDF</SmartText>
            </TouchableOpacity>
          </LinearGradient>
          
          <ScrollView 
            style={styles.planDetailsContent} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.planDetailsScrollContent}
          >
            {/* Dashboard Stats */}
            <View style={styles.dashboardSection}>
              <View style={styles.statsGrid}>
                <View style={styles.dashboardCard}>
                  <Target size={32} color="#4f46e5" />
                  <SmartText style={styles.dashboardValue}>{currentPlan.overview.totalWeeks}</SmartText>
                  <SmartText style={styles.dashboardLabel}>Weeks</SmartText>
                </View>
                <View style={styles.dashboardCard}>
                  <BookOpen size={32} color="#00b894" />
                  <SmartText style={styles.dashboardValue}>{currentPlan.overview.totalHours}h</SmartText>
                  <SmartText style={styles.dashboardLabel}>Total Hours</SmartText>
                </View>
                <View style={styles.dashboardCard}>
                  <TrendingUp size={32} color="#fdcb6e" />
                  <SmartText style={styles.dashboardValue}>{currentPlan.overview.effectivenessScore}%</SmartText>
                  <SmartText style={styles.dashboardLabel}>Effectiveness</SmartText>
                </View>
              </View>
            </View>
            
            {/* Overview Section */}
            {currentPlan.overview && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <Target size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>Plan Overview</SmartText>
                </View>
                {currentPlan.overview.rationale && (
                  <SmartText style={styles.overviewText}>
                    {currentPlan.overview.rationale}
                  </SmartText>
                )}
                {/* Time Distribution */}
                <SmartText style={styles.subSectionTitle}>Time Distribution</SmartText>
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionSegment, { width: lectureWidth, backgroundColor: '#4f46e5' }]} />
                  <View style={[styles.distributionSegment, { width: practicalWidth, backgroundColor: '#00b894' }]} />
                  <View style={[styles.distributionSegment, { width: assessmentWidth, backgroundColor: '#fdcb6e' }]} />
                </View>
                <View style={styles.distributionLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#4f46e5' }]} />
                    <SmartText style={styles.legendText}>Lecture ({lectureHours}h)</SmartText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#00b894' }]} />
                    <SmartText style={styles.legendText}>Practical ({practicalHours}h)</SmartText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#fdcb6e' }]} />
                    <SmartText style={styles.legendText}>Assessment ({assessmentHours}h)</SmartText>
                  </View>
                </View>
              </View>
            )}
            
            {/* Learning Objectives */}
            {currentPlan.learningObjectives && currentPlan.learningObjectives.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <AlertCircle size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>Learning Objectives</SmartText>
                </View>
                {currentPlan.learningObjectives.map((obj, index) => (
                  <View key={index} style={styles.objectiveItem}>
                    <View style={styles.objectiveNumber}>
                      <SmartText style={styles.objectiveNumberText}>{index + 1}</SmartText>
                    </View>
                    <SmartText style={styles.objectiveText}>{obj}</SmartText>
                  </View>
                ))}
              </View>
            )}
            
            {/* Curriculum Phases */}
            {currentPlan.curriculumPhases && currentPlan.curriculumPhases.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <BookOpen size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>Curriculum Phases</SmartText>
                </View>
                {currentPlan.curriculumPhases.map((phase, index) => (
                  <View key={index} style={styles.phaseCard}>
                    <View style={styles.phaseHeader}>
                      <SmartText style={styles.phaseNumber}>Phase {phase.phaseNumber}</SmartText>
                      <SmartText style={styles.phaseWeeks}>{phase.weeks} weeks ({phase.weekRange})</SmartText>
                    </View>
                    <SmartText style={styles.phaseName}>{phase.name}</SmartText>
                    <SmartText style={styles.phaseFocus}>{phase.focus}</SmartText>
                    {phase.activities && (
                      <View style={styles.activitiesList}>
                        {phase.activities.map((activity, idx) => (
                          <View key={idx} style={styles.activityTag}>
                            <SmartText style={styles.activityText}>{activity}</SmartText>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Assessment Plan */}
            {currentPlan.assessmentPlan && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <FileText size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>Assessment Strategy</SmartText>
                </View>
                {currentPlan.assessmentPlan.philosophy && (
                  <View style={styles.philosophyBox}>
                    <SmartText style={styles.philosophyText}>{currentPlan.assessmentPlan.philosophy}</SmartText>
                  </View>
                )}
                <View style={styles.assessmentCard}>
                  <View style={styles.assessmentStat}>
                    <SmartText style={styles.assessmentValue}>{currentPlan.assessmentPlan.totalQuizzes}</SmartText>
                    <SmartText style={styles.assessmentLabel}>Total Quizzes</SmartText>
                  </View>
                  <View style={styles.assessmentStat}>
                    <SmartText style={styles.assessmentValue}>{currentPlan.assessmentPlan.questionsPerQuiz}</SmartText>
                    <SmartText style={styles.assessmentLabel}>Questions/Quiz</SmartText>
                  </View>
                </View>
                {currentPlan.assessmentPlan.quizSchedule && currentPlan.assessmentPlan.quizSchedule.length > 0 && (
                  <>
                    <SmartText style={styles.subSectionTitle}>Quiz Schedule</SmartText>
                    {currentPlan.assessmentPlan.quizSchedule.map((quiz, index) => (
                      <View key={index} style={styles.quizItem}>
                        <View style={styles.quizNumber}>
                          <SmartText style={styles.quizNumberText}>{quiz.quizNumber}</SmartText>
                        </View>
                        <View style={styles.quizDetails}>
                          <SmartText style={styles.quizType}>{quiz.type}</SmartText>
                          <SmartText style={styles.quizWeek}>Week {quiz.week} • {quiz.weight}%</SmartText>
                          {quiz.topics && quiz.topics.length > 0 && (
                            <SmartText style={styles.quizTopics}>{quiz.topics.join(', ')}</SmartText>
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}
                {currentPlan.assessmentPlan.gradingBreakdown && (
                  <>
                    <SmartText style={styles.subSectionTitle}>Grading Breakdown</SmartText>
                    <View style={styles.gradingCard}>
                      {Object.entries(currentPlan.assessmentPlan.gradingBreakdown).map(([key, value]) => (
                        <View key={key} style={styles.gradingItem}>
                          <SmartText style={styles.gradingLabel}>{key}:</SmartText>
                          <SmartText style={styles.gradingValue}>{value}%</SmartText>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* AI Recommendations */}
            {currentPlan.recommendations && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <Brain size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>AI Recommendations</SmartText>
                </View>
                {Object.entries(currentPlan.recommendations).map(([category, items]) => 
                  Array.isArray(items) && items.length > 0 ? (
                    <View key={category} style={styles.recommendationGroup}>
                      <SmartText style={styles.recommendationTitle}>{category}</SmartText>
                      {items.map((item, index) => (
                        <View key={index} style={styles.recommendationItem}>
                          <View style={styles.materialBullet} />
                          <SmartText style={styles.materialText}>{item}</SmartText>
                        </View>
                      ))}
                    </View>
                  ) : null
                )}
              </View>
            )}

            {/* Material Suggestions - UPDATED */}
            {currentPlan.materialSuggestions && (
              <View style={styles.planSection}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#4f46e5" />
                  <SmartText style={styles.sectionTitle}>Material Suggestions</SmartText>
                </View>
                
                {/* Core Materials */}
                {currentPlan.materialSuggestions.coreMaterials && currentPlan.materialSuggestions.coreMaterials.length > 0 && (
                  <>
                    <SmartText style={styles.subSectionTitle}>Core Materials</SmartText>
                    {currentPlan.materialSuggestions.coreMaterials.map((material, index) => (
                      <View key={index} style={styles.materialCard}>
                        <View style={styles.materialIcon}>
                          <MaterialCommunityIcons name="book" size={20} color="#4f46e5" />
                        </View>
                        <View style={styles.materialDetails}>
                          <SmartText style={styles.materialType}>{material.type}</SmartText>
                          <SmartText style={styles.materialTitle}>{material.title}</SmartText>
                          <SmartText style={styles.materialAuthor}>By {material.author}</SmartText>
                          <SmartText style={styles.materialRelevance}>{material.relevance}</SmartText>
                          {material.availability && (
                            <SmartText style={styles.materialAvailability}>
                              Available: {material.availability}
                            </SmartText>
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}
                
                {/* Supplementary Materials */}
                {currentPlan.materialSuggestions.supplementaryMaterials && currentPlan.materialSuggestions.supplementaryMaterials.length > 0 && (
                  <>
                    <SmartText style={styles.subSectionTitle}>Supplementary Materials</SmartText>
                    {currentPlan.materialSuggestions.supplementaryMaterials.map((material, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <View style={styles.materialBullet} />
                        <SmartText style={styles.materialText}>{material}</SmartText>
                      </View>
                    ))}
                  </>
                )}
                
                {/* Student Resources */}
                {currentPlan.materialSuggestions.studentResources && currentPlan.materialSuggestions.studentResources.length > 0 && (
                  <>
                    <SmartText style={styles.subSectionTitle}>Student Resources</SmartText>
                    {currentPlan.materialSuggestions.studentResources.map((resource, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <View style={styles.materialBullet} />
                        <SmartText style={styles.materialText}>{resource}</SmartText>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </ScrollView>
          
          {/* UPDATED: Fixed Bottom Button Section */}
          <View style={styles.fixedBottomSection}>
            <LinearGradient
              colors={['#27ae60', '#2ecc71']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bottomButtonGradient}
            >
              <TouchableOpacity 
                style={styles.bottomButton} 
                onPress={handleScheduleQuizzes}
                activeOpacity={0.8}
                disabled={totalQuizzes === 0}
              >
                <MaterialCommunityIcons name="calendar-clock" size={22} color="#fff" />
                <SmartText style={styles.bottomButtonText}>
  {`Schedule and View the ${totalQuizzes} Quizzes Sessions`}
</SmartText>

              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // Unified loading state - UPDATED
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
        <LinearGradient
          colors={["#4f46e5", "#7b84f0", "#2f279e"]}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <View style={styles.lottieContainer}>
              <LottieView
                source={require('../../animations/loading_animation.json')}
                autoPlay
                loop
                style={styles.loadingLottie}
              />
            </View>
            <SmartText style={styles.loadingTitle}>Curriculum Planning</SmartText>
            <SmartText style={styles.loadingSubtitle}>Preparing your workspace...</SmartText>
            <View style={styles.loadingDotsContainer}>
              <View style={[styles.loadingDot, styles.loadingDot1]} />
              <View style={[styles.loadingDot, styles.loadingDot2]} />
              <View style={[styles.loadingDot, styles.loadingDot3]} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (showPlanView && currentPlan) {
    return <PlanDetailsView />;
  }

  // Main screen with modal for configuration
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#4f46e5', "#7b84f0"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <SmartText style={styles.headerTitle}>AI Curriculum Planning</SmartText>
            <SmartText style={styles.headerSubtitle}>{classroom?.name}</SmartText>
          </View>
        </LinearGradient>

        {/* Planning Input Modal */}
        <Modal visible={showPlanModal} animationType="slide" transparent={true} >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <SmartText style={styles.modalTitle}>Configure AI Planning</SmartText>
                <TouchableOpacity onPress={() => { setShowPlanModal(false); router.back(); }}>
                  <X size={24} color="#2c3e50" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {/* Course Description */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.inputLabel}>Course Description</SmartText>
                  <TextInput 
                    style={styles.textArea} 
                    placeholder="Describe the course content, objectives, and main topics..." 
                    multiline 
                    numberOfLines={4} 
                    value={planningInputs.courseDescription} 
                    onChangeText={(text) => setPlanningInputs({...planningInputs, courseDescription: text})} 
                    placeholderTextColor="#95a5a6"
                  />
                </View>

                {/* Course Topics */}
                <View style={styles.inputGroup}>
                  <View style={styles.listHeader}>
                    <SmartText style={styles.inputLabel}>Key Course Topics</SmartText>
                    <TouchableOpacity onPress={addTopicField} style={styles.addButton}>
                      <Plus size={16} color="#4f46e5" />
                    </TouchableOpacity>
                  </View>
                  {planningInputs.courseTopics.map((topic, index) => (
                    <View key={index} style={styles.listItem}>
                      <TextInput
                        style={styles.listInput}
                        placeholder={`Topic ${index + 1}`}
                        value={topic}
                        onChangeText={(text) => updateTopic(index, text)}
                        placeholderTextColor="#95a5a6"
                      />
                      {planningInputs.courseTopics.length > 1 && (
                        <TouchableOpacity onPress={() => removeTopicField(index)} style={styles.removeButton}>
                          <X size={20} color="#e74c3c" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                {/* Learning Objectives */}
                <View style={styles.inputGroup}>
                  <View style={styles.listHeader}>
                    <SmartText style={styles.inputLabel}>Specific Learning Objectives</SmartText>
                    <TouchableOpacity onPress={addObjectiveField} style={styles.addButton}>
                      <Plus size={16} color="#4f46e5" />
                    </TouchableOpacity>
                  </View>
                  {planningInputs.learningObjectives.map((objective, index) => (
                    <View key={index} style={styles.listItem}>
                      <TextInput
                        style={styles.listInput}
                        placeholder={`Objective ${index + 1}`}
                        value={objective}
                        onChangeText={(text) => updateObjective(index, text)}
                        placeholderTextColor="#95a5a6"
                      />
                      {planningInputs.learningObjectives.length > 1 && (
                        <TouchableOpacity onPress={() => removeObjectiveField(index)} style={styles.removeButton}>
                          <X size={20} color="#e74c3c" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                {/* Focus Areas */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.inputLabel}>Primary Focus Areas</SmartText>
                  <View style={styles.checkboxGroup}>
                    {[
                      { value: 'theory', label: 'Core Concepts' },
                      { value: 'practical', label: 'Practical Work' },
                      { value: 'assessment', label: 'Assessment & Evaluation' },
                      { value: 'research', label: 'Research & Projects' }
                    ].map((area) => (
                      <TouchableOpacity 
                        key={area.value} 
                        style={[
                          styles.checkboxItem, 
                          planningInputs.focusAreas.includes(area.value) && styles.checkboxItemActive
                        ]} 
                        onPress={() => toggleFocusArea(area.value)}
                      >
                        <View style={[
                          styles.checkbox, 
                          planningInputs.focusAreas.includes(area.value) && styles.checkboxActive
                        ]}>
                          {planningInputs.focusAreas.includes(area.value) && (
                            <CheckCircle size={16} color="#fff" />
                          )}
                        </View>
                        <SmartText style={[
                          styles.checkboxText, 
                          planningInputs.focusAreas.includes(area.value) && styles.checkboxTextActive
                        ]}>
                          {area.label}
                        </SmartText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Teaching Style */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.inputLabel}>Teaching Style</SmartText>
                  <View style={styles.radioGroup}>
                    {[
                      { value: 'interactive', label: 'Interactive & Engaging' },
                      { value: 'traditional', label: 'Traditional Lecture-based' },
                      { value: 'flipped', label: 'Flipped Classroom' },
                      { value: 'project', label: 'Project-based Learning' }
                    ].map((style) => (
                      <TouchableOpacity 
                        key={style.value} 
                        style={[
                          styles.radioOption, 
                          planningInputs.teachingStyle === style.value && styles.radioOptionActive
                        ]} 
                        onPress={() => setPlanningInputs({...planningInputs, teachingStyle: style.value})}
                      >
                        <View style={[
                          styles.radio, 
                          planningInputs.teachingStyle === style.value && styles.radioActive
                        ]} />
                        <SmartText style={styles.radioText}>{style.label}</SmartText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Additional Context */}
                <View style={styles.inputGroup}>
                  <SmartText style={styles.inputLabel}>Additional Context (Optional)</SmartText>
                  <TextInput 
                    style={styles.textArea} 
                    placeholder="Any specific requirements, constraints, or preferences..." 
                    multiline 
                    numberOfLines={3} 
                    value={planningInputs.additionalContext} 
                    onChangeText={(text) => setPlanningInputs({...planningInputs, additionalContext: text})}
                    placeholderTextColor="#95a5a6"
                  />
                </View>

                {/* Info Box */}
                <View style={styles.infoBox}>
                  <MaterialCommunityIcons name="information-outline" size={24} color="#2196f3" />
                  <SmartText style={styles.infoText}>
                    The AI uses these inputs to generate a comprehensive curriculum plan, including phases, topics, and an assessment schedule.
                  </SmartText>
                </View>
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.generateButton, isProcessing && styles.generateButtonDisabled]} 
                  onPress={handleGeneratePlan}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Brain size={20} color="#fff" />
                      <SmartText style={styles.generateButtonText}>Generate Plan</SmartText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {!classroom?.hasPlan && !showPlanModal && (
          <View style={styles.emptyContainer}>
            <LottieView source={require('../../animations/mini_avatar_glow.json')} autoPlay loop style={styles.emptyLottie} />
            <SmartText style={styles.emptyTitle}>No Curriculum Plan Found</SmartText>
            <SmartText style={styles.emptySubtitle}>
              Generate a new, AI-powered curriculum for this classroom based on your course details and requirements.
            </SmartText>
            <TouchableOpacity 
              style={styles.createPlanButton} 
              onPress={() => setShowPlanModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={24} color="#fff" />
              <SmartText style={styles.createPlanButtonText}>Create New Plan</SmartText>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // General Styles
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // UPDATED Loading Styles (matching professorDashboard)
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: 'center',
  },
  lottieContainer: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },
  loadingLottie: {
    width: '100%',
    height: '100%',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  loadingDot1: {
    backgroundColor: '#fff',
  },
  loadingDot2: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  loadingDot3: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  
  // Header Styles
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
  exportButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Dashboard Styles
  dashboardSection: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginBottom: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  dashboardCard: {
    alignItems: 'center',
    flex: 1,
  },
  dashboardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginVertical: 8,
  },
  dashboardLabel: {
    fontSize: 12,
    color: '#636e72',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Plan Details Styles
  planDetailsContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  planDetailsScrollContent: {
    paddingBottom: 110,
  },
  planSection: {
    padding: 20,
    marginBottom: 2,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 10,
  },
  overviewText: {
    fontSize: 15,
    color: '#636e72',
    lineHeight: 22,
    marginBottom: 20,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 10,
    marginBottom: 10,
  },
  distributionBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 15,
  },
  distributionSegment: {
    height: '100%',
  },
  distributionLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 5,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#636e72',
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  objectiveNumber: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  objectiveNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  objectiveText: {
    flex: 1,
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },
  phaseCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  phaseNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  phaseWeeks: {
    fontSize: 12,
    color: '#636e72',
  },
  phaseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  phaseFocus: {
    fontSize: 13,
    color: '#636e72',
    marginBottom: 12,
    lineHeight: 20,
  },
  activitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27ae60',
  },
  philosophyBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  philosophyText: {
    fontSize: 13,
    color: '#2c3e50',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  assessmentCard: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  assessmentStat: {
    flex: 1,
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  assessmentValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 4,
  },
  assessmentLabel: {
    fontSize: 12,
    color: '#636e72',
    textAlign: 'center',
    fontWeight: '600',
  },
  quizItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  quizNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quizDetails: {
    flex: 1,
  },
  quizType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  quizWeek: {
    fontSize: 13,
    color: '#636e72',
  },
  quizTopics: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
  },
  gradingCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gradingItem: {
    flexDirection: 'row',
    backgroundColor: '#eaf5ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  gradingLabel: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    marginRight: 4,
  },
  gradingValue: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: 'bold',
  },
  recommendationGroup: {
    marginTop: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 10,
  },
  recommendationItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  
  // UPDATED Material Suggestions Styles
  materialCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
  },
  materialIcon: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f3f0ff',
  },
  materialDetails: {
    flex: 1,
  },
  materialType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  materialAuthor: {
    fontSize: 13,
    color: '#636e72',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  materialRelevance: {
    fontSize: 13,
    color: '#2c3e50',
    lineHeight: 19,
    marginBottom: 4,
  },
  materialAvailability: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
    marginTop: 4,
  },
  materialBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4f46e5',
    marginTop: 7,
  },
  materialText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 0,
    overflow: 'hidden',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 15,
    paddingVertical: 16,
    gap: 10,
  },
  generateButtonDisabled: {
    backgroundColor: '#a29bfe',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Input Group Styles
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    borderColor: '#dfe6e9',
    borderWidth: 1,
    textAlignVertical: 'top',
    color: '#2c3e50',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#eaf5ff',
    padding: 8,
    borderRadius: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 15,
    borderColor: '#dfe6e9',
    borderWidth: 1,
    color: '#2c3e50',
  },
  removeButton: {
    padding: 10,
    marginLeft: 10,
  },

  // Checkbox and Radio Styles
  checkboxGroup: {
    gap: 10,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    gap: 12,
  },
  checkboxItemActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#f0ebff',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#dfe6e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  checkboxText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  checkboxTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  radioGroup: {
    gap: 10,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    gap: 12,
  },
  radioOptionActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#f0ebff',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dfe6e9',
  },
  radioActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  radioText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e88e5',
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  emptyLottie: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#636e72',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  createPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    gap: 10,
  },
  createPlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // UPDATED: Fixed Bottom Button Section (matching professorClassrooms)
  fixedBottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    backgroundColor: 'rgba(245, 245, 245, 1)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  bottomButtonGradient: {
    borderRadius: 15,
    shadowColor: "#27ae60",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default PlanifyScreen;