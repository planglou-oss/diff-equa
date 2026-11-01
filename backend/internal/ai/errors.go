package ai

import (
	"context"
	"errors"
	"fmt"
	"net"
)

// Error exposes only curated diagnostics, never an upstream body or credential.
type Error struct {
	Code, Message string
	Status        int
}

func (e *Error) Error() string { return fmt.Sprintf("%s (HTTP %d)", e.Code, e.Status) }
func PublicError(err error) (string, string) {
	var e *Error
	if errors.As(err, &e) {
		return e.Code, e.Message
	}
	var ne net.Error
	if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
		return "AI_TIMEOUT", "AI ใช้เวลาตอบเกินกำหนด กรุณาลองถามทีละขั้นหรือส่งคำถามให้สั้นลง"
	}
	if errors.Is(err, context.Canceled) {
		return "AI_CANCELED", "หยุดการตอบแล้ว"
	}
	return "AI_GENERATION_FAILED", "AI ตอบไม่สำเร็จ กรุณาลองใหม่"
}
func providerError(status int) *Error {
	switch status {
	case 400:
		return &Error{"AI_INVALID_CONFIG", "Gemini ปฏิเสธรูปแบบคำขอหรือการตั้งค่าโมเดล กรุณาตรวจการตั้งค่าเซิร์ฟเวอร์", status}
	case 401, 403:
		return &Error{"AI_ACCESS_DENIED", "Gemini ไม่อนุญาตให้ใช้ API key หรือโมเดลนี้ กรุณาตรวจสิทธิ์ของ key", status}
	case 404:
		return &Error{"AI_MODEL_NOT_FOUND", "ไม่พบโมเดล Gemini ที่ตั้งไว้ กรุณาตรวจ GEMINI_MODEL", status}
	case 429:
		return &Error{"AI_PROVIDER_QUOTA", "Gemini จำกัดจำนวนคำขอหรือโควตาหมด กรุณารอสักครู่และตรวจโควตาของบัญชี", status}
	case 408, 504:
		return &Error{"AI_TIMEOUT", "Gemini ตอบไม่ทันเวลา กรุณาลองใหม่", status}
	default:
		return &Error{"AI_PROVIDER_UNAVAILABLE", "Gemini ขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง", status}
	}
}
