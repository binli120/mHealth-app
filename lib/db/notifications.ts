/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type { CreateNotificationInput, Notification, NotificationRow } from "@/lib/notifications/types"
import { rowToNotification } from "@/lib/notifications/types"

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<NotificationRow>(
    `SELECT id, user_id, type, title, body, metadata, read_at, email_sent_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  )
  return rows.map(rowToNotification)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return parseInt(rows[0]?.count ?? "0", 10)
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const pool = getDbPool()
  const { rows } = await pool.query<NotificationRow>(
    `INSERT INTO notifications (user_id, type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, body, metadata, read_at, email_sent_at, created_at`,
    [input.userId, input.type, input.title, input.body, JSON.stringify(input.metadata ?? {})],
  )
  return rowToNotification(rows[0])
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId],
  )
}

export async function markAllAsRead(userId: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
}

export async function markEmailSent(notificationId: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE notifications SET email_sent_at = NOW() WHERE id = $1`,
    [notificationId],
  )
}
