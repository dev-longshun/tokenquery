package service

import (
	"errors"
	"fmt"

	"github.com/dev-longshun/tokenquery/internal/config"
	"github.com/dev-longshun/tokenquery/internal/model"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Store struct {
	DB *gorm.DB
}

func OpenStore(cfg *config.Config) (*Store, error) {
	db, err := gorm.Open(sqlite.Open(cfg.DBPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := db.AutoMigrate(&model.Site{}, &model.Admin{}); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Store{DB: db}, nil
}

func (s *Store) SeedAdmin(username, password string) error {
	if username == "" || password == "" {
		return nil
	}
	var count int64
	if err := s.DB.Model(&model.Admin{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	admin := &model.Admin{Username: username, PasswordHash: string(hash)}
	return s.DB.Create(admin).Error
}

func (s *Store) AuthenticateAdmin(username, password string) (*model.Admin, error) {
	var admin model.Admin
	if err := s.DB.Where("username = ?", username).First(&admin).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户名或密码错误")
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("用户名或密码错误")
	}
	return &admin, nil
}

func (s *Store) FindSiteByHost(host string) (*model.Site, error) {
	var site model.Site
	if err := s.DB.Where("host = ? AND disabled = ?", host, false).First(&site).Error; err != nil {
		return nil, err
	}
	return &site, nil
}

func (s *Store) ListSites() ([]model.Site, error) {
	var sites []model.Site
	err := s.DB.Order("id asc").Find(&sites).Error
	return sites, err
}

func (s *Store) CreateSite(site *model.Site) error {
	return s.DB.Create(site).Error
}

func (s *Store) UpdateSite(id uint, updates map[string]any) error {
	return s.DB.Model(&model.Site{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) DeleteSite(id uint) error {
	return s.DB.Delete(&model.Site{}, id).Error
}
