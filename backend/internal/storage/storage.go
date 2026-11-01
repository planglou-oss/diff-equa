package storage

import (
	"database/sql"
	_ "modernc.org/sqlite"
	"os"
	"path/filepath"
)

func Open(dir string) (*sql.DB, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", filepath.Join(dir, "eemath.db"))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS topics(id INTEGER PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,legacy_key TEXT NOT NULL UNIQUE,topic_id INTEGER NOT NULL REFERENCES topics(id),display_number INTEGER NOT NULL,exam_type TEXT NOT NULL,exam_type_raw TEXT NOT NULL,date_label TEXT NOT NULL,exam_date TEXT,year INTEGER NOT NULL,source_label TEXT NOT NULL,search_text_raw TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,relative_path TEXT NOT NULL,mime_type TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,byte_size INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS question_media(question_id TEXT NOT NULL REFERENCES questions(id),role TEXT NOT NULL,media_id TEXT NOT NULL REFERENCES media(id),PRIMARY KEY(question_id,role));
 CREATE TABLE IF NOT EXISTS explanations(question_id TEXT PRIMARY KEY REFERENCES questions(id),body_html TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'unreviewed');
 CREATE TABLE IF NOT EXISTS imports(checksum TEXT PRIMARY KEY,imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS browser_sessions(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,question_id TEXT NOT NULL REFERENCES questions(id),created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS generation_requests(conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,client_request_id TEXT NOT NULL,status TEXT NOT NULL,message_id TEXT NOT NULL,error_code TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,PRIMARY KEY(conversation_id,client_request_id));
 CREATE INDEX IF NOT EXISTS question_order ON questions(topic_id,display_number,id);
 CREATE INDEX IF NOT EXISTS question_year ON questions(year);
 CREATE INDEX IF NOT EXISTS question_type ON questions(exam_type);
 CREATE INDEX IF NOT EXISTS message_order ON messages(conversation_id,created_at,id);
 CREATE INDEX IF NOT EXISTS session_requests ON generation_requests(created_at);
 CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES questions(id),session_id TEXT REFERENCES browser_sessions(id) ON DELETE SET NULL,kind TEXT NOT NULL,description TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS report_session_time ON reports(session_id,created_at);
 UPDATE messages SET status='interrupted' WHERE status='streaming';
 UPDATE generation_requests SET status='interrupted',error_code='SERVER_RESTARTED' WHERE status='streaming';`)
	if err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
