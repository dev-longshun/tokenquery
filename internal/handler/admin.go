package handler

import (
	"net/http"
	"time"

	"github.com/dev-longshun/tokenquery/internal/config"
	"github.com/dev-longshun/tokenquery/internal/middleware"
	"github.com/dev-longshun/tokenquery/internal/model"
	"github.com/dev-longshun/tokenquery/internal/proxy"
	"github.com/dev-longshun/tokenquery/internal/service"
	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	Store *service.Store
	Cfg   *config.Config
}

type loginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AdminHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	admin, err := h.Store.AuthenticateAdmin(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	tok, err := middleware.IssueAdminToken(h.Cfg.JWTSecret, admin.ID, admin.Username, 12*time.Hour)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "签发 token 失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"token": tok, "username": admin.Username},
	})
}

func (h *AdminHandler) Me(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"username": c.GetString("admin_username"),
		},
	})
}

type siteReq struct {
	Host     string `json:"host" binding:"required"`
	Name     string `json:"name" binding:"required"`
	BaseURL  string `json:"base_url" binding:"required"`
	Note     string `json:"note"`
	Disabled bool   `json:"disabled"`
}

func (h *AdminHandler) ListSites(c *gin.Context) {
	sites, err := h.Store.ListSites()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": sites})
}

func (h *AdminHandler) CreateSite(c *gin.Context) {
	var req siteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if err := proxy.ValidateBaseURL(req.BaseURL); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	site := &model.Site{
		Host:     req.Host,
		Name:     req.Name,
		BaseURL:  req.BaseURL,
		Note:     req.Note,
		Disabled: req.Disabled,
	}
	if err := h.Store.CreateSite(site); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": site})
}

func (h *AdminHandler) UpdateSite(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "id 非法"})
		return
	}
	var req siteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if err := proxy.ValidateBaseURL(req.BaseURL); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.Store.UpdateSite(id, map[string]any{
		"host":     req.Host,
		"name":     req.Name,
		"base_url": req.BaseURL,
		"note":     req.Note,
		"disabled": req.Disabled,
	}); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *AdminHandler) DeleteSite(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "id 非法"})
		return
	}
	if err := h.Store.DeleteSite(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
