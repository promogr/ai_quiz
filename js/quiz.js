// Author: John Kokolis <johnk@prosvasis.org>
// License: MIT

import { questions } from "../data/questions.js";
import { renderResults, resetResultsView } from "./results.js";

const STORAGE_KEY = "ai-quiz-state-v1";
const STATE_VERSION = 1;
const COOKIE_NAME = "aiQuizSession";
const COOKIE_MAX_SECONDS = 60 * 60 * 5; // 5 hours

const questionIds = new Set(questions.map((item) => item.id));
const questionLookup = new Map(questions.map((item) => [item.id, item]));

const ALL_OF_THE_ABOVE_LABEL = "Όλα τα παραπάνω";
const NORMALISED_ALL_OF_THE_ABOVE_LABEL = ALL_OF_THE_ABOVE_LABEL.trim().toLocaleLowerCase("el");
const PARAPANO_SUBSTRING = "παραπάνω";

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
const answerList = document.getElementById("answer-list");

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

function ensureAllOfTheAboveLast(question, optionIds) {
    if (!question || !Array.isArray(optionIds) || !optionIds.length) {
        return optionIds;
    }

    const lower = NORMALISED_ALL_OF_THE_ABOVE_LABEL;
    const substring = PARAPANO_SUBSTRING;
    const allOfTheAboveIds = new Set(
        (question.options || [])
            .filter((option) => {
                if (typeof option.label !== "string") {
                    return false;
                }
                const normalised = option.label.trim().toLocaleLowerCase("el");
                return normalised === lower || normalised.includes(substring);
            })
            .map((option) => option.id)
    );

    if (!allOfTheAboveIds.size) {
        return optionIds;
    }

    const others = [];
    const allOfTheAbove = [];

    optionIds.forEach((id) => {
        if (allOfTheAboveIds.has(id)) {
            allOfTheAbove.push(id);
        } else {
            others.push(id);
        }
    });

    return others.concat(allOfTheAbove);
}

function createInitialState() {
    const questionOrder = shuffle(questions.map((item) => item.id));
    const answerOrder = {};

    questionOrder.forEach((questionId) => {
        const question = questionLookup.get(questionId);
        const optionIds = question ? question.options.map((option) => option.id) : [];
        const shuffled = shuffle(optionIds);
        answerOrder[questionId] = ensureAllOfTheAboveLast(question, shuffled);
    });

    return {
        version: STATE_VERSION,
        questionOrder,
        answerOrder,
        answers: {},
        currentIndex: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        finished: false
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
    if (typeof candidate.answerOrder !== "object" || candidate.answerOrder === null) {
        return false;
    }
    return true;
}

function normaliseState(candidate) {
    const questionOrder = candidate.questionOrder.filter((questionId) => questionIds.has(questionId));
    if (!questionOrder.length) {
        return null;
    }

    const answerOrder = { ...candidate.answerOrder };

    questionOrder.forEach((questionId) => {
        const question = questionLookup.get(questionId);
        if (!question) {
            return;
        }

        const expectedLength = question.options.length;
        const existingOrder = Array.isArray(answerOrder[questionId]) ? answerOrder[questionId] : [];
        const filteredOrder = existingOrder.filter((optionId) => question.options.some((option) => option.id === optionId));

        if (filteredOrder.length === expectedLength) {
            answerOrder[questionId] = ensureAllOfTheAboveLast(question, filteredOrder);
        } else {
            const shuffled = shuffle(question.options.map((option) => option.id));
            answerOrder[questionId] = ensureAllOfTheAboveLast(question, shuffled);
        }
    });

    const answers = {};
    Object.entries(candidate.answers || {}).forEach(([questionId, optionId]) => {
        if (!questionIds.has(questionId)) {
            return;
        }
        answers[questionId] = optionId;
    });

    const currentIndex = Math.min(
        Math.max(Number(candidate.currentIndex) || 0, 0),
        questionOrder.length - 1
    );

    return {
        version: STATE_VERSION,
        questionOrder,
        answerOrder,
        answers,
        currentIndex,
        startedAt: Number(candidate.startedAt) || Date.now(),
        updatedAt: Number(candidate.updatedAt) || Date.now(),
        finished: Boolean(candidate.finished)
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

    if (!answerList) {
        return;
    }

    answerList.innerHTML = "";
    const selectedOptionId = state.answers[currentQuestionId];
    const storedOrder = state.answerOrder?.[currentQuestionId];
    const orderedOptionIds = storedOrder
        ? ensureAllOfTheAboveLast(question, storedOrder)
        : ensureAllOfTheAboveLast(question, question.options.map((option) => option.id));

    state.answerOrder[currentQuestionId] = orderedOptionIds.slice();

    orderedOptionIds.forEach((optionId) => {
        const option = question.options.find((item) => item.id === optionId);
        if (!option) {
            return;
        }

        const listItem = document.createElement("li");
        const label = document.createElement("label");
        label.className = "answer-choice";
        label.tabIndex = 0;
        label.dataset.optionId = option.id;

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "quiz-answer";
        radio.value = option.id;
        radio.checked = option.id === selectedOptionId;

        const copy = document.createElement("div");
        copy.className = "answer-choice__text";

        const text = document.createElement("p");
        text.textContent = option.label;
        copy.appendChild(text);

        label.appendChild(radio);
        label.appendChild(copy);
        listItem.appendChild(label);
        answerList.appendChild(listItem);

        if (radio.checked) {
            label.classList.add("selected");
        }

        radio.addEventListener("change", () => {
            handleAnswerSelection(currentQuestionId, option.id);
        });

        label.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                radio.checked = true;
                handleAnswerSelection(currentQuestionId, option.id);
            }
        });
    });

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
    const hasSelection = Boolean(state.answers[currentQuestionId]);

    if (nextButton) {
        nextButton.hidden = isLastQuestion;
        nextButton.disabled = !hasSelection;
    }

    if (finishButton) {
        finishButton.hidden = !isLastQuestion;
        finishButton.disabled = !hasSelection;
    }
}

function handleAnswerSelection(questionId, optionId) {
    if (!state) {
        return;
    }

    state.answers[questionId] = optionId;
    persistState();

    if (answerList) {
        const choices = answerList.querySelectorAll(".answer-choice");
        choices.forEach((choice) => {
            choice.classList.toggle("selected", choice.dataset.optionId === optionId);
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
    renderResults({ state, questionsById: questionLookup });
    updateResumeVisibility();
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
    if (!questions.length) {
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
        renderResults({ state, questionsById: questionLookup });
    } else {
        showView(introView);
    }

    updateResumeVisibility();
    initialiseTheme();
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
