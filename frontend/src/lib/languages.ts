export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "sk", name: "Slovak", flag: "🇸🇰" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" },
  { code: "hr", name: "Croatian", flag: "🇭🇷" },
  { code: "sr", name: "Serbian", flag: "🇷🇸" },
  { code: "sl", name: "Slovenian", flag: "🇸🇮" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "fa", name: "Persian", flag: "🇮🇷" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", flag: "🇧🇩" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "fil", name: "Filipino", flag: "🇵🇭" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "et", name: "Estonian", flag: "🇪🇪" },
  { code: "lv", name: "Latvian", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" },
  { code: "ka", name: "Georgian", flag: "🇬🇪" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
] as const;

function getLanguage(code: string) {
  return LANGUAGES.find((l) => l.code === code);
}

export function formatLanguage(code: string): string {
  const lang = getLanguage(code);
  return lang ? `${lang.flag} ${lang.name}` : code;
}
