import { Client, Databases, ID, Query } from 'node-appwrite';
import { Formidable } from 'formidable';
import { promises as fs } from 'fs';
import pdf from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
// --- REMOVED TOP-LEVEL IMPORT OF `franc` ---

// --- INITIALIZE CLIENTS ---
// Initialize Appwrite Client (for server-side operations)
const appwriteClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

// Initialize Google Generative AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- APPWRITE CONFIGURATION ---
const DATABASE_ID = "685ae2ba0012dcb2feda";
const QUIZ_INFO_COLLECTION_ID = "686315a2000c31e99790";
const QUESTIONS_COLLECTION_ID = "68764f2a001a9f312389";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action } = req.query;

    try {
        switch (action) {
            case 'generate':
                return await handleQuizGeneration(req, res);
            case 'enhance':
                return await handleQuestionEnhancement(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action specified' });
        }
    } catch (error) {
        console.error(`Error processing action "${action}":`, error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}

async function handleQuizGeneration(req, res) {
    // 1. Parse Form Data
    const { fields, files } = await parseFormData(req);
    const quizId = fields.quizId?.[0];
    const pdfFile = files.pdf?.[0];
    const numQuestionsField = fields.numQuestions?.[0];

    if (!quizId || !pdfFile) {
        return res.status(400).json({ error: 'quizId and a PDF file are required.' });
    }

    // 2. Fetch Quiz Details
    const quizDetails = await databases.getDocument(DATABASE_ID, QUIZ_INFO_COLLECTION_ID, quizId);
    const numQuestions = numQuestionsField ? Number(numQuestionsField) : quizDetails['quiz-nb-question'];

    // 3. Fetch already added questions for this quiz
    const existingQuestionsResponse = await databases.listDocuments(
        DATABASE_ID,
        QUESTIONS_COLLECTION_ID,
        [Query.equal('quiz_id', quizId)]
    );
    const existingQuestions = existingQuestionsResponse.documents || [];
    const existingTexts = existingQuestions.map(q => q.question);

    // 4. Extract Text from PDF
    const pdfBuffer = await fs.readFile(pdfFile.filepath);
    const pdfData = await pdf(pdfBuffer);
    const content = pdfData.text;
    await fs.unlink(pdfFile.filepath); // Clean up

    // 5. Detect PDF language (DYNAMIC IMPORT)
    const { franc } = await import('franc');
    const langCode = franc(content.substring(0, 4000));
    let language = 'English';
    if (langCode === 'fra') language = 'French';
    else if (langCode === 'ara') language = 'Arabic';

    // 6. Generate Questions with AI
    const prompt = `
        Generate exactly ${numQuestions} quiz questions based on the following content.
        The questions must be written in ${language}.
        Do NOT repeat or closely paraphrase any of these existing questions: ${JSON.stringify(existingTexts, null, 2)}
        Include a diverse set of question types (Multiple Choice, True/False, Fill-in-the-blank, Ordering).
        Return the result as a valid JSON array. Each object in the array must follow these structures:

        For Multiple Choice, True/False:
        {
            "question_type": "Multiple Choice" | "True/False",
            "question": "...",
            "options": { "A": "...", "B": "...", "C": "...", "D": "..." } | {}, 
            "correct_option": "...",
            "explanation": "...",
            "difficulty": "Easy" | "Medium" | "Hard"
        }

          **For Fill-in-the-blank, you MUST represent the blank with exactly four underscores (\`____\`).**
        {
            "question_type": "Fill-in-the-blank",
            "question": "The capital of France is ____.",
            "options": {},
            "correct_option": "Paris",
            "explanation": "...",
            "difficulty": "Easy" | "Medium" | "Hard"
        }

        For Ordering questions:
        {
            "question_type": "Ordering",
            "question": "...",
            "ordering_items": ["item1", "item2", "item3", ...],
            "correct_option": "item1,item2,item3,...",
            "explanation": "...",
            "difficulty": "Easy" | "Medium" | "Hard"
        }

        Content:
        ${content.substring(0, 4000)}
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const generatedJson = result.response.text();
    console.log("AI Raw Response (handleQuizGeneration):", generatedJson);

    let questions;
    try {
        questions = JSON.parse(generatedJson);
    } catch (parseError) {
        console.error("Failed to parse AI generated JSON:", parseError);
        console.error("Malformed JSON received:", generatedJson);
        return res.status(500).json({
            error: "Failed to parse AI response. The AI returned invalid JSON.",
            details: parseError.message,
            aiOutputSnippet: generatedJson.substring(0, Math.min(generatedJson.length, 500)) + (generatedJson.length > 500 ? "..." : "")
        });
    }

    // ✅ FIX: Convert Ordering questions to use 'ordering_items'
    if (Array.isArray(questions)) {
        questions = questions.map(q => {
            if (q.question_type === "Ordering") {
                if (Array.isArray(q.options)) {
                    q.ordering_items = q.options;
                    q.options = ""; // Clear or omit 'options' for ordering
                }
            }
            return q;
        });
    }

    // 7. Return to Client
    return res.status(200).json(questions);
}

function parseFormData(req) {
    const form = new Formidable();
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
        });
    });
}
