// Author: John Kokolis <johnk@prosvasis.org>
// License: MIT
// Repository: https://github.com/promogr/ai_quiz

import { questionsYesNo } from "../data/questions_yesno.js";
import { renderResults, resetResultsView } from "./results.js";

const STORAGE_KEY = "ai-quiz-yesno-state-v1";
const STATE_VERSION = 1;
const COOKIE_NAME = "aiQuizYesNoSession";
const COOKIE_MAX_SECONDS = 60 * 60 * 5; // 5 hours

const questionIds = new Set(questionsYesNo.map((item) => item.id));
const questionLookup = new Map(questionsYesNo.map((item) => [item.id, item]));

const debugQuestionLimit = getDebugQuestionLimit();

if (typeof debugQuestionLimit === "number" && debugQuestionLimit > 0) {
    console.info(`[AI Quiz YesNo] Ενεργοποιήθηκε λειτουργία debug· χρήση ${debugQuestionLimit} ερωτήσεων.`);
}

const startButton = document.getElementById("start-quiz");
const resumeButton = document.getElementById("resume-quiz");
const nextButton = document.getElementById("next-question");
const finishButton = document.getElementById("finish-quiz");
const retakeButton = document.getElementById("retake-quiz");
const clearButton = document.getElementById("clear-progress");
const storageBanner = document.getElementById("storage-warning");
const themeToggleSwitch = document.getElementById("theme-toggle-switch");

const introView = document.getElementById("intro-view");
const quizView = document.getElementById("quiz-view");
const resultsView = document.getElementById("results-view");

const progressLabel = document.getElementById("progress-index");
const progressBar = document.querySelector(".progress-bar");
const progressBarFill = document.getElementById("progress-bar-fill");

const questionText = document.getElementById("question-text");
const questionSupport = document.getElementById("question-support");
const answerButtons = document.getElementById("answer-buttons");

const body = document.body;

let state = null;
let storageAvailable = detectStorage("localStorage");
let cookieAvailable = detectCookieSupport();

if (!storageAvailable) {
    showStorageWarning("Η αποθήκευση δεν είναι διαθέσιμη· η πρόοδος δεν θα αποθηκευτεί.");
} else if (!cookieAvailable) {
    showStorageWarning("Τα cookies είναι απενεργοποιημένα· η πρόοδος θα παραμείνει έως ότου την διαγράψετε χειροκίνητα.");
}

function detectStorage(type) {
    try {
        const storage = window[type];
        const testKey = "__quiz_test__";
        storage.setItem(testKey, "1");
        storage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn("Storage unavailable:", error);
        return false;
    }
}

function detectCookieSupport() {
    try {
        document.cookie = "quiz_cookie_test=1; path=/; max-age=5";
        const supported = document.cookie.includes("quiz_cookie_test=");
        document.cookie = "quiz_cookie_test=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return supported;
    } catch (error) {
        console.warn("Cookies unavailable:", error);
        return false;
    }
}

function getDebugQuestionLimit() {
    try {
        const params = new URLSearchParams(window.location.search);
        const value = params.get("debugQuestions") || params.get("dq");
        if (!value) {
            return null;
        }
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn("Failed to parse debugQuestions parameter:", error);
        return null;
    }
}

function showStorageWarning(message) {
    if (!storageBanner) return;
    storageBanner.hidden = false;
    storageBanner.textContent = message;
}

function hideStorageWarning() {
    if (storageBanner) {
        storageBanner.hidden = true;
    }
}

function setCookie(name, value, maxAgeSeconds) {
    if (!cookieAvailable) return;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
}

function getCookie(name) {
    if (!cookieAvailable) return null;
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split("=");
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}

function deleteCookie(name) {
    if (!cookieAvailable) return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function createInitialState() {
    const shuffledQuestions = shuffle(questionsYesNo.map((item) => item.id));
    const limit = typeof debugQuestionLimit === "number" && debugQuestionLimit > 0
        ? Math.min(debugQuestionLimit, shuffledQuestions.length)
        : null;
    const questionOrder = limit ? shuffledQuestions.slice(0, limit) : shuffledQuestions;

    return {
        version: STATE_VERSION,
        questionOrder,
        answers: {},
        currentIndex: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        finished: false,
        debugLimit: limit ?? null
    };
}

function persistState() {
    if (!storageAvailable || !state) {
        return;
    }
    try {
        const snapshot = {
            ...state,
            version: STATE_VERSION,
            updatedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        state.updatedAt = snapshot.updatedAt;
        if (cookieAvailable) {
            setCookie(COOKIE_NAME, "active", COOKIE_MAX_SECONDS);
        }
    } catch (error) {
        console.warn("Failed to persist state:", error);
        storageAvailable = false;
        showStorageWarning("Η αποθήκευση δεν είναι διαθέσιμη· η πρόοδος δεν θα αποθηκευτεί.");
    }
}

function clearStoredState() {
    if (storageAvailable) {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn("Failed clearing stored state:", error);
        }
    }
    deleteCookie(COOKIE_NAME);
}

function loadState() {
    if (!storageAvailable) {
        return null;
    }

    if (cookieAvailable && !getCookie(COOKIE_NAME)) {
        clearStoredState();
        return null;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!validateState(parsed)) {
            clearStoredState();
            return null;
        }
        const normalised = normaliseState(parsed);
        if (!normalised) {
            clearStoredState();
            return null;
        }
        return normalised;
    } catch (error) {
        console.warn("Failed to load stored state:", error);
        clearStoredState();
        return null;
    }
}

function validateState(candidate) {
    if (!candidate || typeof candidate !== "object") {
        return false;
    }
    if (!Array.isArray(candidate.questionOrder) || candidate.questionOrder.length === 0) {
        return false;
    }
    const allQuestionsExist = candidate.questionOrder.every((questionId) => questionIds.has(questionId));
    if (!allQuestionsExist) {
        return false;
    }
    if (typeof candidate.currentIndex !== "number") {
        return false;
    }
    if (typeof candidate.answers !== "object" || candidate.answers === null) {
        return false;
    }
    return true;
}

function normaliseState(candidate) {
    const currentLimit = typeof debugQuestionLimit === "number" && debugQuestionLimit > 0
        ? Math.min(debugQuestionLimit, questionsYesNo.length)
        : null;
    const storedLimit = typeof candidate.debugLimit === "number" && candidate.debugLimit > 0
        ? Math.min(candidate.debugLimit, questionsYesNo.length)
        : null;

    if (storedLimit !== currentLimit) {
        return null;
    }

    let questionOrder = candidate.questionOrder.filter((questionId) => questionIds.has(questionId));

    const limitToApply = storedLimit ?? currentLimit;
    if (typeof limitToApply === "number" && limitToApply > 0) {
        questionOrder = questionOrder.slice(0, Math.min(limitToApply, questionOrder.length));
    }

    if (!questionOrder.length) {
        return null;
    }

    const answers = {};
    const allowedQuestionIds = new Set(questionOrder);
    Object.entries(candidate.answers || {}).forEach(([questionId, answer]) => {
        if (!allowedQuestionIds.has(questionId)) {
            return;
        }
        answers[questionId] = answer;
    });

    const currentIndex = Math.min(
        Math.max(Number(candidate.currentIndex) || 0, 0),
        questionOrder.length - 1
    );

    return {
        version: STATE_VERSION,
        questionOrder,
        answers,
        currentIndex,
        startedAt: Number(candidate.startedAt) || Date.now(),
        updatedAt: Number(candidate.updatedAt) || Date.now(),
        finished: Boolean(candidate.finished),
        debugLimit: limitToApply ?? null
    };
}

function renderQuestion() {
    if (!state) {
        return;
    }

    const totalQuestions = state.questionOrder.length;
    if (totalQuestions === 0) {
        return;
    }

    const currentQuestionId = state.questionOrder[state.currentIndex];
    const question = questionLookup.get(currentQuestionId);

    if (!question) {
        return;
    }

    const currentPosition = state.currentIndex + 1;
    if (progressLabel) {
        progressLabel.textContent = `Ερώτηση ${currentPosition} από ${totalQuestions}`;
    }

    if (progressBarFill && totalQuestions > 0) {
        const progressPercent = Math.round((state.currentIndex / totalQuestions) * 100);
        progressBarFill.style.width = `${progressPercent}%`;
        if (progressBar) {
            progressBar.setAttribute("aria-valuenow", String(progressPercent));
        }
    }

    if (questionText) {
        questionText.textContent = getQuestionCopy(question);
    }

    if (questionSupport) {
        if (question.support) {
            questionSupport.hidden = false;
            questionSupport.textContent = question.support;
        } else {
            questionSupport.hidden = true;
            questionSupport.textContent = "";
        }
    }

    // Update button states
    if (answerButtons) {
        const buttons = answerButtons.querySelectorAll('.btn--answer');
        const selectedAnswer = state.answers[currentQuestionId];
        
        buttons.forEach((button) => {
            const answer = button.dataset.answer;
            if ((answer === 'yes' && selectedAnswer === true) || 
                (answer === 'no' && selectedAnswer === false)) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    }

    updateNavigationButtons();
}

function getQuestionCopy(question) {
    if (!question) {
        return "";
    }

    const direct = typeof question.text === "string" ? question.text.trim() : "";
    if (direct) {
        return direct;
    }

    const legacy = typeof question.Question === "string" ? question.Question.trim() : "";
    if (legacy) {
        return legacy;
    }

    return "";
}

function updateNavigationButtons() {
    if (!state) {
        return;
    }
    const totalQuestions = state.questionOrder.length;
    const isLastQuestion = state.currentIndex === totalQuestions - 1;
    const currentQuestionId = state.questionOrder[state.currentIndex];
    const hasSelection = state.answers[currentQuestionId] !== undefined;

    if (nextButton) {
        nextButton.hidden = isLastQuestion;
        nextButton.disabled = !hasSelection;
    }

    if (finishButton) {
        finishButton.hidden = !isLastQuestion;
        finishButton.disabled = !hasSelection;
    }
}

function handleAnswerSelection(answer) {
    if (!state) {
        return;
    }

    const currentQuestionId = state.questionOrder[state.currentIndex];
    state.answers[currentQuestionId] = answer;
    persistState();

    // Update button visual states
    if (answerButtons) {
        const buttons = answerButtons.querySelectorAll('.btn--answer');
        buttons.forEach((button) => {
            const btnAnswer = button.dataset.answer;
            if ((btnAnswer === 'yes' && answer === true) || 
                (btnAnswer === 'no' && answer === false)) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    }

    updateNavigationButtons();
}

function showView(target) {
    introView.hidden = target !== introView;
    quizView.hidden = target !== quizView;
    resultsView.hidden = target !== resultsView;
}

function startNewSession() {
    state = createInitialState();
    persistState();
    resetResultsView();
    showView(quizView);
    renderQuestion();
    updateResumeVisibility();
}

function resumeSession() {
    if (!state) {
        return startNewSession();
    }
    showView(quizView);
    renderQuestion();
    updateResumeVisibility();
}

function handleNextQuestion() {
    if (!state) {
        return;
    }
    if (state.currentIndex < state.questionOrder.length - 1) {
        state.currentIndex += 1;
        persistState();
        renderQuestion();
    }
}

function handleFinishQuiz() {
    if (!state) {
        return;
    }

    state.finished = true;
    persistState();

    if (progressBarFill) {
        progressBarFill.style.width = "100%";
    }
    if (progressBar) {
        progressBar.setAttribute("aria-valuenow", "100");
    }

    showView(resultsView);
    renderResultsYesNo();
    updateResumeVisibility();
}

function renderResultsYesNo() {
    if (!state) {
        return;
    }

    let correctCount = 0;
    let incorrectCount = 0;
    const missedQuestions = [];

    state.questionOrder.forEach((questionId) => {
        const question = questionLookup.get(questionId);
        const userAnswer = state.answers[questionId];
        
        if (question && userAnswer !== undefined) {
            if (userAnswer === question.correctAnswer) {
                correctCount++;
            } else {
                incorrectCount++;
                missedQuestions.push({
                    question: getQuestionCopy(question),
                    userAnswer: userAnswer ? "ΝΑΙ" : "ΟΧΙ",
                    correctAnswer: question.correctAnswer ? "ΝΑΙ" : "ΟΧΙ"
                });
            }
        }
    });

    // Update summary
    const resultsSummary = document.getElementById("results-summary");
    if (resultsSummary) {
        const totalQuestions = state.questionOrder.length;
        const percentage = Math.round((correctCount / totalQuestions) * 100);
        resultsSummary.textContent = `Απαντήσατε σωστά σε ${correctCount} από ${totalQuestions} ερωτήσεις (${percentage}%)`;
    }

    // Update counts
    const correctCountEl = document.getElementById("correct-count");
    const incorrectCountEl = document.getElementById("incorrect-count");
    if (correctCountEl) correctCountEl.textContent = correctCount;
    if (incorrectCountEl) incorrectCountEl.textContent = incorrectCount;

    // Render chart
    const chartCanvas = document.getElementById("results-chart");
    if (chartCanvas && window.Chart) {
        const existingChart = window.Chart.getChart(chartCanvas);
        if (existingChart) {
            existingChart.destroy();
        }

        new window.Chart(chartCanvas, {
            type: "doughnut",
            data: {
                labels: ["Σωστές", "Λανθασμένες"],
                datasets: [{
                    data: [correctCount, incorrectCount],
                    backgroundColor: ["#3ecf8e", "#e74c3c"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            padding: 20,
                            font: {
                                size: 14,
                                family: "Inter, sans-serif"
                            }
                        }
                    }
                }
            }
        });
    }

    // Render missed questions
    const noMistakes = document.getElementById("no-mistakes");
    const missedQuestionsList = document.getElementById("missed-questions");
    
    if (missedQuestions.length === 0) {
        if (noMistakes) noMistakes.hidden = false;
        if (missedQuestionsList) missedQuestionsList.innerHTML = "";
    } else {
        if (noMistakes) noMistakes.hidden = true;
        if (missedQuestionsList) {
            missedQuestionsList.innerHTML = "";
            missedQuestions.forEach((item) => {
                const li = document.createElement("li");
                li.className = "missed-question";
                
                const questionP = document.createElement("p");
                questionP.className = "missed-question__text";
                questionP.textContent = item.question;
                
                const answersDiv = document.createElement("div");
                answersDiv.className = "missed-question__answers";
                
                const userAnswerP = document.createElement("p");
                userAnswerP.className = "user-answer-wrong";
                userAnswerP.innerHTML = `<span class="answer-icon">✗</span> <strong>Η απάντησή σας:</strong> <span class="answer-value">${item.userAnswer}</span>`;
                
                const correctAnswerP = document.createElement("p");
                correctAnswerP.className = "correct-answer-highlight";
                correctAnswerP.innerHTML = `<span class="answer-icon">✓</span> <strong>Σωστή απάντηση:</strong> <span class="answer-value">${item.correctAnswer}</span>`;
                
                answersDiv.appendChild(userAnswerP);
                answersDiv.appendChild(correctAnswerP);
                
                li.appendChild(questionP);
                li.appendChild(answersDiv);
                missedQuestionsList.appendChild(li);
            });
        }
    }
}

function handleRetakeQuiz() {
    startNewSession();
}

function handleClearProgress() {
    clearStoredState();
    resetResultsView();
    state = null;
    updateResumeVisibility();
    showView(introView);
}

function updateResumeVisibility() {
    if (!resumeButton) {
        return;
    }
    const stored = loadState();
    const canResume = Boolean(stored && !stored.finished);
    resumeButton.hidden = !canResume;
}

function initialiseTheme() {
    const storedTheme = getStoredTheme();
    const effectiveTheme = storedTheme || "light";
    applyTheme(effectiveTheme);
    if (themeToggleSwitch) {
        themeToggleSwitch.checked = effectiveTheme === "dark";
    }
}

function applyTheme(theme) {
    if (!body) {
        return;
    }
    body.setAttribute("data-theme", theme);
    storeThemePreference(theme);
}

function getStoredTheme() {
    if (!storageAvailable) {
        return null;
    }
    try {
        return localStorage.getItem("ai-quiz-theme");
    } catch (error) {
        return null;
    }
}

function storeThemePreference(theme) {
    if (!storageAvailable) {
        return;
    }
    try {
        localStorage.setItem("ai-quiz-theme", theme);
    } catch (error) {
        console.warn("Failed to store theme preference:", error);
    }
}

function initialise() {
    if (!questionsYesNo.length) {
        if (startButton) {
            startButton.disabled = true;
        }
        if (resumeButton) {
            resumeButton.hidden = true;
        }
        showStorageWarning("Προσθέστε ερωτήσεις κουίζ για να ξεκινήσετε.");
        return;
    }

    state = loadState();

    if (state && state.finished) {
        showView(resultsView);
        renderResultsYesNo();
    } else {
        showView(introView);
    }

    updateResumeVisibility();
    initialiseTheme();

    // Setup answer button listeners
    if (answerButtons) {
        const yesButton = answerButtons.querySelector('[data-answer="yes"]');
        const noButton = answerButtons.querySelector('[data-answer="no"]');
        
        if (yesButton) {
            yesButton.addEventListener('click', () => handleAnswerSelection(true));
        }
        if (noButton) {
            noButton.addEventListener('click', () => handleAnswerSelection(false));
        }
    }
}

if (startButton) {
    startButton.addEventListener("click", () => {
        startNewSession();
    });
}

if (resumeButton) {
    resumeButton.addEventListener("click", () => {
        const stored = loadState();
        if (stored) {
            state = stored;
        } else if (!state) {
            state = createInitialState();
        }
        resumeSession();
    });
}

if (nextButton) {
    nextButton.addEventListener("click", () => {
        handleNextQuestion();
    });
}

if (finishButton) {
    finishButton.addEventListener("click", () => {
        handleFinishQuiz();
    });
}

if (retakeButton) {
    retakeButton.addEventListener("click", () => {
        handleRetakeQuiz();
    });
}

if (clearButton) {
    clearButton.addEventListener("click", () => {
        handleClearProgress();
    });
}

if (themeToggleSwitch) {
    themeToggleSwitch.addEventListener("change", (event) => {
        const theme = event.target.checked ? "dark" : "light";
        applyTheme(theme);
    });
}

initialise();
