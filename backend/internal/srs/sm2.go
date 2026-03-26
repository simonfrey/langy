package srs

import (
	"math"
	"time"
)

type SM2Input struct {
	Grade        int
	Repetitions  int
	EaseFactor   float64
	IntervalDays int
}

type SM2Output struct {
	Repetitions  int
	EaseFactor   float64
	IntervalDays int
	NextReview   time.Time
}

// SM2 implements the SM-2 spaced repetition algorithm.
// Grade: 0-5 where 0-2 means failure, 3-5 means success.
func SM2(input SM2Input) SM2Output {
	grade := input.Grade
	if grade < 0 {
		grade = 0
	}
	if grade > 5 {
		grade = 5
	}

	var newReps int
	var newInterval int
	newEF := input.EaseFactor

	if grade < 3 {
		// Failed: reset repetitions and interval
		newReps = 0
		newInterval = 1
	} else {
		// Successful recall
		newReps = input.Repetitions + 1
		switch newReps {
		case 1:
			newInterval = 1
		case 2:
			newInterval = 6
		default:
			newInterval = int(math.Round(float64(input.IntervalDays) * newEF))
			if newInterval < 1 {
				newInterval = 1
			}
		}
	}

	// Update ease factor
	newEF = newEF + (0.1 - float64(5-grade)*(0.08+float64(5-grade)*0.02))
	if newEF < 1.3 {
		newEF = 1.3
	}

	return SM2Output{
		Repetitions:  newReps,
		EaseFactor:   newEF,
		IntervalDays: newInterval,
		NextReview:   time.Now().AddDate(0, 0, newInterval),
	}
}
