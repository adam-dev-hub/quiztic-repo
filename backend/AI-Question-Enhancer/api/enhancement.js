const { GoogleGenerativeAI } = require('@google/generative-ai');
// Initialize Google Generative AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { questionObject, userPrompt } = req.body;

  if (!questionObject || !userPrompt) {
    return res.status(400).json({ error: 'Missing questionObject or userPrompt' });
  }

  try {
    const prompt = `
You are a highly precise AI assistant that improves quiz questions for a learning platform.
Given an original question object and a user enhancement request, generate a complete and enhanced version of the question, strictly matching this schema:

{
  "question_type": "Multiple Choice" | "True/False" | "Fill-in-the-blank" | "Ordering",
  "question": "string - the question text",
  "options": "stringified JSON - must be a valid JSON string. For Multiple Choice: '{\"A\": \"Option 1\", \"B\": \"Option 2\"}', for Ordering: '[\"Step 1\", \"Step 2\"]', or empty string if not applicable",
  "correct_option": "string - the correct answer or correct order (e.g., 'A' or '1,2,3')",
  "explanation": "string - optional explanation",
  "difficulty": "Easy" | "Medium" | "Hard"
}

Make sure:
- All fields are present.
- "options" is always a **string**, even if empty or originally an object.
- Structure is strict and valid JSON.

Original Question:
${JSON.stringify(questionObject, null, 2)}

User Request:
"${userPrompt}"

Return ONLY the updated question object in JSON format:
`;

    // Call Gemini API
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json" // This ensures the model returns valid JSON
      }
    });

    const content = result.response.text(); // Extract the text content from the response

    let newQuestion;
    try {
      newQuestion = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse AI response:", err);
      return res.status(500).json({
        error: "Invalid JSON from AI",
        details: err.message,
        aiOutputSnippet: content.substring(0, Math.min(content.length, 500)) + (content.length > 500 ? "..." : "")
      });
    }

    // ✅ Ensure options is a string
    // This logic is still relevant as the model might output an object for options
    // even with responseMimeType: "application/json" if the schema isn't strict enough
    // or if it misinterprets the "stringified JSON" instruction.
    if (newQuestion.options && typeof newQuestion.options !== 'string') {
      newQuestion.options = JSON.stringify(newQuestion.options);
    }

    // ✅ Ensure explanation exists (optional field)
    if (!newQuestion.explanation) {
      newQuestion.explanation = '';
    }

    // ✅ Safety fallback: trim long correct_option
    newQuestion.correct_option = String(newQuestion.correct_option).slice(0, 1000);

    // This block handles the transformation for 'Ordering' questions,
    // ensuring 'ordering_items' is used and 'options' is cleared.
    if (newQuestion.question_type === 'Ordering' && Array.isArray(newQuestion.options)) {
      newQuestion.ordering_items = newQuestion.options;
      newQuestion.options = '';
    } else if (newQuestion.question_type === 'Ordering' && typeof newQuestion.options === 'string') {
        // If options is already a string (e.g., "[\"item1\", \"item2\"]"), parse it
        try {
            const parsedOptions = JSON.parse(newQuestion.options);
            if (Array.isArray(parsedOptions)) {
                newQuestion.ordering_items = parsedOptions;
                newQuestion.options = '';
            }
        } catch (e) {
            console.warn("Could not parse options string for Ordering question:", e);
            // Fallback if parsing fails, keep options as is or handle error
        }
    }


    return res.status(200).json(newQuestion);

  } catch (error) {
    console.error("Enhancement error:", error);
    return res.status(500).json({
      error: 'Failed to enhance question',
      details: error.message,
    });
  }
}
