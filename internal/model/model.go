package model

import "time"

type Site struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Host      string    `gorm:"uniqueIndex;size:255" json:"host"`
	Name      string    `gorm:"size:255" json:"name"`
	BaseURL   string    `gorm:"size:512" json:"base_url"`
	Note      string    `gorm:"size:1024" json:"note"`
	Disabled  bool      `gorm:"default:false" json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Admin struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:64" json:"username"`
	PasswordHash string    `gorm:"size:255" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
