package api

import (
	"context"
	"log/slog"
	"net/mail"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// dummyHash is a bcrypt hash used to prevent timing attacks on login
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), bcrypt.DefaultCost)

func generateToken(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(100 * 365 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func (s *Server) Register(ctx context.Context, request RegisterRequestObject) (RegisterResponseObject, error) {
	req := request.Body
	email := string(req.Email)
	if email == "" || req.Password == "" {
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "email and password required"}, StatusCode: 400}, nil
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "invalid email format"}, StatusCode: 400}, nil
	}
	if len(req.Password) < 12 {
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "password must be at least 12 characters"}, StatusCode: 400}, nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash password", "error", err)
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "internal error"}, StatusCode: 500}, nil
	}

	user, err := s.DB.CreateUser(ctx, email, string(hash))
	if err != nil {
		slog.Warn("registration failed: email already exists", "email", email)
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "email already registered"}, StatusCode: 409}, nil
	}

	token, err := generateToken(user.ID)
	if err != nil {
		return RegisterdefaultJSONResponse{Body: ErrorResponse{Error: "internal error"}, StatusCode: 500}, nil
	}

	slog.Info("user registered", "email", email, "user_id", user.ID)
	return Register201JSONResponse{Token: token, User: userToAPI(user)}, nil
}

func (s *Server) Login(ctx context.Context, request LoginRequestObject) (LoginResponseObject, error) {
	req := request.Body
	if req.Email == "" || req.Password == "" {
		return LogindefaultJSONResponse{Body: ErrorResponse{Error: "email and password required"}, StatusCode: 400}, nil
	}

	user, err := s.DB.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return LogindefaultJSONResponse{Body: ErrorResponse{Error: "internal error"}, StatusCode: 500}, nil
	}

	hashToCompare := dummyHash
	if user != nil {
		hashToCompare = []byte(user.PasswordHash)
	}
	if err := bcrypt.CompareHashAndPassword(hashToCompare, []byte(req.Password)); err != nil || user == nil {
		slog.Warn("login failed", "email", req.Email)
		return LogindefaultJSONResponse{Body: ErrorResponse{Error: "invalid credentials"}, StatusCode: 401}, nil
	}

	token, err := generateToken(user.ID)
	if err != nil {
		return LogindefaultJSONResponse{Body: ErrorResponse{Error: "internal error"}, StatusCode: 500}, nil
	}

	slog.Info("login success", "email", req.Email, "user_id", user.ID)
	return Login200JSONResponse{Token: token, User: userToAPI(user)}, nil
}
