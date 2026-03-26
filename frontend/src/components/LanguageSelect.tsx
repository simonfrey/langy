import { LANGUAGES } from "../lib/languages";

interface Props {
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  label?: string;
}

export default function LanguageSelect({
  value,
  onChange,
  required,
  label,
}: Props) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-warm-700 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 focus:outline-none focus:ring-2 focus:ring-coral"
      >
        <option value="">Select language</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
