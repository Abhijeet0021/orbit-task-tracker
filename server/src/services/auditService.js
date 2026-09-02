import { db } from '../config/database.js';

export class AuditService {
  /**
   * Log an immutable activity record for a task.
   */
  static logActivity({
    taskId,
    userId = null,
    activityType,
    fieldName = null,
    oldValue = null,
    newValue = null,
    commentText = null
  }) {
    const stmt = db.prepare(`
      INSERT INTO task_activities (task_id, user_id, activity_type, field_name, old_value, new_value, comment_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(
      taskId,
      userId ?? null,
      activityType,
      fieldName ?? null,
      oldValue ?? null,
      newValue ?? null,
      commentText ?? null
    );
  }

  /**
   * Retrieve the complete, immutable timeline of a task.
   */
  static getTimeline(taskId) {
    const stmt = db.prepare(`
      SELECT 
        a.id,
        a.task_id,
        a.user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        a.activity_type,
        a.field_name,
        a.old_value,
        a.new_value,
        a.comment_text,
        a.created_at
      FROM task_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at ASC, a.id ASC
    `);

    return stmt.all(taskId);
  }
}
