type Problem = {
  index: number;
  minutes: number;
  title: string;
  goal: string;
  instructions: string[];
  hint: string;
};

type ReferenceItem = {
  code: string;
  label: string;
};

type TableNote = {
  name: string;
  columns: string;
};

type Props = {
  lesson: Problem;
  hintOpen: boolean;
  onToggleHint: () => void;
  tables?: TableNote[];
  referenceTitle?: string;
  reference?: ReferenceItem[];
};

function rich(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>
    ) : (
      <span key={`${index}-${part}`}>{part}</span>
    ),
  );
}

export function ProblemPanel({
  lesson,
  hintOpen,
  onToggleHint,
  tables,
  referenceTitle = "SQL",
  reference,
}: Props) {
  return (
    <div className="problem">
      <div className="problem-kicker">
        <span>Lesson {String(lesson.index).padStart(2, "0")}</span>
        <span className="dot">·</span>
        <span>{lesson.minutes} min</span>
      </div>
      <h1>{lesson.title}</h1>
      <section>
        <h2>Goal</h2>
        <p>{rich(lesson.goal)}</p>
      </section>
      <section>
        <h2>Instructions</h2>
        <ol>
          {lesson.instructions.map((item) => (
            <li key={item}>{rich(item)}</li>
          ))}
        </ol>
      </section>
      {tables && tables.length > 0 ? (
        <section className="api">
          <h2>Tables</h2>
          <ul>
            {tables.map((table) => (
              <li key={table.name}>
                <code>{table.name}</code> {table.columns}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {reference ? (
        <section className="api">
          <h2>{referenceTitle}</h2>
          <ul>
            {reference.map((item) => (
              <li key={item.code}>
                <code>{item.code}</code> {item.label}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="api">
        <h2>Robo API</h2>
        <ul>
          <li>
            <code>robo.move()</code> step forward
          </li>
          <li>
            <code>robo.turn_left()</code> turn 90° left
          </li>
          <li>
            <code>robo.is_wall_in_front()</code> wall ahead?
          </li>
          <li>
            <code>robo.is_at_goal()</code> standing on the goal?
          </li>
          <li>
            <code>robo.take_leaf()</code> / <code>put_leaf()</code>
          </li>
          <li>
            <code>robo.take_stone_in_front()</code>
          </li>
        </ul>
        </section>
      )}
      <button type="button" className="hint-btn" onClick={onToggleHint}>
        {hintOpen ? "Hide hint" : "Show hint"}
      </button>
      {hintOpen ? <pre className="hint">{lesson.hint}</pre> : null}
    </div>
  );
}
