package api

import (
	"context"
	"encoding/json"
	"fmt"
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

const exerciseBatchSize = 10

func classifyCard(repetitions, intervalDays int) int {
	if repetitions <= 2 || intervalDays <= 3 {
		return 1
	}
	if repetitions <= 5 || intervalDays <= 14 {
		return 2
	}
	return 3
}

// selectExerciseCards picks a balanced mix of cards: 30% L1, 50% L2, 20% L3.
// Cards are already randomly ordered from the DB query.
func selectExerciseCards(cards []db.CardWithLangs, count int) []db.CardWithLangs {
	if len(cards) <= count {
		return cards
	}

	var l1, l2, l3 []db.CardWithLangs
	for _, c := range cards {
		switch classifyCard(c.Repetitions, c.IntervalDays) {
		case 1:
			l1 = append(l1, c)
		case 2:
			l2 = append(l2, c)
		default:
			l3 = append(l3, c)
		}
	}

	l1Count := int(float64(count) * 0.3)
	l3Count := int(float64(count) * 0.2)
	l2Count := count - l1Count - l3Count

	var result []db.CardWithLangs
	pick := func(src []db.CardWithLangs, n int) int {
		take := min(n, len(src))
		result = append(result, src[:take]...)
		return max(0, n-len(src))
	}
	overflow := pick(l1, l1Count)
	overflow += pick(l2, l2Count+overflow)
	pick(l3, l3Count+overflow)
	return result
}

func (s *Server) generateExercisesForUser(ctx context.Context, userID string) ([]db.Exercise, error) {
	cards, err := s.DB.ListAllUserCards(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list cards: %w", err)
	}
	if len(cards) == 0 {
		return nil, nil
	}

	selected := selectExerciseCards(cards, exerciseBatchSize)
	if len(selected) == 0 {
		return nil, nil
	}

	// Use language from first selected card
	sourceLang := selected[0].SourceLang
	targetLang := selected[0].TargetLang

	geminiCards := make([]gemini.ExerciseCard, len(selected))
	knownWords := make([]gemini.KnownWord, len(cards))
	for i, c := range selected {
		geminiCards[i] = gemini.ExerciseCard{
			ID:    c.ID,
			Front: c.Front,
			Back:  c.Back,
			Level: classifyCard(c.Repetitions, c.IntervalDays),
		}
	}
	for i, c := range cards {
		knownWords[i] = gemini.KnownWord{Front: c.Front, Back: c.Back}
	}

	exercises, err := s.Gemini.GenerateExercises(ctx, geminiCards, knownWords, sourceLang, targetLang)
	if err != nil {
		return nil, fmt.Errorf("generate exercises: %w", err)
	}

	dbExercises := make([]db.Exercise, 0, len(exercises))
	for _, ex := range exercises {
		var optionsJSON []byte
		if len(ex.Options) > 0 {
			optionsJSON, _ = json.Marshal(ex.Options)
		}
		dbEx := db.Exercise{
			SourceCardID:  ex.SourceCardID,
			Type:          ex.Type,
			Level:         ex.Level,
			Instruction:   ex.Instruction,
			Prompt:        ex.Prompt,
			CorrectAnswer: ex.CorrectAnswer,
			Options:       optionsJSON,
			Data:          ex.Data,
		}
		if ex.Hint != "" {
			dbEx.Hint = &ex.Hint
		}
		if ex.SourceSentence != "" {
			dbEx.SourceSentence = &ex.SourceSentence
		}
		dbExercises = append(dbExercises, dbEx)
	}

	saved, err := s.DB.SaveExercises(ctx, userID, dbExercises)
	if err != nil {
		return nil, fmt.Errorf("save exercises: %w", err)
	}
	return saved, nil
}

func (s *Server) GenerateExercises(_ context.Context, _ GenerateExercisesRequestObject) (GenerateExercisesResponseObject, error) {
	return GenerateExercisesdefaultJSONResponse{Body: ErrorResponse{Error: "deprecated: use GET /exercises/due instead"}, StatusCode: 410}, nil
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

	// Auto-generate exercises when none are available
	if len(all) == 0 && s.Gemini != nil {
		generated, err := s.generateExercisesForUser(ctx, userID)
		if err != nil {
			slog.Error("failed to auto-generate exercises", "error", err, "user_id", userID)
			return GetDueExercises200JSONResponse([]ExerciseResponse{}), nil
		}
		all = generated
	}

	resp := make([]ExerciseResponse, len(all))
	for i, ex := range all {
		resp[i] = exerciseToResponse(ex)
	}
	return GetDueExercises200JSONResponse(resp), nil
}
