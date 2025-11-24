// Author: John Kokolis <johnk@prosvasis.org>
// License: MIT

let resultsChart = null;

const summaryEl = document.getElementById("results-summary");
const correctBadge = document.getElementById("correct-count");
const incorrectBadge = document.getElementById("incorrect-count");
const missedList = document.getElementById("missed-questions");
const noMistakesNotice = document.getElementById("no-mistakes");
const chartCanvas = document.getElementById("results-chart");

const CHART_COLORS = {
    correct: "#3ecf8e",
    incorrect: "#ff4d61"
};

const ALL_OF_THE_ABOVE_LABEL = "Όλα τα παραπάνω";
const NORMALISED_ALL_OF_THE_ABOVE_LABEL = ALL_OF_THE_ABOVE_LABEL.trim().toLocaleLowerCase("el");
const PARAPANO_SUBSTRING = "παραπάνω";

function formatPercentage(value, total) {
    if (!total) {
        return "0%";
    }
    const percent = Math.round((value / total) * 100);
    return `${percent}%`;
}

function ensureChart() {
    if (resultsChart) {
        return resultsChart;
    }

    const chartContext = chartCanvas.getContext("2d");
    resultsChart = new Chart(chartContext, {
        type: "doughnut",
        data: {
            labels: ["Σωστές", "Λανθασμένες"],
            datasets: [
                {
                    data: [0, 0],
                    backgroundColor: [CHART_COLORS.correct, CHART_COLORS.incorrect],
                    borderWidth: 0,
                    hoverOffset: 14
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: {
                        color: "currentColor",
                        font: {
                            family: "Inter",
                            weight: "600"
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                            const value = context.parsed;
                            const percent = total ? Math.round((value / total) * 100) : 0;
                            return `${context.label}: ${value} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });

    return resultsChart;
}

export function resetResultsView() {
    if (summaryEl) {
        summaryEl.textContent = "";
    }
    if (correctBadge) {
        correctBadge.textContent = "0";
    }
    if (incorrectBadge) {
        incorrectBadge.textContent = "0";
    }
    if (missedList) {
        missedList.innerHTML = "";
    }
    if (noMistakesNotice) {
        noMistakesNotice.hidden = true;
    }
    if (resultsChart) {
        resultsChart.data.datasets[0].data = [0, 0];
        resultsChart.update();
    }
}

export function renderResults({ state, questionsById }) {
    const totalQuestions = state.questionOrder.length;
    let correct = 0;
    const incorrectEntries = [];

    state.questionOrder.forEach((questionId) => {
        const question = questionsById.get(questionId);
        if (!question) {
            return;
        }

        const selectedOptionId = state.answers[questionId];
        const correctOption = question.options.find((option) => option.isCorrect);
        const isCorrect = Boolean(selectedOptionId && correctOption && selectedOptionId === correctOption.id);

        if (isCorrect) {
            correct += 1;
            return;
        }

        incorrectEntries.push({
            question,
            selectedOptionId,
            correctOption,
            order: state.answerOrder?.[questionId]
        });
    });

    const incorrect = totalQuestions - correct;

    const percentage = formatPercentage(correct, totalQuestions);
    if (summaryEl) {
        summaryEl.textContent = `Απαντήσατε σωστά σε ${correct} από ${totalQuestions} ερωτήσεις (${percentage}).`;
    }

    if (correctBadge) {
        correctBadge.textContent = String(correct);
    }

    if (incorrectBadge) {
        incorrectBadge.textContent = String(incorrect);
    }

    const chart = ensureChart();
    chart.data.datasets[0].data = [correct, incorrect];
    chart.update();

    if (!incorrectEntries.length) {
        if (noMistakesNotice) {
            noMistakesNotice.hidden = false;
        }
        return;
    }

    if (noMistakesNotice) {
        noMistakesNotice.hidden = true;
    }

    if (missedList) {
        missedList.innerHTML = "";

        incorrectEntries.forEach(({ question, selectedOptionId, correctOption, order }) => {
            const listItem = document.createElement("li");
            listItem.className = "missed-item";

            const title = document.createElement("p");
            title.className = "missed-item__question";
            title.textContent = getQuestionCopy(question);
            listItem.appendChild(title);

            const answerContainer = document.createElement("div");
            answerContainer.className = "missed-item__answers";

            const storedOrder = Array.isArray(order) && order.length === question.options.length
                ? order
                : question.options.map((option) => option.id);
            const orderedOptionIds = ensureAllOfTheAboveLast(question, storedOrder);

            orderedOptionIds.forEach((optionId) => {
                const option = question.options.find((item) => item.id === optionId);
                if (!option) {
                    return;
                }

                const pill = document.createElement("span");
                let dataType = "";

                if (option.isCorrect) {
                    dataType = "correct";
                }

                if (selectedOptionId && optionId === selectedOptionId) {
                    dataType = option.isCorrect ? "correct" : "chosen";
                }

                if (dataType) {
                    pill.dataset.type = dataType;
                }

                pill.textContent = option.label;
                answerContainer.appendChild(pill);
            });

            listItem.appendChild(answerContainer);

            if (question.support) {
                const support = document.createElement("p");
                support.className = "question-support";
                support.textContent = question.support;
                listItem.appendChild(support);
            }

            missedList.appendChild(listItem);
        });
    }
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
