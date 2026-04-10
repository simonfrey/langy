package api

import "context"

// LanguagePair defines a supported source→target language combination.
type LanguagePair struct {
	SourceLang string `json:"source_lang"`
	TargetLang string `json:"target_lang"`
	SourceName string `json:"source_name"`
	TargetName string `json:"target_name"`
}

// SupportedPairs is the canonical list of language pairs the app supports.
// Each pair must have test coverage in internal/gemini/testdata/.
var SupportedPairs = []LanguagePair{
	{SourceLang: "en", TargetLang: "de", SourceName: "English", TargetName: "German"},
	{SourceLang: "en", TargetLang: "es", SourceName: "English", TargetName: "Spanish"},
	{SourceLang: "en", TargetLang: "fr", SourceName: "English", TargetName: "French"},
	{SourceLang: "en", TargetLang: "ja", SourceName: "English", TargetName: "Japanese"},
	{SourceLang: "de", TargetLang: "en", SourceName: "German", TargetName: "English"},
	{SourceLang: "de", TargetLang: "es", SourceName: "German", TargetName: "Spanish"},
}

func IsValidPair(sourceLang, targetLang string) bool {
	for _, p := range SupportedPairs {
		if p.SourceLang == sourceLang && p.TargetLang == targetLang {
			return true
		}
	}
	return false
}

func (s *Server) ListLanguagePairs(_ context.Context, _ ListLanguagePairsRequestObject) (ListLanguagePairsResponseObject, error) {
	pairs := make([]LanguagePairResponse, len(SupportedPairs))
	for i, p := range SupportedPairs {
		pairs[i] = LanguagePairResponse{
			SourceLang: p.SourceLang,
			TargetLang: p.TargetLang,
			SourceName: p.SourceName,
			TargetName: p.TargetName,
		}
	}
	return ListLanguagePairs200JSONResponse(pairs), nil
}
