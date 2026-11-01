package main

import (
	"eemath/internal/legacy"
	"eemath/internal/storage"
	"flag"
	"log"
)

func main() {
	source := flag.String("source", "exam201_solutions.html", "legacy HTML path")
	dir := flag.String("data", "data", "data directory")
	flag.Parse()
	db, err := storage.Open(*dir)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	report, err := legacy.Import(db, *source, *dir)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Imported: %+v", report)
}
