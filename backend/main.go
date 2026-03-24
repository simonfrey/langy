package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/server"
	"github.com/simonfrey/langy/internal/worker"
)

//go:embed static/*
var staticFiles embed.FS

func initLogger() {
	levelStr := strings.ToLower(os.Getenv("LOG_LEVEL"))
	var level slog.Level
	switch levelStr {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	slog.SetDefault(slog.New(handler))
}

func main() {
	initLogger()
	_ = godotenv.Load(".env")

	if len(os.Args) < 2 {
		fmt.Println("Usage: langy <serve>")
		os.Exit(1)
	}

	ctx := context.Background()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		slog.Error("DATABASE_URL environment variable is required")
		os.Exit(1)
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		slog.Error("JWT_SECRET environment variable must be at least 32 characters")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "serve":
		runServe(ctx, databaseURL)
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}

func runServe(ctx context.Context, databaseURL string) {
	database, err := db.New(ctx, databaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	var geminiClient *gemini.Client
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey != "" {
		geminiClient, err = gemini.New(ctx, geminiKey)
		if err != nil {
			slog.Warn("failed to initialize Gemini client", "error", err)
		}
	} else {
		slog.Warn("GEMINI_API_KEY not set, generate endpoint will not work")
	}

	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		slog.Error("failed to create static filesystem", "error", err)
		os.Exit(1)
	}

	// Start background exercise generation worker
	if geminiClient != nil {
		interval := 5 * time.Minute
		if v := os.Getenv("EXERCISE_WORKER_INTERVAL"); v != "" {
			if d, err := time.ParseDuration(v); err == nil {
				interval = d
			}
		}
		w := &worker.ExerciseWorker{
			DB:        database,
			Gemini:    geminiClient,
			Interval:  interval,
			BatchSize: 50,
		}
		go w.Start(ctx)
	}

	handler := server.New(database, geminiClient, staticFS)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("starting server", "port", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
