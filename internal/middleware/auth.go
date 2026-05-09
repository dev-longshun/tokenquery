package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AdminClaims struct {
	AdminID  uint   `json:"aid"`
	Username string `json:"usr"`
	jwt.RegisteredClaims
}

func IssueAdminToken(secret string, adminID uint, username string, ttl time.Duration) (string, error) {
	claims := AdminClaims{
		AdminID:  adminID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(secret))
}

func AdminAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未登录"})
			return
		}
		tokStr := strings.TrimPrefix(auth, "Bearer ")
		tokStr = strings.TrimSpace(tokStr)
		claims := &AdminClaims{}
		tok, err := jwt.ParseWithClaims(tokStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !tok.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "message": "登录已过期"})
			return
		}
		c.Set("admin_id", claims.AdminID)
		c.Set("admin_username", claims.Username)
		c.Next()
	}
}
