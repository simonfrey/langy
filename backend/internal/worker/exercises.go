package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
)

// ExerciseWorker periodically generates exercises for cards that don't have any uncompleted exercises.
type ExerciseWorker struct {
	DB     *db.DB
	Gemini *gemini.Client
	// How often to check for cards needing exercises.
	Interval time.Duration
	// Max cards to process per tick.
	BatchSize int
}

func classifyCard(repetitions, intervalDays int) int {
	if repetitions <= 2 || intervalDays <= 3 {
		return 1
	}
	if repetitions <= 5 || intervalDays <= 14 {
		return 2
	}
	return 3
}

// Start runs the worker in a loop until the context is cancelled.
func (w *ExerciseWorker) Start(ctx context.Context) {
	slog.Info("exercise worker started", "interval", w.Interval, "batch_size", w.BatchSize)

	// Run once immediately on startup
	w.tick(ctx)

	ticker := time.NewTicker(w.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("exercise worker stopped")
			return
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

func (w *ExerciseWorker) tick(ctx context.Context) {
	cards, err := w.DB.GetCardsNeedingExercises(ctx, w.BatchSize)
	if err != nil {
		slog.Error("exercise worker: failed to get cards", "error", err)
		return
	}

	if len(cards) == 0 {
		return
	}

	slog.Info("exercise worker: generating exercises", "cards", len(cards))

	// Group cards by user + language pair
	type groupKey struct {
		UserID     string
		SourceLang string
		TargetLang string
	}
	groups := make(map[groupKey][]db.CardNeedingExercise)
	for _, c := range cards {
		key := groupKey{UserID: c.UserID, SourceLang: c.SourceLang, TargetLang: c.TargetLang}
		groups[key] = append(groups[key], c)
	}

	for key, groupCards := range groups {
		exerciseCards := make([]gemini.ExerciseCard, len(groupCards))
		knownWords := make([]gemini.KnownWord, len(groupCards))
		for i, c := range groupCards {
			level := classifyCard(c.Repetitions, c.IntervalDays)
			exerciseCards[i] = gemini.ExerciseCard{
				ID:    c.CardID,
				Front: c.Front,
				Back:  c.Back,
				Level: level,
			}
			knownWords[i] = gemini.KnownWord{Front: c.Front, Back: c.Back}
		}

		exercises, err := w.Gemini.GenerateExercises(ctx, exerciseCards, knownWords, key.SourceLang, key.TargetLang)
		if err != nil {
			slog.Error("exercise worker: generation failed", "error", err, "user_id", key.UserID)
			continue
		}

		sessionID := "bg-" + time.Now().Format("20060102-150405")

		dbExercises := make([]db.Exercise, 0, len(exercises))
		for _, ex := range exercises {
			var optionsJSON []byte
			if len(ex.Options) > 0 {
				optionsJSON, _ = json.Marshal(ex.Options)
			}
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
			if ex.Hint != "" {
				hint := ex.Hint
				dbEx.Hint = &hint
			}
			if ex.SourceSentence != "" {
				ss := ex.SourceSentence
				dbEx.SourceSentence = &ss
			}
			dbExercises = append(dbExercises, dbEx)
		}

		saved, err := w.DB.SaveExercises(ctx, key.UserID, dbExercises)
		if err != nil {
			slog.Error("exercise worker: failed to save exercises", "error", err, "user_id", key.UserID)
			continue
		}

		slog.Info("exercise worker: generated exercises", "user_id", key.UserID, "count", len(saved))
	}
}
