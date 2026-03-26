package api

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
)

func exerciseToResponse(ex db.Exercise) ExerciseResponse {
	resp := ExerciseResponse{
		Id:            ex.ID,
		Type:          ex.Type,
		Level:         ex.Level,
		Instruction:   ex.Instruction,
		Prompt:        ex.Prompt,
		CorrectAnswer: ex.CorrectAnswer,
		SourceCardId:  ex.SourceCardID,
	}
	if ex.Hint != nil {
		resp.Hint = ex.Hint
	}
	if ex.SourceSentence != nil {
		resp.SourceSentence = ex.SourceSentence
	}
	if len(ex.Options) > 0 {
		var opts []string
		_ = json.Unmarshal(ex.Options, &opts)
		resp.Options = &opts
	}
	if len(ex.Data) > 0 {
		var data map[string]interface{}
		_ = json.Unmarshal(ex.Data, &data)
		resp.Data = &data
	}
	return resp
}

func (s *Server) GenerateExercises(ctx context.Context, request GenerateExercisesRequestObject) (GenerateExercisesResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body

	if len(req.Cards) == 0 || req.SourceLang == "" || req.TargetLang == "" {
		return GenerateExercisesdefaultJSONResponse{Body: ErrorResponse{Error: "cards, source_lang, and target_lang required"}, StatusCode: 400}, nil
	}

	// Convert API types to gemini types
	geminiCards := make([]gemini.ExerciseCard, len(req.Cards))
	for i, c := range req.Cards {
		geminiCards[i] = gemini.ExerciseCard{ID: c.Id, Front: c.Front, Back: c.Back, Level: c.Level}
	}
	var knownWords []gemini.KnownWord
	if req.KnownWords != nil {
		for _, kw := range *req.KnownWords {
			knownWords = append(knownWords, gemini.KnownWord{Front: kw.Front, Back: kw.Back})
		}
	}

	exercises, err := s.Gemini.GenerateExercises(ctx, geminiCards, knownWords, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to generate exercises", "error", err, "user_id", userID)
		return GenerateExercisesdefaultJSONResponse{Body: ErrorResponse{Error: "failed to generate exercises"}, StatusCode: 500}, nil
	}

	sessionID := ""
	if req.SessionId != nil {
		sessionID = *req.SessionId
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
			SessionID:     sessionID,
			SourceCardID:  ex.SourceCardID,
			Type:          ex.Type,
			Level:         ex.Level,
			Instruction:   ex.Instruction,
			Prompt:        ex.Prompt,
			CorrectAnswer: ex.CorrectAnswer,
			Options:       optionsJSON,
			Data:          ex.Data,
		}
		if hint != "" {
			dbEx.Hint = &hint
		}
		if sourceSentence != "" {
			dbEx.SourceSentence = &sourceSentence
		}
		dbExercises = append(dbExercises, dbEx)
	}

	saved, err := s.DB.SaveExercises(ctx, userID, dbExercises)
	if err != nil {
		slog.Warn("failed to save exercises to DB, returning without IDs", "error", err, "user_id", userID)
		// Return Gemini exercises directly without DB IDs
		resp := make([]ExerciseResponse, 0, len(exercises))
		for _, ex := range exercises {
			resp = append(resp, ExerciseResponse{
				Type:           ex.Type,
				Level:          ex.Level,
				Instruction:    ex.Instruction,
				Prompt:         ex.Prompt,
				CorrectAnswer:  ex.CorrectAnswer,
				Hint:           ptrStr(ex.Hint),
				SourceSentence: ptrStr(ex.SourceSentence),
				SourceCardId:   ex.SourceCardID,
			})
		}
		return GenerateExercises200JSONResponse(resp), nil
	}

	resp := make([]ExerciseResponse, len(saved))
	for i, ex := range saved {
		resp[i] = exerciseToResponse(ex)
	}
	slog.Info("generated exercises", "user_id", userID, "count", len(resp))
	return GenerateExercises200JSONResponse(resp), nil
}

func (s *Server) GradeExercise(ctx context.Context, request GradeExerciseRequestObject) (GradeExerciseResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body

	if req.UserAnswer == "" || req.CorrectAnswer == "" || req.SourceLang == "" || req.TargetLang == "" {
		return GradeExercisedefaultJSONResponse{Body: ErrorResponse{Error: "user_answer, correct_answer, source_lang, and target_lang required"}, StatusCode: 400}, nil
	}

	exerciseType := ""
	if req.ExerciseType != nil {
		exerciseType = *req.ExerciseType
	}
	prompt := ""
	if req.Prompt != nil {
		prompt = *req.Prompt
	}

	result, err := s.Gemini.GradeExercise(ctx, exerciseType, prompt, req.CorrectAnswer, req.UserAnswer, req.SourceLang, req.TargetLang)
	if err != nil {
		slog.Error("failed to grade exercise", "error", err, "user_id", userID)
		return GradeExercisedefaultJSONResponse{Body: ErrorResponse{Error: "failed to grade exercise"}, StatusCode: 500}, nil
	}

	// Persist result if exercise ID provided
	if req.ExerciseId != nil && *req.ExerciseId != "" {
		if err := s.DB.UpdateExerciseResult(ctx, userID, *req.ExerciseId, req.UserAnswer, result.Correct, result.Feedback); err != nil {
			slog.Error("failed to update exercise result", "error", err, "user_id", userID)
		}
	}

	resp := GradeResult{
		Correct:  result.Correct,
		Feedback: result.Feedback,
	}
	if result.CorrectedAnswer != "" {
		resp.CorrectedAnswer = &result.CorrectedAnswer
	}
	return GradeExercise200JSONResponse(resp), nil
}

func (s *Server) CompleteExercise(ctx context.Context, request CompleteExerciseRequestObject) (CompleteExerciseResponseObject, error) {
	userID := getUserID(ctx)
	req := request.Body

	if req.ExerciseId == "" || req.UserAnswer == "" {
		return CompleteExercisedefaultJSONResponse{Body: ErrorResponse{Error: "exercise_id and user_answer required"}, StatusCode: 400}, nil
	}

	if err := s.DB.UpdateExerciseResult(ctx, userID, req.ExerciseId, req.UserAnswer, req.Correct, ""); err != nil {
		slog.Error("failed to complete exercise", "error", err, "user_id", userID)
		return CompleteExercisedefaultJSONResponse{Body: ErrorResponse{Error: "failed to update exercise"}, StatusCode: 500}, nil
	}

	return CompleteExercise200JSONResponse{Status: "ok"}, nil
}

func (s *Server) GetDueExercises(ctx context.Context, _ GetDueExercisesRequestObject) (GetDueExercisesResponseObject, error) {
	userID := getUserID(ctx)

	uncompleted, err := s.DB.GetUncompletedExercises(ctx, userID)
	if err != nil {
		slog.Warn("failed to get uncompleted exercises", "error", err, "user_id", userID)
		return GetDueExercises200JSONResponse([]ExerciseResponse{}), nil
	}

	due, err := s.DB.GetDueExercises(ctx, userID)
	if err != nil {
		slog.Warn("failed to get due exercises", "error", err, "user_id", userID)
	}

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

	resp := make([]ExerciseResponse, len(all))
	for i, ex := range all {
		resp[i] = exerciseToResponse(ex)
	}
	return GetDueExercises200JSONResponse(resp), nil
}
