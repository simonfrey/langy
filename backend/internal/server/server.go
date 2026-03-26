package server

import (
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
	oapiapi "github.com/simonfrey/langy/internal/api"
	"github.com/simonfrey/langy/internal/db"
	"github.com/simonfrey/langy/internal/gemini"
	"github.com/simonfrey/langy/internal/middleware"
)

// publicPaths lists API paths that don't require authentication.
var publicPaths = map[string]bool{
	"/api/auth/register": true,
	"/api/auth/login":    true,
}

// authRateLimitPaths lists API paths with stricter rate limits.
var authRateLimitPaths = map[string]bool{
	"/api/auth/register": true,
	"/api/auth/login":    true,
}

func New(database *db.DB, geminiClient *gemini.Client, staticFiles fs.FS) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logging)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(securityHeaders)

	// Global rate limit: generous limit, only catches obvious abuse
	r.Use(httprate.LimitByIP(10000, time.Minute))

	// Selective auth: skip public paths
	r.Use(selectiveAuth)

	// Stricter rate limit on auth endpoints
	authLimiter := httprate.LimitByIP(30, time.Minute)
	r.Use(func(next http.Handler) http.Handler {
		limited := authLimiter(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if authRateLimitPaths[r.URL.Path] {
				limited.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	impl := &oapiapi.Server{DB: database, Gemini: geminiClient}
	strictHandler := oapiapi.NewStrictHandler(impl, nil)

	// Mount generated API routes under /api
	oapiapi.HandlerFromMuxWithBaseURL(strictHandler, r, "/api")

	// Serve static files with SPA fallback
	spaHandler := spaFileServer(staticFiles)
	r.Get("/*", spaHandler)

	return r
}

func selectiveAuth(next http.Handler) http.Handler {
	authMw := middleware.Auth(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for non-API paths and public API paths
		if !strings.HasPrefix(r.URL.Path, "/api/") || publicPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}
		authMw.ServeHTTP(w, r)
	})
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
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// SPA fallback: serve index.html directly (bypass FileServer's index.html->/ redirect)
		if content, err := fs.ReadFile(staticFS, "index.html"); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(content)
			return
		}

		http.NotFound(w, r)
	}
}
