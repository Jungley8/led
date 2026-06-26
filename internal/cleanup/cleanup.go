// Package cleanup runs periodic maintenance: purging expired click events
// based on the data_retention_days setting.
package cleanup

import (
	"context"
	"log"
	"time"

	"github.com/Jungley8/led/internal/models"
	"gorm.io/gorm"
)

// Start purges LinkEvents older than the retention window once at startup
// and then every 24 hours. retentionDays is called each cycle so runtime
// changes to the setting take effect without a restart.
// Pass 0 or a negative value to disable purging.
func Start(ctx context.Context, db *gorm.DB, retentionDays func() int) {
	purge := func() {
		days := retentionDays()
		if days <= 0 {
			return
		}
		cutoff := time.Now().AddDate(0, 0, -days)
		res := db.Where("created_at < ?", cutoff).Delete(&models.LinkEvent{})
		if res.Error != nil {
			log.Printf("cleanup: purge link_events: %v", res.Error)
			return
		}
		if res.RowsAffected > 0 {
			log.Printf("cleanup: purged %d link_events older than %d days", res.RowsAffected, days)
		}
	}

	purge()
	t := time.NewTicker(24 * time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			purge()
		}
	}
}
