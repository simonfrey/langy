package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/middleware"
)

type ExercisesHandler struct {
	Gemini *gemini.Client
	DB     *db.DB
}

type exerciseGenerateRequest struct {
	SessionID  string                `json:"session_id"`
	Cards      []gemini.ExerciseCard `json:"cards"`
	KnownWords []gemini.KnownWord    `json:"known_words"`
	SourceLang string                `json:"source_lang"`
	TargetLang string                `json:"target_lang"`
}

type exerciseGradeRequest struct {
	ExerciseID    string `json:"exercise_id"`
	ExerciseType  string `json:"exercise_type"`
	Prompt        string `json:"prompt"`
	CorrectAnswer string `json:"correct_answer"`
	UserAnswer    string `json:"user_answer"`
	SourceLang    string `json:"source_lang"`
	TargetLang    string `json:"target_lang"`
}

type exerciseResponse struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Level          int      `json:"level"`
	Instruction    string   `json:"instruction"`
	Prompt         string   `json:"prompt"`
	CorrectAnswer  string   `json:"correct_answer"`
	Hint           string   `json:"hint,omitempty"`
	SourceSentence string   `json:"source_sentence,omitempty"`
	Options        []string `json:"options,omitempty"`
	SourceCardID   string   `json:"source_card_id"`
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

	exercises, err := h.Gemini.GenerateExercises(r.Context(), req.Cards, req.KnownWords, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to generate exercises", "error", err, "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate exercises"})
		return
	}

	// Save to DB
	dbExercises := make([]db.Exercise, 0, len(exercises))
	for _, ex := range exercises {
		var optionsJSON []byte
		if len(ex.Options) > 0 {
			optionsJSON, _ = json.Marshal(ex.Options)
		}
		hint := ex.Hint
		sourceSentence := ex.SourceSentence
		dbEx := db.Exercise{
			SessionID:     req.SessionID,
			SourceCardID:  ex.SourceCardID,
			Type:          ex.Type,
			Level:         ex.Level,
			Instruction:   ex.Instruction,
			Prompt:        ex.Prompt,
			CorrectAnswer: ex.CorrectAnswer,
			Options:       optionsJSON,
		}
		if hint != "" {
			dbEx.Hint = &hint
		}
		if sourceSentence != "" {
			dbEx.SourceSentence = &sourceSentence
		}
		dbExercises = append(dbExercises, dbEx)
	}

	saved, err := h.DB.SaveExercises(r.Context(), userID, dbExercises)
	if err != nil {
		slog.Warn("failed to save exercises to DB, returning without IDs", "error", err, "user_id", userID)
		// Return Gemini exercises directly without DB IDs
		resp := make([]exerciseResponse, 0, len(exercises))
		for _, ex := range exercises {
			resp = append(resp, exerciseResponse{
				Type:           ex.Type,
				Level:          ex.Level,
				Instruction:    ex.Instruction,
				Prompt:         ex.Prompt,
				CorrectAnswer:  ex.CorrectAnswer,
				Hint:           ex.Hint,
				SourceSentence: ex.SourceSentence,
				Options:        ex.Options,
				SourceCardID:   ex.SourceCardID,
			})
		}
		slog.Info("generated exercises (no DB)", "user_id", userID, "count", len(resp))
		writeJSON(w, http.StatusOK, resp)
		return
	}

	resp := make([]exerciseResponse, 0, len(saved))
	for _, s := range saved {
		er := exerciseResponse{
			ID:            s.ID,
			Type:          s.Type,
			Level:         s.Level,
			Instruction:   s.Instruction,
			Prompt:        s.Prompt,
			CorrectAnswer: s.CorrectAnswer,
			SourceCardID:  s.SourceCardID,
		}
		if s.Hint != nil {
			er.Hint = *s.Hint
		}
		if s.SourceSentence != nil {
			er.SourceSentence = *s.SourceSentence
		}
		if len(s.Options) > 0 {
			json.Unmarshal(s.Options, &er.Options)
		}
		resp = append(resp, er)
	}

	slog.Info("generated exercises", "user_id", userID, "count", len(resp))
	writeJSON(w, http.StatusOK, resp)
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

	// Persist result if exercise ID provided
	if req.ExerciseID != "" {
		if err := h.DB.UpdateExerciseResult(r.Context(), userID, req.ExerciseID, req.UserAnswer, result.Correct, result.Feedback); err != nil {
			slog.Error("failed to update exercise result", "error", err, "user_id", userID, "exercise_id", req.ExerciseID)
		}
	}

	writeJSON(w, http.StatusOK, result)
}

type exerciseCompleteRequest struct {
	ExerciseID string `json:"exercise_id"`
	UserAnswer string `json:"user_answer"`
	Correct    bool   `json:"correct"`
}

func (h *ExercisesHandler) Complete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req exerciseCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.ExerciseID == "" || req.UserAnswer == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "exercise_id and user_answer required"})
		return
	}

	if err := h.DB.UpdateExerciseResult(r.Context(), userID, req.ExerciseID, req.UserAnswer, req.Correct, ""); err != nil {
		slog.Error("failed to complete exercise", "error", err, "user_id", userID, "exercise_id", req.ExerciseID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update exercise"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ExercisesHandler) Due(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	// First get uncompleted exercises, then due (previously wrong) exercises
	uncompleted, err := h.DB.GetUncompletedExercises(r.Context(), userID)
	if err != nil {
		slog.Warn("failed to get uncompleted exercises, returning empty list", "error", err, "user_id", userID)
		writeJSON(w, http.StatusOK, []exerciseResponse{})
		return
	}

	due, err := h.DB.GetDueExercises(r.Context(), userID)
	if err != nil {
		slog.Warn("failed to get due exercises, returning uncompleted only", "error", err, "user_id", userID)
	}

	// Combine: uncompleted first, then due (dedup by ID)
	seen := make(map[string]bool)
	var all []db.Exercise
	for _, e := range uncompleted {
		if !seen[e.ID] {
			seen[e.ID] = true
			all = append(all, e)
		}
	}
	for _, e := range due {
		if !seen[e.ID] {
			seen[e.ID] = true
			all = append(all, e)
		}
	}

	resp := make([]exerciseResponse, 0, len(all))
	for _, s := range all {
		er := exerciseResponse{
			ID:            s.ID,
			Type:          s.Type,
			Level:         s.Level,
			Instruction:   s.Instruction,
			Prompt:        s.Prompt,
			CorrectAnswer: s.CorrectAnswer,
			SourceCardID:  s.SourceCardID,
		}
		if s.Hint != nil {
			er.Hint = *s.Hint
		}
		if s.SourceSentence != nil {
			er.SourceSentence = *s.SourceSentence
		}
		if len(s.Options) > 0 {
			json.Unmarshal(s.Options, &er.Options)
		}
		resp = append(resp, er)
	}

	writeJSON(w, http.StatusOK, resp)
}
