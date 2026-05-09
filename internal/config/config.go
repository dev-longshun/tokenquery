package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	ListenAddr      string
	DataDir         string
	DBPath          string
	JWTSecret       string
	InitAdminUser   string
	InitAdminPass   string
	UpstreamTimeout int // seconds
}

func Load() (*Config, error) {
	c := &Config{
		ListenAddr:      getenv("TOKENQUERY_LISTEN", ":8080"),
		DataDir:         getenv("TOKENQUERY_DATA_DIR", "./data"),
		JWTSecret:       os.Getenv("TOKENQUERY_JWT_SECRET"),
		InitAdminUser:   os.Getenv("TOKENQUERY_ADMIN_USER"),
		InitAdminPass:   os.Getenv("TOKENQUERY_ADMIN_PASS"),
		UpstreamTimeout: 30,
	}
	if strings.TrimSpace(c.JWTSecret) == "" {
		return nil, fmt.Errorf("TOKENQUERY_JWT_SECRET is required")
	}
	if err := os.MkdirAll(c.DataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	c.DBPath = c.DataDir + "/tokenquery.db"
	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
