import { RATING_LABELS, type Rating } from '../lib/taste';

const OPTIONS: Rating[] = [1, 3, 5];

export function RatingPicker({ value, onChange }: { value: Rating | null; onChange: (r: Rating) => void }) {
  return (
    <div className="rating" role="radiogroup" aria-label="Оценка блюда">
      {OPTIONS.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          className={`rating-opt r${r}${value === r ? ' on' : ''}`}
          onClick={() => onChange(r)}
        >
          <span className="rating-face" aria-hidden>{r === 1 ? '−' : r === 3 ? '=' : '+'}</span>
          {RATING_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
