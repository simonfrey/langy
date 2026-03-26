package api

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"time"

	"github.com/simonfrey/langy/internal/db"
)

func validImageMagic(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return true
	}
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return true
	}
	if string(data[:3]) == "GIF" {
		return true
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return true
	}
	return false
}

func (s *Server) UploadImage(ctx context.Context, request UploadImageRequestObject) (UploadImageResponseObject, error) {
	userID := getUserID(ctx)

	part, err := request.Body.NextPart()
	if err != nil {
		return UploadImagedefaultJSONResponse{Body: ErrorResponse{Error: "failed to read upload"}, StatusCode: 400}, nil
	}
	defer func() { _ = part.Close() }()

	data, err := io.ReadAll(io.LimitReader(part, 5<<20+1))
	if err != nil {
		return UploadImagedefaultJSONResponse{Body: ErrorResponse{Error: "failed to read upload"}, StatusCode: 400}, nil
	}
	if len(data) > 5<<20 {
		return UploadImagedefaultJSONResponse{Body: ErrorResponse{Error: "image too large (max 5MB)"}, StatusCode: 400}, nil
	}
	if !validImageMagic(data) {
		return UploadImagedefaultJSONResponse{Body: ErrorResponse{Error: "invalid image file type"}, StatusCode: 400}, nil
	}

	contentType := part.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	imageID, err := s.DB.CreateImage(ctx, userID, data, contentType)
	if err != nil {
		slog.Error("failed to create image", "error", err, "user_id", userID)
		return UploadImagedefaultJSONResponse{Body: ErrorResponse{Error: "failed to save image"}, StatusCode: 500}, nil
	}

	return UploadImage201JSONResponse{
		Id:  toUUID(imageID),
		Url: "/api/images/" + imageID,
	}, nil
}

func (s *Server) GetImage(ctx context.Context, request GetImageRequestObject) (GetImageResponseObject, error) {
	img, err := s.DB.GetImageData(ctx, uuidStr(request.Id))
	if err != nil || img == nil {
		return GetImagedefaultJSONResponse{Body: ErrorResponse{Error: "image not found"}, StatusCode: 404}, nil
	}

	return GetImage200ImageResponse{
		Body:          bytes.NewReader(img.Data),
		ContentType:   img.ContentType,
		ContentLength: int64(len(img.Data)),
	}, nil
}

// ImageCleanupWorker periodically deletes orphaned images.
func ImageCleanupWorker(ctx context.Context, database *db.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := database.CleanupOrphanedImages(ctx); err != nil {
				slog.Error("failed to cleanup orphaned images", "error", err)
			}
		}
	}
}
