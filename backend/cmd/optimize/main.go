package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"os"
	"strings"

	"github.com/XiaoConstantine/dspy-go/pkg/core"
	"github.com/XiaoConstantine/dspy-go/pkg/llms"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/gemini/testdata"
)

func main() {
	cards := flag.Bool("cards", false, "Optimize card generation prompts")
	exercises := flag.Bool("exercises", false, "Optimize exercise generation prompts")
	types := flag.String("types", "vocab_fill_blank,grammar_fill_conjugation,grammar_multiple_choice,vocab_word_bank",
		"Comma-separated exercise types to optimize")
	cardsData := flag.String("cards-data", "internal/gemini/testdata/cards.json", "Path to card test data")
	exercisesData := flag.String("exercises-data", "internal/gemini/testdata/exercises.json", "Path to exercise test data")
	outputDir := flag.String("output", "prompts/optimized", "Directory for optimized program state")
	flag.Parse()

	if !*cards && !*exercises {
		fmt.Println("Usage: optimize [--cards] [--exercises] [--types=type1,type2]")
		flag.PrintDefaults()
		os.Exit(1)
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable required")
	}

	llm, err := llms.NewGeminiLLM(apiKey, core.ModelGoogleGeminiPro)
	if err != nil {
		log.Fatalf("Create LLM: %v", err)
	}

	ctx := context.Background()

	if err := os.MkdirAll(*outputDir, 0o755); err != nil {
		log.Fatalf("Create output dir: %v", err)
	}

	if *cards {
		cases, err := testdata.LoadCardTestCases(*cardsData)
		if err != nil {
			log.Fatalf("Load card test data: %v", err)
		}

		slog.Info("optimizing vocabulary cards", "test_cases", len(cases))
		if err := gemini.OptimizeCards(ctx, llm, cases, "vocabulary", *outputDir+"/card_vocab.json"); err != nil {
			slog.Error("vocabulary card optimization failed", "error", err)
		}

		slog.Info("optimizing grammar cards", "test_cases", len(cases))
		if err := gemini.OptimizeCards(ctx, llm, cases, "grammar", *outputDir+"/card_grammar.json"); err != nil {
			slog.Error("grammar card optimization failed", "error", err)
		}
	}

	if *exercises {
		cases, err := testdata.LoadExerciseTestCases(*exercisesData)
		if err != nil {
			log.Fatalf("Load exercise test data: %v", err)
		}

		typeList := strings.Split(*types, ",")
		slog.Info("optimizing exercises", "types", typeList, "test_cases", len(cases))
		if err := gemini.OptimizeExercises(ctx, llm, cases, *outputDir, typeList); err != nil {
			slog.Error("exercise optimization failed", "error", err)
		}
	}

	slog.Info("optimization complete")
}
