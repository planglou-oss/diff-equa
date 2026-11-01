package main

import (
	"context"
	"eemath/internal/ai"
	"eemath/internal/httpapi"
	"eemath/internal/legacy"
	"eemath/internal/storage"
	"eemath/internal/studycontent"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"
)

func main() {
	// A local .env is optional; existing process environment always takes precedence.
	if raw, e := os.ReadFile(".env"); e == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			k, v, ok := strings.Cut(line, "=")
			k = strings.TrimSpace(k)
			if ok && os.Getenv(k) == "" {
				os.Setenv(k, strings.Trim(strings.TrimSpace(v), "\"'"))
			}
		}
	}
	addr := flag.String("addr", "127.0.0.1:8080", "listen address")
	dir := flag.String("data", "data", "data directory")
	web := flag.String("web", "frontend/dist", "frontend build")
	source := flag.String("source", "exam201_solutions.html", "legacy source for initial import")
	flag.Parse()
	db, err := storage.Open(*dir)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	var count int
	if err = db.QueryRow(`SELECT COUNT(*) FROM questions`).Scan(&count); err != nil {
		log.Fatal(err)
	}
	if count == 0 {
		report, e := legacy.Import(db, *source, *dir)
		if e != nil {
			log.Fatal(e)
		}
		log.Printf("Imported %d questions, %d image links, %d AI explanations", report.Questions, report.Images, report.Explanations)
	}
	var provider ai.Provider
	if err := studycontent.SeedExplanations(db); err != nil {
		log.Fatal(err)
	}
	key, model := os.Getenv("GEMINI_API_KEY"), os.Getenv("GEMINI_MODEL")
	if key != "" && model != "" {
		level := strings.ToLower(strings.TrimSpace(os.Getenv("GEMINI_THINKING_LEVEL")))
		switch level {
		case "", "default", "minimal", "low", "medium", "high":
		default:
			log.Fatal("GEMINI_THINKING_LEVEL must be default, minimal, low, medium, or high")
		}
		provider = &ai.Gemini{Key: key, Model: strings.TrimPrefix(model, "models/"), ThinkingLevel: level}
	} else {
		log.Print("AI chat disabled: set GEMINI_API_KEY and GEMINI_MODEL in .env")
	}
	api := httpapi.New(db, *dir, *web, provider)
	api.Cleanup()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				api.Cleanup()
			}
		}
	}()
	server := &http.Server{Addr: *addr, Handler: api, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdown)
	}()
	log.Printf("EE Math I: http://%s", *addr)
	if err = server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
