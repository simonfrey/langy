import type { LanguagePairResponse } from "../api";

const FLAGS: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  es: "\u{1F1EA}\u{1F1F8}",
  fr: "\u{1F1EB}\u{1F1F7}",
  de: "\u{1F1E9}\u{1F1EA}",
  ja: "\u{1F1EF}\u{1F1F5}",
};

function flagForCode(code: string): string {
  return FLAGS[code] ?? "";
}

export function formatLanguage(code: string, name?: string): string {
  const flag = flagForCode(code);
  return flag ? `${flag} ${name ?? code}` : name ?? code;
}

export function formatPair(pair: LanguagePairResponse): string {
  return `${formatLanguage(pair.source_lang, pair.source_name)} \u2192 ${formatLanguage(pair.target_lang, pair.target_name)}`;
}
