# Elice practice

Elice-style coding practice with two blocks. **Python** is an editor beside an animated [RoboWorld](https://robo-world-doc.readthedocs.io/en/latest/index.html) grid. **SQL** is the same lesson flow against a small library database.

This is a **frontend-only** Vite + React app. There is no separate backend: Python runs in the browser with Pyodide, and **Explain** is a small Vite middleware that calls OpenAI during `npm run dev` / `npm run preview`.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

- **Run** executes the program and animates Robo
- **Submit** grades the current lesson
- `⌘/Ctrl + Enter` also runs

The first load fetches a Python engine (Pyodide) from a CDN. After that, student code is real Python 3: loops, functions, recursion, and the RoboWorld API.

## SQL block

Switch to **SQL** in the top bar. Lessons use a Kazakhstan library database (`students`, `books`, `loans`) and real SQLite in the browser, loaded the same way as Pyodide. Run shows the result table and the updated database. Submit checks the result, or the table after `INSERT` and `UPDATE`.

## Explain (ChatGPT hints)

Add a `.env` file (see `.env.example`):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Restart `npm run dev`. **Explain** sends the lesson, ASCII map (walls, leaves, stones, robot, goal), student code, professor notes, and console output to ChatGPT and returns a **hint only**, not a full solution.

