package testdata

import (
	"encoding/json"
	"fmt"
	"os"
)

type CardPair struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type CardTestCase struct {
	ID               string     `json:"id"`
	Prompt           string     `json:"prompt"`
	SourceLang       string     `json:"source_lang"`
	TargetLang       string     `json:"target_lang"`
	Mode             string     `json:"mode"`
	MinCards         int        `json:"min_cards"`
	MaxCards         int        `json:"max_cards"`
	ExpectedCards    []CardPair `json:"expected_cards"`
	RequiredConcepts []string   `json:"required_concepts"`
}

type ExerciseCard struct {
	ID    string `json:"id"`
	Front string `json:"front"`
	Back  string `json:"back"`
	Level int    `json:"level"`
}

type KnownWord struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}

type ExpectedExercise struct {
	SourceCardID   string   `json:"source_card_id"`
	Instruction    string   `json:"instruction"`
	Prompt         string   `json:"prompt"`
	CorrectAnswer  string   `json:"correct_answer"`
	SourceSentence string   `json:"source_sentence,omitempty"`
	Hint           string   `json:"hint,omitempty"`
	Options        []string `json:"options,omitempty"`
}

type ExerciseTestCase struct {
	ID                string             `json:"id"`
	SourceLang        string             `json:"source_lang"`
	TargetLang        string             `json:"target_lang"`
	ExerciseType      string             `json:"exercise_type"`
	Cards             []ExerciseCard     `json:"cards"`
	KnownWords        []KnownWord        `json:"known_words"`
	ExpectedExercises []ExpectedExercise `json:"expected_exercises"`
}

func LoadCardTestCases(path string) ([]CardTestCase, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read card test cases: %w", err)
	}
	var cases []CardTestCase
	if err := json.Unmarshal(data, &cases); err != nil {
		return nil, fmt.Errorf("parse card test cases: %w", err)
	}
	return cases, nil
}

func LoadExerciseTestCases(path string) ([]ExerciseTestCase, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read exercise test cases: %w", err)
	}
	var cases []ExerciseTestCase
	if err := json.Unmarshal(data, &cases); err != nil {
		return nil, fmt.Errorf("parse exercise test cases: %w", err)
	}
	return cases, nil
}
