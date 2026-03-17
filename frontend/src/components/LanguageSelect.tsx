import { LANGUAGES } from '../lib/languages';

interface Props {
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  label?: string;
}

export default function LanguageSelect({ value, onChange, required, label }: Props) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
