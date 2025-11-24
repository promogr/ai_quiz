# AI Quiz

Interactive web-based quiz covering introductory AI concepts. The app randomizes questions and answers, tracks score locally, and presents a results dashboard with clear feedback.

## Features
- Greek-first interface and messaging with accessible layout.
- Question renderer compatible with legacy `Question` fields or modern `text` fields.
- Automatic shuffling of questions and answers while keeping any option containing "παραπάνω" ("All of the above") in the final position.
- Local storage and cookie support to resume an unfinished quiz session within five hours.
- Results view with doughnut chart, incorrect answer review, and theme toggle (light/dark).

## Quick Start
1. Clone or download this repository.
2. Serve the project over HTTP because the quiz uses ES modules (`js/quiz.js` imports `data/questions.js`). Any static server works; for example run `python3 -m http.server 8000` from the project root.
3. Visit `http://localhost:8000/index.html` in a modern browser (Chrome, Edge, Firefox, Safari), start the quiz, and view the results.

No bundler or build pipeline is required; everything runs in the browser. Chart rendering depends on the [Chart.js](https://www.chartjs.org/) CDN that ships with `index.html`.

## Project Structure
```
index.html             # Main page shell with layout, meta, and theme toggle
css/styles.css         # Visual styling (light/dark themes, layout, animations)
data/questions.js      # Question bank exported as an ES module
js/quiz.js             # Quiz flow, persistence, and rendering logic
js/results.js          # Results dashboard logic and Chart.js integration
images/                # Optional static assets consumed by the page
LICENSE                # MIT License (retain author attribution)
README.md              # Project documentation
```

## Customization
- Replace or extend `data/questions.js` with your own question set. Each option must include a unique `id`, `label`, and a single `isCorrect` flag.
- Update UI copy or localization strings directly within `index.html`, `js/quiz.js`, and `js/results.js`.
- Modify styles in `css/styles.css` to tailor theming beyond the built-in light/dark switch.

## Debugging
- Append `?debugQuestions=10` (or the shorthand `?dq=10`) to limit a session to that many randomly selected questions.
- The active limit is tied to the stored session. After changing or removing the parameter, use **Καθαρισμός προόδου** or delete the `ai-quiz-state-v1` entry in `localStorage` so the new limit takes effect.
- Every new session re-shuffles questions and answers while keeping any "Όλα τα παραπάνω" options last.

## Persistence & Privacy
- Progress, answer order, and theme preference live in `localStorage`. A lightweight cookie keeps the resume option alive for five hours.
- If storage or cookies are unavailable, the UI surfaces a warning and falls back to an in-memory session only.
- Use the **Καθαρισμός προόδου** button or your browser's storage tools to remove saved data at any time.

## License
Released under the [MIT License](LICENSE). You may use, modify, and distribute this project freely, provided you keep the copyright notice and author attribution.
