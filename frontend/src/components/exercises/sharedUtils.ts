export function normalizeBlankChars(s: string): string {
  return s.replace(/[—–―＿]/g, "_");
}

export function promptHasBlank(prompt: string): boolean {
  const normalized = normalizeBlankChars(prompt).replace(/_[\s_]*_/g, "_");
  return normalized.includes("_");
}

export function exerciseNeedsBlanks(type: string): boolean {
  const TYPES_WITHOUT_BLANKS = new Set([
    "full_translation",
    "error_correction",
    "tense_shifting",
    "article_check",
    "morphing",
    "grammar_error_correction",
    "grammar_transformation",
    "grammar_conjugation_drill",
    "vocab_matching_pairs",
    "vocab_picture_word",
    "grammar_categorization",
    "grammar_matching",
    "integrative_reading",
  ]);
  return !TYPES_WITHOUT_BLANKS.has(type);
}

export function exerciseUsesCustomUI(type: string): boolean {
  const CUSTOM_UI_TYPES = new Set([
    "vocab_matching_pairs",
    "vocab_word_bank",
    "vocab_picture_word",
    "grammar_reorder",
    "grammar_multiple_choice",
    "grammar_categorization",
    "grammar_matching",
    "integrative_reading",
    "word_order_scramble",
  ]);
  return CUSTOM_UI_TYPES.has(type);
}
