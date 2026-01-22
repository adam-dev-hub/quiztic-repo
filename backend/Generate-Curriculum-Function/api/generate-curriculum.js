// /api/generate-curriculum.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client, Databases, Query } from 'node-appwrite';

// Initialize Appwrite Client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const CLASSROOMS_COLLECTION_ID = 'professor_classrooms';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    classroomId,
    professorId,
    courseDescription,
    learningObjectives,
    additionalContext,
    focusAreas,
    teachingStyle,
    courseTopics
  } = req.body;

  // Validation
  if (!classroomId || !professorId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'classroomId and professorId are required' 
    });
  }

  try {
    // Step 1: Fetch classroom data from Appwrite
    console.log(`Fetching classroom: ${classroomId}`);
    
    const classroom = await databases.getDocument(
      DATABASE_ID,
      CLASSROOMS_COLLECTION_ID,
      classroomId
    );

    // Verify professor ownership
    if (classroom.professorId !== professorId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        details: 'You do not have permission to access this classroom' 
      });
    }

    // Parse JSON fields
    const schedule = typeof classroom.schedule === 'string' 
      ? JSON.parse(classroom.schedule) 
      : classroom.schedule;

    // Step 2: Build classroom data object
    const classroomData = {
      id: classroom.$id,
      name: classroom.name,
      code: classroom.classCode,
      department: classroom.department,
      studyLevel: classroom.studyLevel,
      semester: classroom.semester,
      academicYear: classroom.academicYear,
      studentCount: classroom.studentCount,
      schedule: schedule,
      room: classroom.room,
      description: classroom.description,
      maxStudents: classroom.maxStudents
    };

    console.log('Classroom data retrieved:', {
      name: classroomData.name,
      studentCount: classroomData.studentCount,
      semester: classroomData.semester
    });

    // Step 3: Generate curriculum with AI
    const prompt = buildCurriculumPrompt({
      classroomData,
      courseDescription: courseDescription || classroomData.description,
      learningObjectives,
      additionalContext,
      focusAreas: focusAreas || ['theory', 'practical', 'assessment'],
      teachingStyle: teachingStyle || 'interactive',
      courseTopics
    });

    console.log('Generating curriculum with AI...');

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    });

    const responseText = result.response.text();
    console.log('AI response received, length:', responseText.length);

    let curriculumPlan;
    try {
      // Try to parse the JSON
      curriculumPlan = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response snippet:', responseText.substring(0, 500));
      console.error('Error position:', parseError.message);
      
      // Try to fix common JSON issues
      try {
        // Remove any trailing commas before closing brackets/braces
        let fixedJson = responseText
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/\n/g, ' ')             // Replace newlines
          .replace(/\r/g, '')              // Remove carriage returns
          .trim();
        
        // Try to find where the JSON actually ends
        let lastValidBrace = fixedJson.lastIndexOf('}');
        if (lastValidBrace > 0) {
          fixedJson = fixedJson.substring(0, lastValidBrace + 1);
        }
        
        curriculumPlan = JSON.parse(fixedJson);
        console.log('Successfully parsed after cleanup');
      } catch (secondError) {
        console.error('Still failed after cleanup:', secondError);
        
        // Last resort: try to extract valid JSON using regex
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let extractedJson = jsonMatch[0]
              .replace(/,(\s*[}\]])/g, '$1');
            curriculumPlan = JSON.parse(extractedJson);
            console.log('Successfully extracted and parsed JSON');
          } else {
            throw new Error('Could not extract valid JSON from response');
          }
        } catch (finalError) {
          return res.status(500).json({
            error: 'Invalid AI response format',
            details: 'The AI generated invalid JSON that could not be fixed',
            parseError: parseError.message,
            snippet: responseText.substring(Math.max(0, parseError.message.match(/\d+/)?.[0] - 100), 
                                          Math.min(responseText.length, parseError.message.match(/\d+/)?.[0] + 100))
          });
        }
      }
    }

    // Step 4: Validate and enhance the response
    const validatedPlan = validateCurriculumStructure(curriculumPlan, classroomData);

    console.log('Curriculum generated successfully');

    return res.status(200).json({
      success: true,
      plan: validatedPlan,
      metadata: {
        classroomId: classroomData.id,
        classroomName: classroomData.name,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Curriculum generation error:", error);
    
    if (error.code === 404) {
      return res.status(404).json({
        error: 'Classroom not found',
        details: 'The specified classroom does not exist'
      });
    }

    if (error.message?.includes('Appwrite')) {
      return res.status(500).json({
        error: 'Database connection error',
        details: 'Failed to retrieve classroom data'
      });
    }

    return res.status(500).json({
      error: 'Failed to generate curriculum',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function buildCurriculumPrompt(data) {
  const { 
    classroomData, 
    courseDescription, 
    learningObjectives, 
    additionalContext, 
    focusAreas, 
    teachingStyle,
    courseTopics 
  } = data;
  
  const totalWeeks = classroomData.semester === 'Full Year' ? 30 : 
                     classroomData.semester === 'S1' || classroomData.semester === 'S2' ? 15 : 15;
  const weeklyHours = calculateWeeklyHours(classroomData.schedule);
  const totalHours = weeklyHours * totalWeeks;
  
  const sessionTiming = analyzeSessionTiming(classroomData.schedule);
  const scheduleDescription = formatSchedule(classroomData.schedule);

  return `You are an expert educational curriculum designer. Generate a comprehensive curriculum plan in VALID JSON format.

CLASSROOM CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Course: ${classroomData.name} (${classroomData.code})
🎓 Level: ${classroomData.studyLevel} - ${classroomData.department}
👥 Students: ${classroomData.studentCount}
⏱️  Duration: ${totalWeeks} weeks
📅 Weekly Hours: ${weeklyHours.toFixed(1)}h
🕐 Total Hours: ${totalHours}h
📆 Semester: ${classroomData.semester}

SCHEDULE:
${scheduleDescription}

COURSE DETAILS:
${courseDescription || 'Infer from course name'}
${courseTopics && courseTopics.length > 0 ? `\nTopics: ${courseTopics.join(', ')}` : ''}
${learningObjectives && learningObjectives.length > 0 && learningObjectives[0] ? `\nObjectives: ${learningObjectives.join(', ')}` : ''}

PREFERENCES:
- Focus: ${focusAreas.join(', ')}
- Style: ${teachingStyle}
${additionalContext ? `- Notes: ${additionalContext}` : ''}

CRITICAL: Generate ONLY valid JSON. Ensure:
1. No trailing commas before ] or }
2. All strings properly escaped
3. All arrays and objects properly closed
4. No comments in JSON
5. All property names in double quotes

Generate this EXACT structure with ALL fields present:

{
  "overview": {
    "totalWeeks": ${totalWeeks},
    "totalHours": ${totalHours},
    "weeklyHours": ${weeklyHours.toFixed(1)},
    "lectureHours": <number>,
    "practicalHours": <number>,
    "assessmentHours": <number>,
    "effectivenessScore": <number 0-100>,
    "rationale": "<string: 2-3 sentences>"
  },
  "learningObjectives": [
    "<string: objective 1>",
    "<string: objective 2>",
    "<string: objective 3>",
    "<string: objective 4>",
    "<string: objective 5>"
  ],
  "curriculumPhases": [
    {
      "phaseNumber": 1,
      "name": "<string>",
      "weeks": <number>,
      "weekRange": "<string: e.g. 1-5>",
      "focus": "<string>",
      "activities": ["<string>", "<string>"],
      "milestones": ["<string>", "<string>"]
    },
    {
      "phaseNumber": 2,
      "name": "<string>",
      "weeks": <number>,
      "weekRange": "<string>",
      "focus": "<string>",
      "activities": ["<string>", "<string>"],
      "milestones": ["<string>", "<string>"]
    },
    {
      "phaseNumber": 3,
      "name": "<string>",
      "weeks": <number>,
      "weekRange": "<string>",
      "focus": "<string>",
      "activities": ["<string>", "<string>"],
      "milestones": ["<string>", "<string>"]
    }
  ],
  "assessmentPlan": {
    "philosophy": "<string: 2-3 sentences>",
    "totalQuizzes": <number: 3-8>,
    "questionsPerQuiz": <number: 15-25>,
    "quizSchedule": [
      {
        "quizNumber": 1,
        "week": <number>,
        "type": "Diagnostic",
        "topics": ["<string>"],
        "estimatedDuration": "<string>",
        "weight": <number>
      }
    ],
    "projects": [
      {
        "title": "<string>",
        "assignedWeek": <number>,
        "dueWeek": <number>,
        "description": "<string>",
        "weight": <number>,
        "groupWork": <boolean>,
        "deliverables": ["<string>"]
      }
    ],
    "gradingBreakdown": {
      "quizzes": <number>,
      "projects": <number>,
      "finalExam": <number>,
      "participation": <number>
    },
    "rubrics": {
      "quizzes": "<string>",
      "projects": "<string>"
    }
  },
  "teachingStrategies": [
    {
      "strategy": "<string>",
      "implementation": "<string>",
      "benefits": "<string>",
      "frequency": "<string>"
    }
  ],
  "recommendations": {
    "pedagogical": ["<string>", "<string>"],
    "engagement": ["<string>", "<string>"],
    "timing": ["<string>", "<string>"],
    "adaptation": ["<string>", "<string>"],
    "technology": ["<string>", "<string>"]
  },
  "materialSuggestions": {
    "coreMaterials": [
      {
        "type": "Textbook",
        "title": "<string>",
        "author": "<string>",
        "relevance": "<string>",
        "availability": "<string>"
      }
    ],
    "supplementaryMaterials": ["<string>", "<string>"],
    "studentResources": ["<string>", "<string>"]
  },
  "contingencyPlans": {
    "behindSchedule": "<string: detailed strategy>",
    "aheadSchedule": "<string: enrichment activities>",
    "lowEngagement": "<string: engagement strategies>",
    "difficultTopics": ["<string>", "<string>"]
  }
}

IMPORTANT RULES:
1. Schedule quizzes AFTER teaching topics (never week 1 unless diagnostic)
2. Distribute workload evenly
3. Include review before assessments
4. Build progressive difficulty
5. Consider ${classroomData.studentCount} students for activity sizing
6. Match session types to schedule: ${sessionTiming.types.join(', ')}
7. ENSURE ALL JSON IS VALID - no trailing commas, all brackets closed

Generate comprehensive, realistic plan now:`;
}

function calculateWeeklyHours(schedule) {
  if (!schedule || typeof schedule !== 'object') return 0;
  
  let totalMinutes = 0;
  Object.values(schedule).forEach(sessions => {
    if (!Array.isArray(sessions)) return;
    sessions.forEach(session => {
      if (!session.start || !session.end) return;
      const [startH, startM] = session.start.split(':').map(Number);
      const [endH, endM] = session.end.split(':').map(Number);
      totalMinutes += (endH * 60 + endM) - (startH * 60 + startM);
    });
  });
  return totalMinutes / 60;
}

function analyzeSessionTiming(schedule) {
  if (!schedule || typeof schedule !== 'object') {
    return {
      times: 'various',
      types: [],
      daysPerWeek: 0,
      description: 'No schedule information available.'
    };
  }

  const sessions = [];
  const types = new Set();
  
  Object.entries(schedule).forEach(([day, daySessions]) => {
    if (!Array.isArray(daySessions)) return;
    daySessions.forEach(session => {
      const hour = parseInt(session.start.split(':')[0]);
      sessions.push({ day, hour, type: session.type });
      types.add(session.type);
    });
  });
  
  if (sessions.length === 0) {
    return {
      times: 'not specified',
      types: [],
      daysPerWeek: 0,
      description: 'No specific schedule provided.'
    };
  }

  const avgHour = sessions.reduce((sum, s) => sum + s.hour, 0) / sessions.length;
  const timing = avgHour < 12 ? 'morning' : avgHour < 15 ? 'early afternoon' : 'late afternoon';
  
  return {
    times: timing,
    types: Array.from(types),
    daysPerWeek: Object.keys(schedule).length,
    description: `Sessions in ${timing}`
  };
}

function formatSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return 'No schedule';
  
  const dayNames = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
  };

  let formatted = '';
  Object.entries(schedule).forEach(([day, sessions]) => {
    if (!Array.isArray(sessions) || sessions.length === 0) return;
    formatted += `${dayNames[day] || day}: `;
    formatted += sessions.map(s => `${s.start}-${s.end} (${s.type})`).join(', ');
    formatted += '\n';
  });
  
  return formatted || 'No schedule';
}

function validateCurriculumStructure(plan, classroomData) {
  // Ensure all required fields exist with defaults
  const validated = {
    overview: plan.overview || {
      totalWeeks: 15,
      totalHours: 0,
      weeklyHours: 0,
      lectureHours: 0,
      practicalHours: 0,
      assessmentHours: 0,
      effectivenessScore: 75,
      rationale: 'Generated curriculum plan'
    },
    learningObjectives: plan.learningObjectives || [],
    curriculumPhases: plan.curriculumPhases || [],
    weeklyBreakdown: plan.weeklyBreakdown || [],
    assessmentPlan: plan.assessmentPlan || {
      philosophy: 'Balanced assessment approach',
      totalQuizzes: 4,
      questionsPerQuiz: 20,
      quizSchedule: [],
      projects: [],
      gradingBreakdown: { quizzes: 40, projects: 30, finalExam: 30, participation: 0 },
      rubrics: { quizzes: 'Standard grading', projects: 'Rubric-based' }
    },
    teachingStrategies: plan.teachingStrategies || [],
    recommendations: plan.recommendations || {
      pedagogical: [],
      engagement: [],
      timing: [],
      adaptation: [],
      technology: []
    },
    materialSuggestions: plan.materialSuggestions || {
      coreMaterials: [],
      supplementaryMaterials: [],
      studentResources: []
    },
    contingencyPlans: plan.contingencyPlans || {
      behindSchedule: 'Adjust pacing as needed',
      aheadSchedule: 'Add enrichment activities',
      lowEngagement: 'Increase interactivity',
      difficultTopics: []
    },
    generatedAt: new Date().toISOString(),
    version: '1.0',
    classroomId: classroomData.id,
    metadata: {
      totalWeeks: plan.overview?.totalWeeks || 15,
      totalHours: plan.overview?.totalHours || 0,
      studentCount: classroomData.studentCount,
      studyLevel: classroomData.studyLevel
    }
  };

  // Validate effectiveness score
  if (validated.overview.effectivenessScore) {
    validated.overview.effectivenessScore = Math.min(100, Math.max(0, validated.overview.effectivenessScore));
  }

  // Ensure grading breakdown sums to 100
  if (validated.assessmentPlan.gradingBreakdown) {
    const breakdown = validated.assessmentPlan.gradingBreakdown;
    const total = Object.values(breakdown).reduce((sum, val) => sum + (Number(val) || 0), 0);
    if (total !== 100 && total > 0) {
      // Normalize to 100
      const factor = 100 / total;
      Object.keys(breakdown).forEach(key => {
        breakdown[key] = Math.round(breakdown[key] * factor);
      });
    }
  }

  return validated;
}
