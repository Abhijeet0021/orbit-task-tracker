import { db } from '../config/database.js';
import { hasProjectAccess } from '../middleware/auth.js';
import { TaskLifecycleService } from '../services/taskLifecycle.js';
import { AuditService } from '../services/auditService.js';

export class BulkController {
  static executeBulk(req, res) {
    const user = req.user;
    const task_ids = req.body.task_ids || req.body.taskIds || [];
    let action = req.body.action;
    let payload = req.body.payload || {};

    // Auto-detect action if payload carries status, assignee/userId, due_date, or priority directly
    if (!action) {
      if (payload.status || req.body.status) {
        action = 'UPDATE_STATUS';
        payload = { status: payload.status || req.body.status };
      } else if (payload.userId || payload.assignee || req.body.userId || req.body.assignee) {
        action = 'ASSIGN_USER';
        payload = { userId: payload.userId || payload.assignee || req.body.userId || req.body.assignee };
      } else if (payload.due_date || req.body.due_date || req.body.dueDate) {
        action = 'SET_DUE_DATE';
        payload = { due_date: payload.due_date || req.body.due_date || req.body.dueDate };
      } else if (payload.priority || req.body.priority) {
        action = 'SET_PRIORITY';
        payload = { priority: payload.priority || req.body.priority };
      }
    }

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ error: 'Array of task_ids is required.' });
    }

    if (!action) {
      return res.status(400).json({ error: 'Action type or valid payload (status, assignee, due_date, priority) is required.' });
    }

    const results = [];

    for (const taskId of task_ids) {
      const task = db.prepare(`
        SELECT t.*, p.key as project_key
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?
      `).get(taskId);

      if (!task) {
        results.push({
          taskId,
          code: `#${taskId}`,
          title: 'Unknown Task',
          success: false,
          error: 'Task does not exist.'
        });
        continue;
      }

      const taskCode = `${task.project_key}-${task.task_number}`;

      if (!hasProjectAccess(task.project_id, user)) {
        results.push({
          taskId,
          code: taskCode,
          title: task.title,
          success: false,
          error: 'Access denied: You do not have access to this project.'
        });
        continue;
      }

      try {
        switch (action) {
          case 'UPDATE_STATUS': {
            const targetStatus = payload?.status;
            if (!targetStatus) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: 'Target status not provided.'
              });
              break;
            }

            const validation = TaskLifecycleService.validateTransition(
              {
                id: task.id,
                status: task.status,
                previous_status: task.previous_status,
                project_id: task.project_id
              },
              targetStatus
            );

            if (!validation.valid) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: validation.error
              });
              break;
            }

            db.prepare(`
              UPDATE tasks 
              SET status = ?, previous_status = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(targetStatus, validation.previousStatus ?? null, taskId);

            AuditService.logActivity({
              taskId,
              userId: user.id,
              activityType: 'STATUS_CHANGED',
              fieldName: 'status',
              oldValue: task.status,
              newValue: targetStatus,
              commentText: 'Bulk status update.'
            });

            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: true,
              message: `Status moved from ${task.status.replace('_', ' ')} to ${targetStatus.replace('_', ' ')}.`
            });
            break;
          }

          case 'ASSIGN_USER': {
            const targetUserId = parseInt(payload?.userId, 10);
            if (isNaN(targetUserId)) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: 'Valid target userId required.'
              });
              break;
            }

            const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId);
            if (!targetUser) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: 'Target user not found.'
              });
              break;
            }

            const isMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, targetUserId);
            if (!isMember) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: `User ${targetUser.name} is not a member of project ${task.project_key}.`
              });
              break;
            }

            db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_at) VALUES (?, ?, datetime(\'now\'))').run(taskId, targetUserId);
            db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

            AuditService.logActivity({
              taskId,
              userId: user.id,
              activityType: 'ASSIGNED',
              newValue: targetUser.name,
              commentText: 'Bulk assignment.'
            });

            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: true,
              message: `Assigned to ${targetUser.name}.`
            });
            break;
          }

          case 'SET_DUE_DATE': {
            const newDueDate = payload?.due_date ? payload.due_date.split('T')[0] : null;
            db.prepare('UPDATE tasks SET due_date = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newDueDate, taskId);
            
            db.prepare('DELETE FROM alert_dismissals WHERE task_id = ?').run(taskId);

            AuditService.logActivity({
              taskId,
              userId: user.id,
              activityType: 'FIELD_UPDATED',
              fieldName: 'due_date',
              oldValue: task.due_date || '(none)',
              newValue: newDueDate || '(none)',
              commentText: 'Bulk due date update.'
            });

            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: true,
              message: newDueDate ? `Due date set to ${newDueDate}.` : 'Due date cleared.'
            });
            break;
          }

          case 'SET_PRIORITY': {
            const newPriority = payload?.priority;
            const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
            if (!validPriorities.includes(newPriority)) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: 'Invalid priority provided.'
              });
              break;
            }

            db.prepare('UPDATE tasks SET priority = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newPriority, taskId);
            AuditService.logActivity({
              taskId,
              userId: user.id,
              activityType: 'FIELD_UPDATED',
              fieldName: 'priority',
              oldValue: task.priority,
              newValue: newPriority,
              commentText: 'Bulk priority update.'
            });

            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: true,
              message: `Priority updated to ${newPriority}.`
            });
            break;
          }

          default:
            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: false,
              error: `Unknown action: ${action}`
            });
        }
      } catch (err) {
        results.push({
          taskId,
          code: taskCode,
          title: task.title,
          success: false,
          error: err.message || 'Operation failed.'
        });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return res.json({
      summary: {
        total: results.length,
        succeeded,
        failed
      },
      results
    });
  }

  static exportCsv(req, res) {
    const user = req.user;
    const { q, project_id, status, assignee_id, priority, overdue, sort_by = 'updated_at', sort_order = 'desc' } = req.query;

    const conditions = [];
    const params = [];

    if (user.role !== 'MANAGER') {
      conditions.push('t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
      params.push(user.id);
    }

    if (!project_id) {
      conditions.push('p.is_archived = 0');
    }

    if (project_id) {
      const projId = parseInt(project_id, 10);
      if (!isNaN(projId)) {
        conditions.push('t.project_id = ?');
        params.push(projId);
      }
    }

    if (status) {
      const statusList = status.split(',').map(s => s.trim().toUpperCase());
      const placeholders = statusList.map(() => '?').join(',');
      conditions.push(`t.status IN (${placeholders})`);
      params.push(...statusList);
    }

    if (priority) {
      const priorityList = priority.split(',').map(p => p.trim().toUpperCase());
      const placeholders = priorityList.map(() => '?').join(',');
      conditions.push(`t.priority IN (${placeholders})`);
      params.push(...priorityList);
    }

    if (assignee_id) {
      if (assignee_id === 'unassigned') {
        conditions.push('t.id NOT IN (SELECT task_id FROM task_assignees)');
      } else {
        const aId = parseInt(assignee_id, 10);
        if (!isNaN(aId)) {
          conditions.push('t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)');
          params.push(aId);
        }
      }
    }

    if (overdue === 'true') {
      const todayStr = new Date().toISOString().split('T')[0];
      conditions.push('t.due_date IS NOT NULL AND t.due_date < ? AND t.status != ?');
      params.push(todayStr, 'DONE');
    }

    if (q && typeof q === 'string' && q.trim().length > 0) {
      const searchPattern = `%${q.trim()}%`;
      conditions.push('(t.title LIKE ? OR t.description LIKE ? OR (p.key || \'-\' || t.task_number) LIKE ?)');
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortFields = {
      due_date: 't.due_date',
      priority: `CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END`,
      updated_at: 't.updated_at',
      created_at: 't.created_at',
      title: 't.title',
      task_number: 't.task_number'
    };

    const sortField = validSortFields[sort_by] || 't.updated_at';
    const orderDirection = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT 
        t.*,
        p.key as project_key,
        p.name as project_name,
        u.name as created_by_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY ${sortField} ${orderDirection}
    `;

    const tasks = db.prepare(dataQuery).all(...params);

    const assigneesStmt = db.prepare(`
      SELECT u.name
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
    `);

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const headers = ['Key', 'Project', 'Title', 'Description', 'Status', 'Priority', 'Assignees', 'Due Date', 'Created By', 'Created At', 'Updated At'];
    const rows = [headers.join(',')];

    for (const t of tasks) {
      const assignees = assigneesStmt.all(t.id).map(a => a.name).join('; ');
      rows.push([
        escapeCsv(`${t.project_key}-${t.task_number}`),
        escapeCsv(t.project_name),
        escapeCsv(t.title),
        escapeCsv(t.description),
        escapeCsv(t.status),
        escapeCsv(t.priority),
        escapeCsv(assignees),
        escapeCsv(t.due_date || ''),
        escapeCsv(t.created_by_name),
        escapeCsv(t.created_at),
        escapeCsv(t.updated_at)
      ].join(','));
    }

    const csvContent = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-export-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csvContent);
  }
}
