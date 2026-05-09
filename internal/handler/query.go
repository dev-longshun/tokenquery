package handler

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dev-longshun/tokenquery/internal/config"
	"github.com/dev-longshun/tokenquery/internal/model"
	"github.com/dev-longshun/tokenquery/internal/proxy"
	"github.com/dev-longshun/tokenquery/internal/service"
	"github.com/gin-gonic/gin"
)

type QueryHandler struct {
	Store *service.Store
	Cfg   *config.Config
}

func parseUintParam(c *gin.Context, name string) (uint, error) {
	raw := c.Param(name)
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(v), nil
}

func hostKey(c *gin.Context) string {
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	if i := strings.Index(host, ":"); i >= 0 {
		host = host[:i]
	}
	return strings.ToLower(strings.TrimSpace(host))
}

func (h *QueryHandler) resolveSite(c *gin.Context) (*model.Site, bool) {
	host := hostKey(c)
	site, err := h.Store.FindSiteByHost(host)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("当前域名 %s 未绑定任何 NewAPI 站点", host),
		})
		return nil, false
	}
	return site, true
}

func extractBearer(c *gin.Context) (string, bool) {
	raw := c.GetHeader("X-Token-Key")
	if raw == "" {
		raw = strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请输入令牌密钥"})
		return "", false
	}
	raw = strings.TrimPrefix(raw, "sk-")
	return raw, true
}

// SiteInfo 客户端页面加载时用来显示"当前站点名称"
func (h *QueryHandler) SiteInfo(c *gin.Context) {
	site, ok := h.resolveSite(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"host": site.Host,
			"name": site.Name,
			"note": site.Note,
		},
	})
}

// Usage 代理到 NewAPI /api/usage/token/
func (h *QueryHandler) Usage(c *gin.Context) {
	site, ok := h.resolveSite(c)
	if !ok {
		return
	}
	key, ok := extractBearer(c)
	if !ok {
		return
	}
	cli := proxy.NewClient(site.BaseURL, time.Duration(h.Cfg.UpstreamTimeout)*time.Second)
	parsed, status, err := cli.GetTokenUsage(key)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if status == http.StatusUnauthorized {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "令牌无效或已被禁用"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": parsed["data"]})
}

type logsReq struct {
	Page           int    `form:"page"`
	PageSize       int    `form:"page_size"`
	ModelName      string `form:"model_name"`
	RequestID      string `form:"request_id"`
	StartTimestamp int64  `form:"start_timestamp"`
	EndTimestamp   int64  `form:"end_timestamp"`
}

func (h *QueryHandler) fetchAndFilter(c *gin.Context) ([]map[string]any, *model.Site, string, error) {
	site, ok := h.resolveSite(c)
	if !ok {
		return nil, nil, "", fmt.Errorf("site_not_found")
	}
	key, ok := extractBearer(c)
	if !ok {
		return nil, nil, "", fmt.Errorf("no_key")
	}
	cli := proxy.NewClient(site.BaseURL, time.Duration(h.Cfg.UpstreamTimeout)*time.Second)
	logs, status, err := cli.GetTokenLogs(key)
	if err != nil {
		return nil, nil, "", err
	}
	if status == http.StatusUnauthorized {
		return nil, nil, "", fmt.Errorf("令牌无效或已被禁用")
	}

	q := &logsReq{}
	_ = c.ShouldBindQuery(q)
	filtered := make([]map[string]any, 0, len(logs))
	for _, log := range logs {
		if q.ModelName != "" {
			name, _ := log["model_name"].(string)
			if !strings.Contains(strings.ToLower(name), strings.ToLower(q.ModelName)) {
				continue
			}
		}
		if q.RequestID != "" {
			rid, _ := log["request_id"].(string)
			if rid != q.RequestID {
				continue
			}
		}
		if q.StartTimestamp > 0 || q.EndTimestamp > 0 {
			ts := toInt64(log["created_at"])
			if q.StartTimestamp > 0 && ts < q.StartTimestamp {
				continue
			}
			if q.EndTimestamp > 0 && ts > q.EndTimestamp {
				continue
			}
		}
		filtered = append(filtered, log)
	}
	return filtered, site, key, nil
}

func toInt64(v any) int64 {
	switch x := v.(type) {
	case float64:
		return int64(x)
	case int64:
		return x
	case int:
		return int64(x)
	}
	return 0
}

func (h *QueryHandler) Logs(c *gin.Context) {
	filtered, _, _, err := h.fetchAndFilter(c)
	if err != nil {
		if err.Error() == "site_not_found" || err.Error() == "no_key" {
			return // 已响应
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	q := &logsReq{}
	_ = c.ShouldBindQuery(q)
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 200 {
		q.PageSize = 20
	}
	total := len(filtered)
	start := (q.Page - 1) * q.PageSize
	end := start + q.PageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"page":      q.Page,
			"page_size": q.PageSize,
			"total":     total,
			"items":     filtered[start:end],
		},
	})
}

func (h *QueryHandler) ExportLogs(c *gin.Context) {
	filtered, _, _, err := h.fetchAndFilter(c)
	if err != nil {
		if err.Error() == "site_not_found" || err.Error() == "no_key" {
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	filename := fmt.Sprintf("token-logs-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Cache-Control", "no-store")
	_, _ = c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{
		"时间", "令牌名称", "模型", "用时(秒)", "提示tokens", "补全tokens",
		"配额(原始)", "是否流式", "Request ID", "备注",
	})
	for _, log := range filtered {
		ts := toInt64(log["created_at"])
		ct := time.Unix(ts, 0).Format("2006-01-02 15:04:05")
		isStream, _ := log["is_stream"].(bool)
		_ = w.Write([]string{
			ct,
			toString(log["token_name"]),
			toString(log["model_name"]),
			strconv.FormatInt(toInt64(log["use_time"]), 10),
			strconv.FormatInt(toInt64(log["prompt_tokens"]), 10),
			strconv.FormatInt(toInt64(log["completion_tokens"]), 10),
			strconv.FormatInt(toInt64(log["quota"]), 10),
			strconv.FormatBool(isStream),
			toString(log["request_id"]),
			toString(log["content"]),
		})
	}
	w.Flush()
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
