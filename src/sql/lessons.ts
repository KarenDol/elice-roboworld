import type { GradeResult } from "../engine/types";
import { expectQuery, gradeAmina, gradeLoanReturned } from "./grade";
import type { SqlOutput } from "./types";

export type SqlLesson = {
  id: string;
  index: number;
  title: string;
  minutes: number;
  goal: string;
  instructions: string[];
  hint: string;
  skeleton: string;
  focus: string[];
  grade: (output: SqlOutput) => GradeResult;
};

export const SQL_REFERENCE = [
  { code: "SELECT col FROM table", label: "read columns" },
  { code: "WHERE condition", label: "keep matching rows" },
  { code: "ORDER BY col", label: "sort the result" },
  { code: "COUNT(*) … GROUP BY", label: "count per group" },
  { code: "JOIN … ON", label: "combine tables" },
  { code: "INSERT INTO … VALUES", label: "add a row" },
  { code: "UPDATE … SET … WHERE", label: "change rows" },
];

const TABLE_INFO = [
  { name: "students", columns: "id, name, year, city" },
  { name: "books", columns: "id, title, author, pages" },
  { name: "loans", columns: "id, student_id, book_id, returned" },
];

export const LIBRARY_SCHEMA = `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  city TEXT NOT NULL
);

INSERT INTO students (id, name, year, city) VALUES
  (1, 'Aigerim', 1, 'Almaty'),
  (2, 'Bekzat', 2, 'Astana'),
  (3, 'Dana', 2, 'Almaty'),
  (4, 'Erlan', 3, 'Shymkent'),
  (5, 'Fariza', 1, 'Astana');

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  pages INTEGER NOT NULL
);

INSERT INTO books (id, title, author, pages) VALUES
  (1, 'Abai Zholy', 'M. Auezov', 180),
  (2, 'Steppe Wind', 'S. Seifullin', 96),
  (3, 'The Nomads', 'I. Esenberlin', 240),
  (4, 'Az i Ya', 'O. Suleimenov', 128);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  returned INTEGER NOT NULL
);

INSERT INTO loans (id, student_id, book_id, returned) VALUES
  (1, 1, 2, 0),
  (2, 2, 1, 1),
  (3, 3, 3, 0),
  (4, 1, 4, 0);
`;

export function lessonTables(lesson: SqlLesson) {
  return lesson.focus
    .map((name) => TABLE_INFO.find((table) => table.name === name))
    .filter((table): table is (typeof TABLE_INFO)[number] => Boolean(table));
}

export const SQL_LESSONS: SqlLesson[] = [
  {
    id: "select-names",
    index: 1,
    title: "First query",
    minutes: 5,
    goal: "List every student name.",
    instructions: [
      "The database on the right is a library in Kazakhstan. Start with the `students` table.",
      "Use `SELECT` to read one column and `FROM` to name the table.",
      "Return only the `name` column, for every row.",
    ],
    hint: `SELECT name
FROM students;`,
    skeleton: `-- List every student name.
SELECT *
FROM students;
`,
    focus: ["students"],
    grade: (output) =>
      expectQuery(
        output,
        ["name"],
        [["Aigerim"], ["Bekzat"], ["Dana"], ["Erlan"], ["Fariza"]],
        false,
        "Correct! Every student name is listed.",
      ),
  },
  {
    id: "where-year",
    index: 2,
    title: "Filtering",
    minutes: 8,
    goal: "Find the year 2 students and show their name and city.",
    instructions: [
      "`WHERE` keeps only the rows that match a condition.",
      "Year 2 students are the ones with `year = 2`.",
      "Return columns `name` and `city`, in that order.",
    ],
    hint: `SELECT name, city
FROM students
WHERE year = 2;`,
    skeleton: `-- Year 2 students: name and city.
SELECT name, city
FROM students;
`,
    focus: ["students"],
    grade: (output) =>
      expectQuery(
        output,
        ["name", "city"],
        [
          ["Bekzat", "Astana"],
          ["Dana", "Almaty"],
        ],
        false,
        "Correct! Those are the year 2 students.",
      ),
  },
  {
    id: "order-pages",
    index: 3,
    title: "Sorting",
    minutes: 8,
    goal: "List book titles and page counts from shortest to longest.",
    instructions: [
      "Read `title` and `pages` from `books`.",
      "`ORDER BY` sorts the result. The default direction is ascending.",
      "The row order matters for this lesson.",
    ],
    hint: `SELECT title, pages
FROM books
ORDER BY pages;`,
    skeleton: `-- Shortest book first.
SELECT title, pages
FROM books;
`,
    focus: ["books"],
    grade: (output) =>
      expectQuery(
        output,
        ["title", "pages"],
        [
          ["Steppe Wind", 96],
          ["Az i Ya", 128],
          ["Abai Zholy", 180],
          ["The Nomads", 240],
        ],
        true,
        "Correct! The books are sorted by length.",
      ),
  },
  {
    id: "group-cities",
    index: 4,
    title: "Aggregates",
    minutes: 10,
    goal: "Count how many students live in each city.",
    instructions: [
      "`COUNT(*)` counts rows. `GROUP BY city` makes one count per city.",
      "Name the count column `n`.",
      "Return `city` and `n`, sorted by city from A to Z.",
    ],
    hint: `SELECT city, COUNT(*) AS n
FROM students
GROUP BY city
ORDER BY city;`,
    skeleton: `-- How many students live in each city?
SELECT city, COUNT(*) AS n
FROM students;
`,
    focus: ["students"],
    grade: (output) =>
      expectQuery(
        output,
        ["city", "n"],
        [
          ["Almaty", 2],
          ["Astana", 2],
          ["Shymkent", 1],
        ],
        true,
        "Correct! The city counts match.",
      ),
  },
  {
    id: "join-loans",
    index: 5,
    title: "Joins",
    minutes: 12,
    goal: "List who still has a book out, and which book it is.",
    instructions: [
      "`returned = 0` means the book is still out. `1` means it was brought back.",
      "Join `loans` to `students` on `student_id`, and to `books` on `book_id`.",
      "Return `name` and `title`, sorted by name, then title.",
    ],
    hint: `SELECT students.name, books.title
FROM loans
JOIN students ON students.id = loans.student_id
JOIN books ON books.id = loans.book_id
WHERE loans.returned = 0
ORDER BY students.name, books.title;`,
    skeleton: `-- Open loans: student name and book title.
SELECT students.name, books.title
FROM loans
JOIN students ON students.id = loans.student_id
JOIN books ON books.id = loans.book_id;
`,
    focus: ["students", "books", "loans"],
    grade: (output) =>
      expectQuery(
        output,
        ["name", "title"],
        [
          ["Aigerim", "Az i Ya"],
          ["Aigerim", "Steppe Wind"],
          ["Dana", "The Nomads"],
        ],
        true,
        "Correct! Those books are still out.",
      ),
  },
  {
    id: "insert-student",
    index: 6,
    title: "Insert",
    minutes: 10,
    goal: "Add Amina to students: year 1, city Karaganda.",
    instructions: [
      "`INSERT INTO students (name, year, city) VALUES (...)` adds one row.",
      "You do not need to set `id`. The table fills it in.",
      "Keep Aigerim, Bekzat, Dana, Erlan, and Fariza. Add only Amina.",
    ],
    hint: `INSERT INTO students (name, year, city)
VALUES ('Amina', 1, 'Karaganda');`,
    skeleton: `-- Add Amina (year 1, city Karaganda).
INSERT INTO students (name, year, city)
VALUES ('Amina', 1, '');
`,
    focus: ["students"],
    grade: gradeAmina,
  },
  {
    id: "update-loan",
    index: 7,
    title: "Update",
    minutes: 10,
    goal: "Mark loan 1 as returned.",
    instructions: [
      "`UPDATE loans SET returned = 1 WHERE id = 1` changes matching rows.",
      "A missing `WHERE` updates every loan. Do not do that.",
      "Leave the other three loans as they are.",
    ],
    hint: `UPDATE loans
SET returned = 1
WHERE id = 1;`,
    skeleton: `-- Mark loan 1 as returned.
UPDATE loans
SET returned = 1;
`,
    focus: ["loans"],
    grade: gradeLoanReturned,
  },
];
