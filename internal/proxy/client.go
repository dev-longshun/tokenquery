package proxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: timeout},
	}
}

func (c *Client) do(path, bearerKey string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+bearerKey)
	req.Header.Set("Accept", "application/json")
	return c.HTTP.Do(req)
}

// GetTokenUsage 调 NewAPI 的 /api/usage/token/（公开接口，TokenAuthReadOnly 鉴权）
// 返回的 JSON 是 {code: true, message: "ok", data: {...}}
func (c *Client) GetTokenUsage(bearerKey string) (map[string]any, int, error) {
	resp, err := c.do("/api/usage/token/", bearerKey)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("上游返回非 JSON: %s", string(body))
	}
	return parsed, resp.StatusCode, nil
}

// GetTokenLogs 调 NewAPI 的 /api/log/token（TokenAuthReadOnly 鉴权）
// NewAPI 侧最多返回 common.MaxRecentItems(1000) 条
// 返回 JSON 是 {success, message, data: []}
func (c *Client) GetTokenLogs(bearerKey string) ([]map[string]any, int, error) {
	resp, err := c.do("/api/log/token", bearerKey)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var parsed struct {
		Success bool             `json:"success"`
		Message string           `json:"message"`
		Data    []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("上游返回非 JSON: %s", string(body))
	}
	if !parsed.Success && parsed.Message != "" {
		return nil, resp.StatusCode, fmt.Errorf("%s", parsed.Message)
	}
	return parsed.Data, resp.StatusCode, nil
}

func ValidateBaseURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("base_url 必须以 http:// 或 https:// 开头")
	}
	if u.Host == "" {
		return fmt.Errorf("base_url 缺少 host")
	}
	return nil
}
