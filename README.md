# AI Quiz

Interactive web-based quiz covering introductory AI concepts. The app randomizes questions and answers, tracks score locally, and presents a results dashboard with clear feedback.

## Features
- Greek-first interface and messaging with accessible layout.
- Question renderer compatible with legacy `Question` fields or modern `text` fields.
- Automatic shuffling of questions and answers while keeping any option containing "παραπάνω" ("All of the above") in the final position.
- Local storage and cookie support to resume an unfinished quiz session within five hours.
- Results view with doughnut chart, incorrect answer review, and theme toggle (light/dark).

## Getting Started
1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
3. Start the quiz, answer each question, and view the results summary.

No build step or external tooling is required; the project runs entirely in the browser. Chart rendering depends on the [Chart.js](https://www.chartjs.org/) CDN included in `index.html`.

## Project Structure
```
index.html        # Main page shell and layout
css/styles.css    # Visual styling (not included above)
js/quiz.js        # Quiz flow, persistence, and rendering
js/results.js     # Results dashboard logic and chart integration
data/questions.js # Question bank consumed by the quiz (expected)
LICENSE           # MIT License (retain author attribution)
README.md         # Project documentation
```

## Customization
- Replace or extend `data/questions.js` with your own question set. Each option must include a unique `id`, `label`, and `isCorrect` flag.
- Update UI copy or localization strings directly within `index.html`, `js/quiz.js`, and `js/results.js`.
- Modify styles in `css/styles.css` to adjust theming beyond the built-in light/dark switch.

## License
Released under the [MIT License](LICENSE). You may use, modify, and distribute this project freely, provided you keep the copyright notice and author attribution.
