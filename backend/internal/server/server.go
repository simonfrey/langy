package server

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
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

	authHandler := &handler.AuthHandler{DB: database}
	cardsHandler := &handler.CardsHandler{DB: database}
	reviewHandler := &handler.ReviewHandler{DB: database}
	syncHandler := &handler.SyncHandler{DB: database}
	generateHandler := &handler.GenerateHandler{DB: database, Gemini: geminiClient}

	r.Route("/langy", func(r chi.Router) {
		// Public auth routes
		r.Post("/api/auth/register", authHandler.Register)
		r.Post("/api/auth/login", authHandler.Login)

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
		})

		// Serve static files with SPA fallback
		spaHandler := spaFileServer(staticFiles)
		r.Get("/*", spaHandler)
	})

	return r
}

func spaFileServer(staticFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))

	return func(w http.ResponseWriter, r *http.Request) {
		// Strip the /langy prefix for file lookup
		path := strings.TrimPrefix(r.URL.Path, "/langy")
		if path == "" {
			path = "/"
		}
		path = strings.TrimPrefix(path, "/")

		// Try to open the file
		if path != "" {
			if f, err := staticFS.Open(path); err == nil {
				f.Close()
				// Serve with the /langy prefix stripped
				http.StripPrefix("/langy", fileServer).ServeHTTP(w, r)
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
