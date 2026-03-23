package server

import (
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/handler"
	"github.com/simonfrey/langy/internal/middleware"
)

func New(database *db.DB, geminiClient *gemini.Client, staticFiles fs.FS) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logging)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(securityHeaders)

	// Global rate limit: generous limit, only catches obvious abuse
	r.Use(httprate.LimitByIP(10000, time.Minute))

	authHandler := &handler.AuthHandler{DB: database}
	cardsHandler := &handler.CardsHandler{DB: database}
	reviewHandler := &handler.ReviewHandler{DB: database}
	syncHandler := &handler.SyncHandler{DB: database}
	generateHandler := &handler.GenerateHandler{DB: database, Gemini: geminiClient}
	exercisesHandler := &handler.ExercisesHandler{Gemini: geminiClient}

	// Public auth routes — stricter rate limit
	r.Group(func(r chi.Router) {
		r.Use(httprate.LimitByIP(30, time.Minute))
		r.Post("/api/auth/register", authHandler.Register)
		r.Post("/api/auth/login", authHandler.Login)
	})

	// Protected API routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth)

		r.Get("/api/decks", cardsHandler.ListDecks)
		r.Post("/api/decks", cardsHandler.CreateDeck)
		r.Delete("/api/decks/{id}", cardsHandler.DeleteDeck)
		r.Get("/api/decks/{id}/cards", cardsHandler.ListCards)
		r.Post("/api/decks/{id}/cards", cardsHandler.CreateCard)
		r.Put("/api/cards/{id}", cardsHandler.UpdateCard)
		r.Delete("/api/cards/{id}", cardsHandler.DeleteCard)
		r.Get("/api/cards/{id}/{side}", cardsHandler.GetCardImage)

		r.Get("/api/review/due", reviewHandler.GetDueCards)
		r.Post("/api/review", reviewHandler.SubmitReview)

		r.Post("/api/sync", syncHandler.Sync)
		r.Post("/api/generate", generateHandler.Generate)
		r.Post("/api/exercises/generate", exercisesHandler.Generate)
		r.Post("/api/exercises/grade", exercisesHandler.Grade)
	})

	// Serve static files with SPA fallback
	spaHandler := spaFileServer(staticFiles)
	r.Get("/*", spaHandler)

	return r
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func spaFileServer(staticFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))

	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Service worker must never be cached by the browser
		if path == "sw.js" || path == "sw.js.map" {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		}

		// Hashed assets can be cached forever
		if strings.HasPrefix(path, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}

		// Try to open the file
		if path != "" {
			if f, err := staticFS.Open(path); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// SPA fallback: serve index.html directly (bypass FileServer's index.html->/ redirect)
		if content, err := fs.ReadFile(staticFS, "index.html"); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(content)
			return
		}

		http.NotFound(w, r)
	}
}
