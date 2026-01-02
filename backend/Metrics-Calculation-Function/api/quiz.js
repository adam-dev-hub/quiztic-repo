import { Client, Databases, Query, ID } from "node-appwrite";

export default async function handler(arg1, arg2) {
  let req, res, log, error;
  if (arg1 && arg1.headers) {
    req = arg1;
    res = arg2;
  } else {
    ({ req, res, log, error } = arg1 || {});
  }
  if (!req || !res) {
    console.error("Invalid function call — req/res not found");
    return;
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // --- Auth ---
    const authHeader = req.headers?.authorization || "";
    const expectedAuth =
      "Basic " +
      Buffer.from("qapp.farjeoui:**Authcode**").toString("base64");
    if (authHeader !== expectedAuth)
      return res.status(401).json({ error: "Unauthorized" });

    // --- Parse body ---
    let submission;
    try {
      submission =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const {
      quiz_id,
      student_id,
      session_id,
      score,
      time_taken,
      question_difficulty,
      is_timeout,
      question_id,
      question_time_limit,
    } = submission;

    // --- Basic validation ---
    if (!quiz_id || !student_id || !question_id || score == null) {
      return res
        .status(400)
        .json({ error: "Incomplete submission, skipping metrics" });
    }

    // --- Get active quiz config ---
    const activeQuizResponse = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.ACTIVE_QUIZ_COLLECTION_ID,
      [Query.equal("quiz_id", quiz_id), Query.limit(1)]
    );

    let timeLimit = 30; // fallback
    if (activeQuizResponse.total > 0) {
      const activeQuiz = activeQuizResponse.documents[0];
      try {
        const config =
          typeof activeQuiz.config === "string"
            ? JSON.parse(activeQuiz.config)
            : activeQuiz.config;
        timeLimit = config.timePerQuestion || 30;
      } catch (configError) {
        console.log(
          "Failed to parse config, using default timeLimit:",
          configError
        );
      }
    }
    timeLimit = question_time_limit || timeLimit;

    // --- Metrics calculation ---
    const time = parseFloat(time_taken) || 0;
    const difficulty = parseFloat(question_difficulty) || 1;
    const accuracy = score === "1" ? 1 : 0;

    const speed = Math.max(0, Math.min(1, 1 - time / timeLimit));

    // Concentration
    let concentrationIndex =
      accuracy * 0.5 +
      speed * 0.3 +
      (Math.min(difficulty, 3) / 3) * 0.2;
    if (is_timeout) concentrationIndex *= 0.9;
    concentrationIndex = Math.round(concentrationIndex * 100);

    // Hesitation
    const hesitationIndex =
      speed < 0.3 ? Math.round((1 - speed) * 80) : 0;

    // Rush
    const rushIndex =
      !is_timeout && time < timeLimit * 0.2 && accuracy === 0
        ? Math.round(
            ((timeLimit * 0.2 - time) / (timeLimit * 0.2)) * 100
          )
        : 0;

    // --- Helpers ---
    const buildLast5 = (prevStr) => {
      let arr = [];
      try {
        if (prevStr) arr = JSON.parse(prevStr);
      } catch {}
      arr = [
        ...arr,
        {
          isCorrect: accuracy === 1,
          timeRatio: time / timeLimit,
          difficulty: difficulty,
        },
      ].slice(-5);
      let s = JSON.stringify(arr);
      while (s.length > 950 && arr.length > 0) {
        arr.shift();
        s = JSON.stringify(arr);
      }
      return s;
    };

    const deriveLabel = (last5Str) => {
      let last5 = [];
      try {
        if (last5Str) last5 = JSON.parse(last5Str);
      } catch {}
      if (last5.length < 2) return "N/A"; // not enough data

      const recentCorrectRate =
        last5.filter((q) => q.isCorrect).length / last5.length;
      const avgConcentration = concentrationIndex;

      if (avgConcentration >= 80 && recentCorrectRate >= 0.8)
        return "Excellent";
      if (
        avgConcentration >= 70 ||
        (recentCorrectRate >= 0.8 && avgConcentration >= 60)
      )
        return "Improving";
      if (avgConcentration >= 50 && recentCorrectRate >= 0.6)
        return "Consistent";
      if (
        hesitationIndex > 50 ||
        (recentCorrectRate < 0.4 && avgConcentration < 50)
      )
        return "Struggling";
      if (rushIndex > 40) return "Rushing";
      if (avgConcentration < 30) return "Distracted";
      return "Average";
    };

    // --- Upsert student metrics ---
    const existing = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.STUDENT_METRICS_COLLECTION_ID,
      [
        Query.equal("quizId", quiz_id),
        Query.equal("studentId", student_id),
        Query.orderDesc("$updatedAt"),
        Query.limit(1),
      ]
    );

    let updatedMetricsDoc;
    if (existing.total > 0) {
      const prev = existing.documents[0];
      const newLast5 = buildLast5(
        prev.last5QuestionsPerformance || "[]"
      );

      updatedMetricsDoc = await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.STUDENT_METRICS_COLLECTION_ID,
        prev.$id,
        {
          concentrationIndex,
          hesitationIndex,
          rushIndex,
          questionsAnswered: (prev.questionsAnswered || 0) + 1,
          last5QuestionsPerformance: newLast5,
          performanceStatusLabel: deriveLabel(newLast5),
          sessionId: session_id || prev.sessionId || "",
        }
      );
    } else {
      // Create only when a real answer is submitted
      const newLast5 = buildLast5("[]");
      updatedMetricsDoc = await databases.createDocument(
        process.env.DATABASE_ID,
        process.env.STUDENT_METRICS_COLLECTION_ID,
        ID.unique(),
        {
          quizId: quiz_id,
          studentId: student_id,
          sessionId: session_id || "",
          concentrationIndex,
          hesitationIndex,
          rushIndex,
          questionsAnswered: 1,
          last5QuestionsPerformance: newLast5,
          performanceStatusLabel: deriveLabel(newLast5),
        }
      );
    }

    // --- Pull latest metrics per student ---
    const allMetrics = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.STUDENT_METRICS_COLLECTION_ID,
      [Query.equal("quizId", quiz_id), Query.limit(2000)]
    );

    const latestByStudent = {};
    for (const doc of allMetrics.documents) {
      const key = doc.studentId;
      if (
        !latestByStudent[key] ||
        new Date(doc.$updatedAt) >
          new Date(latestByStudent[key].$updatedAt)
      ) {
        latestByStudent[key] = doc;
      }
    }
    const latestDocs = Object.values(latestByStudent).filter(
      (d) => (d.questionsAnswered || 0) > 0
    ); // ignore empty

    const totalStudents = latestDocs.length || 1;

    // --- Class averages ---
    const avgConcentration =
      latestDocs.reduce(
        (s, d) => s + (d.concentrationIndex || 0),
        0
      ) / totalStudents;
    const avgHesitation =
      latestDocs.reduce(
        (s, d) => s + (d.hesitationIndex || 0),
        0
      ) / totalStudents;
    const avgRush =
      latestDocs.reduce((s, d) => s + (d.rushIndex || 0), 0) /
      totalStudents;

    // --- Rankings ---
    const ranked = [...latestDocs].sort(
      (a, b) =>
        (b.concentrationIndex || 0) -
        (a.concentrationIndex || 0)
    );
    const mostPerformant = ranked[0]?.studentId || null;
    const leastPerformant =
      ranked[ranked.length - 1]?.studentId || null;

    // --- Distribution bins ---
    const bins = {
      Excellent: 0,
      Improving: 0,
      Consistent: 0,
      Average: 0,
      Struggling: 0,
      Rushing: 0,
      Distracted: 0,
      "N/A": 0,
    };
    for (const d of latestDocs) {
      const status = d.performanceStatusLabel || "N/A";
      if (bins.hasOwnProperty(status)) bins[status]++;
      else bins["Average"]++;
    }
    const performanceStatus = JSON.stringify(bins);

    // --- Update all docs with class stats ---
    await Promise.all(
      allMetrics.documents.map((doc) =>
        databases.updateDocument(
          process.env.DATABASE_ID,
          process.env.STUDENT_METRICS_COLLECTION_ID,
          doc.$id,
          {
            classAvgConcentration: Math.round(avgConcentration),
            classAvgHesitation: Math.round(avgHesitation),
            classAvgRush: Math.round(avgRush),
            mostPerformantStudentId: mostPerformant,
            leastPerformantStudentId: leastPerformant,
            performanceStatus,
          }
        )
      )
    );

    // --- Generate pedagogical tips ---
    let tipType = null, tipText = null, tipStudentId = null;
    
    if (is_timeout) {
      tipType = "timeout";
      tipText = "Student timed out - consider extending time or providing guidance.";
      tipStudentId = student_id;
    } else if (hesitationIndex > 60 && accuracy === 0) {
      tipType = "struggling";
      tipText = "Student struggling - took long to answer and got it wrong.";
      tipStudentId = student_id;
    } else if (rushIndex > 40 && accuracy === 0) {
      tipType = "rushing";
      tipText = "Student rushing through questions - encourage careful reading.";
      tipStudentId = student_id;
    } else if (concentrationIndex < 30) {
      tipType = "distraction";
      tipText = "Student shows signs of distraction - low concentration score.";
      tipStudentId = student_id;
    }

    // --- Question-level difficulty signal ---
    const questionSubs = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.SUBMISSIONS_COLLECTION_ID,
      [
        Query.equal("question_id", question_id),
        Query.equal("quiz_id", quiz_id),
        Query.limit(2000)
      ]
    );

    if (questionSubs.total >= 3) {
      const incorrectRate = questionSubs.documents.filter(s => s.score === "0").length / questionSubs.total;
      const avgTimeQ = questionSubs.documents.reduce((sum, s) => sum + (parseFloat(s.time_taken) || 0), 0) / questionSubs.total;
      
      if (incorrectRate > 0.6) {
        if (incorrectRate > 0.8 && avgTimeQ < timeLimit * 0.2) {
          tipType = "question_misposed";
          tipText = `Question ${question_id.slice(0, 6)} may be unclear - ${(incorrectRate * 100).toFixed(0)}% wrong, answered very quickly.`;
          tipStudentId = null;
        } else {
          tipType = incorrectRate > 0.75 ? "widespread_difficulty_hard" : "widespread_difficulty";
          tipText = `Question ${question_id.slice(0, 6)}: ${(incorrectRate * 100).toFixed(0)}% of students struggling.`;
          tipStudentId = null;
        }
      }
    }

    // --- Save pedagogical tip if generated ---
    if (tipType && tipText) {
      await databases.createDocument(
        process.env.DATABASE_ID,
        process.env.PEDAGOGICAL_TIPS_COLLECTION_ID,
        ID.unique(),
        {
          quizId: quiz_id,
          studentId: tipStudentId || "",
          tipType,
          tipText,
          timestamp: new Date().toISOString(),
          sessionId: session_id || ""
        }
      );
    }

    return res.json({
      success: true,
      updatedStudent: updatedMetricsDoc.$id,
      classAvgConcentration: avgConcentration,
      mostPerformant,
      leastPerformant,
      debug: {
        concentrationIndex,
        hesitationIndex,
        rushIndex,
        speed,
        timeLimit,
        accuracy,
      },
    });
  } catch (err) {
    if (typeof error === "function") error(err.message);
    else console.error(err);
    return res.json({ error: err.message }, 500);
  }
}
