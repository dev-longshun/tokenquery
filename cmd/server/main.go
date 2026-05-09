package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

	"github.com/dev-longshun/tokenquery/internal/config"
	"github.com/dev-longshun/tokenquery/internal/handler"
	"github.com/dev-longshun/tokenquery/internal/middleware"
	"github.com/dev-longshun/tokenquery/internal/service"
	"github.com/gin-gonic/gin"
)

//go:embed all:webdist
var webDist embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load: %v", err)
	}
	store, err := service.OpenStore(cfg)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	if cfg.InitAdminUser != "" && cfg.InitAdminPass != "" {
		if err := store.SeedAdmin(cfg.InitAdminUser, cfg.InitAdminPass); err != nil {
			log.Fatalf("seed admin: %v", err)
		}
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.LoggerWithWriter(gin.DefaultWriter, "/healthz"))

	adminH := &handler.AdminHandler{Store: store, Cfg: cfg}
	queryH := &handler.QueryHandler{Store: store, Cfg: cfg}

	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok\n")
	})

	api := r.Group("/api")
	{
		api.GET("/site", queryH.SiteInfo)
		api.GET("/usage", queryH.Usage)
		api.GET("/logs", queryH.Logs)
		api.GET("/logs/export", queryH.ExportLogs)

		api.POST("/admin/login", adminH.Login)
		adminG := api.Group("/admin", middleware.AdminAuth(cfg.JWTSecret))
		adminG.GET("/me", adminH.Me)
		adminG.GET("/sites", adminH.ListSites)
		adminG.POST("/sites", adminH.CreateSite)
		adminG.PUT("/sites/:id", adminH.UpdateSite)
		adminG.DELETE("/sites/:id", adminH.DeleteSite)
	}

	mountWeb(r)

	log.Printf("tokenquery listening on %s", cfg.ListenAddr)
	if err := r.Run(cfg.ListenAddr); err != nil {
		log.Fatal(err)
	}
}

func mountWeb(r *gin.Engine) {
	sub, err := fs.Sub(webDist, "webdist")
	if err != nil {
		log.Printf("web dist 未嵌入，跳过前端挂载: %v", err)
		return
	}
	fileServer := http.FileServer(http.FS(sub))
	r.NoRoute(func(c *gin.Context) {
		req := c.Request
		path := req.URL.Path
		// API 前缀不走 SPA
		if len(path) >= 4 && path[:4] == "/api" {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
			return
		}
		// 静态资源直接返回
		if f, err := sub.Open(normalizeFSPath(path)); err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(c.Writer, req)
			return
		}
		// SPA fallback: 读取 index.html
		data, err := fs.ReadFile(sub, "index.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
}

func normalizeFSPath(p string) string {
	if p == "" || p == "/" {
		return "index.html"
	}
	if p[0] == '/' {
		return p[1:]
	}
	return p
}
