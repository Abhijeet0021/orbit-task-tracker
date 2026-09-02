import { db } from '../config/database.js';

export class AlertController {
  static getOverdueAlerts(req, res) {
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        t.id as task_id,
        p.key || '-' || t.task_number as task_code,
        t.title as task_title,
        p.id as project_id,
        p.key as project_key,
        p.name as project_name,
        t.due_date,
        t.priority,
        t.status,
        CAST((julianday(?) - julianday(t.due_date)) AS INTEGER) as days_overdue
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN task_assignees ta ON t.id = ta.task_id
      WHERE ta.user_id = ?
        AND p.is_archived = 0
        AND t.status != 'DONE'
        AND t.due_date IS NOT NULL
        AND t.due_date < ?
        AND NOT EXISTS (
          SELECT 1 FROM alert_dismissals ad
          WHERE ad.user_id = ? 
            AND ad.task_id = t.id 
            AND ad.dismissed_due_date = t.due_date
        )
      ORDER BY t.due_date ASC
    `;

    const rawAlerts = db.prepare(query).all(todayStr, user.id, todayStr, user.id);

    const assigneesStmt = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY u.name ASC
    `);

    const alerts = rawAlerts.map(a => ({
      ...a,
      assignees: assigneesStmt.all(a.task_id)
    }));

    return res.json({
      alerts,
      count: alerts.length
    });
  }

  static dismissAlert(req, res) {
    const user = req.user;
    const { taskId } = req.body;

    const tId = parseInt(taskId, 10);
    if (isNaN(tId)) {
      return res.status(400).json({ error: 'Valid taskId is required.' });
    }

    const task = db.prepare('SELECT id, due_date FROM tasks WHERE id = ?').get(tId);
    if (!task || !task.due_date) {
      return res.status(404).json({ error: 'Overdue task not found.' });
    }

    const isAssigned = db.prepare('SELECT 1 FROM task_assignees WHERE task_id = ? AND user_id = ?').get(tId, user.id);
    if (!isAssigned) {
      return res.status(403).json({ error: 'You can only dismiss alerts for tasks assigned to you.' });
    }

    db.prepare(`
      INSERT OR REPLACE INTO alert_dismissals (user_id, task_id, dismissed_due_date, dismissed_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(user.id, tId, task.due_date);

    return res.json({ message: 'Alert dismissed successfully.' });
  }
}
