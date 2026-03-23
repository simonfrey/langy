package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/middleware"
)

type ExercisesHandler struct {
	Gemini *gemini.Client
}

type exerciseGenerateRequest struct {
	Cards      []gemini.ExerciseCard `json:"cards"`
	SourceLang string                `json:"source_lang"`
	TargetLang string                `json:"target_lang"`
}

type exerciseGradeRequest struct {
	ExerciseType  string `json:"exercise_type"`
	Prompt        string `json:"prompt"`
	CorrectAnswer string `json:"correct_answer"`
	UserAnswer    string `json:"user_answer"`
	SourceLang    string `json:"source_lang"`
	TargetLang    string `json:"target_lang"`
}

func (h *ExercisesHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req exerciseGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Cards) == 0 || req.SourceLang == "" || req.TargetLang == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cards, source_lang, and target_lang required"})
		return
	}

	exercises, err := h.Gemini.GenerateExercises(r.Context(), req.Cards, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to generate exercises", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate exercises"})
		return
	}

	slog.Info("generated exercises", "user_id", userID, "count", len(exercises))
	writeJSON(w, http.StatusOK, exercises)
}

func (h *ExercisesHandler) Grade(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req exerciseGradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.UserAnswer == "" || req.CorrectAnswer == "" || req.SourceLang == "" || req.TargetLang == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_answer, correct_answer, source_lang, and target_lang required"})
		return
	}

	result, err := h.Gemini.GradeExercise(r.Context(), req.ExerciseType, req.Prompt, req.CorrectAnswer, req.UserAnswer, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to grade exercise", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to grade exercise"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}
