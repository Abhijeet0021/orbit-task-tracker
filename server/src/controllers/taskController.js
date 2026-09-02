import { db } from '../config/database.js';
import { hasProjectAccess } from '../middleware/auth.js';
import { AuditService } from '../services/auditService.js';
import { TaskLifecycleService } from '../services/taskLifecycle.js';

export class TaskController {
  static formatTask(rawTask) {
    const assigneesStmt = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY u.name ASC
    `);

    const blockersStmt = db.prepare(`
      SELECT 
        b.task_id,
        b.blocked_by_task_id,
        p.key || '-' || bt.task_number as blocked_by_code,
        bt.title as blocked_by_title,
        bt.status as blocked_by_status
      FROM task_blockers b
      JOIN tasks bt ON b.blocked_by_task_id = bt.id
      JOIN projects p ON bt.project_id = p.id
      WHERE b.task_id = ?
    `);

    const blockingOthersStmt = db.prepare(`
      SELECT 
        t.id,
        p.key || '-' || t.task_number as code,
        t.title,
        t.status
      FROM task_blockers b
      JOIN tasks t ON b.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE b.blocked_by_task_id = ?
    `);

    const assignees = assigneesStmt.all(rawTask.id);
    const blockers = blockersStmt.all(rawTask.id);
    const blockingOthers = blockingOthersStmt.all(rawTask.id);

    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = Boolean(
      rawTask.due_date && 
      rawTask.due_date < todayStr && 
      rawTask.status !== 'DONE'
    );

    return {
      id: rawTask.id,
      project_id: rawTask.project_id,
      project_key: rawTask.project_key,
      project_name: rawTask.project_name,
      task_number: rawTask.task_number,
      code: `${rawTask.project_key}-${rawTask.task_number}`,
      title: rawTask.title,
      description: rawTask.description || '',
      priority: rawTask.priority,
      status: rawTask.status,
      previous_status: rawTask.previous_status,
      due_date: rawTask.due_date,
      created_by: rawTask.created_by,
      created_by_name: rawTask.created_by_name,
      created_at: rawTask.created_at,
      updated_at: rawTask.updated_at,
      assignees,
      blockers,
      blocking_others: blockingOthers,
      is_overdue: isOverdue
    };
  }

  static listTasks(req, res) {
    const user = req.user;
    const {
      q,
      project_id,
      status,
      assignee_id,
      priority,
      overdue,
      sort_by = 'updated_at',
      sort_order = 'desc',
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

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

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ${whereClause}
    `;
    const totalRow = db.prepare(countQuery).get(...params);
    const total = totalRow.total;

    const validSortFields = {
      due_date: 't.due_date',
      priority: `CASE t.priority 
        WHEN 'URGENT' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
        ELSE 5 END`,
      updated_at: 't.updated_at',
      created_at: 't.created_at',
      title: 't.title',
      task_number: 't.task_number'
    };

    const sortField = validSortFields[sort_by] || 't.updated_at';
    const orderDirection = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let orderBy = `${sortField} ${orderDirection}`;
    if (sort_by === 'due_date') {
      orderBy = `CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, ${sortField} ${orderDirection}`;
    }

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
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rawTasks = db.prepare(dataQuery).all(...params, limitNum, offset);
    const tasks = rawTasks.map(t => TaskController.formatTask(t));

    return res.json({
      tasks,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  }

  static getTask(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const rawTask = db.prepare(`
      SELECT 
        t.*,
        p.key as project_key,
        p.name as project_name,
        u.name as created_by_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(taskId);

    if (!rawTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(rawTask.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const task = TaskController.formatTask(rawTask);
    const unfinishedBlockers = TaskLifecycleService.getUnfinishedBlockers(taskId);
    const legalTransitions = TaskLifecycleService.getLegalTransitions(task.status, task.previous_status, unfinishedBlockers);
    const timeline = AuditService.getTimeline(taskId);

    return res.json({
      task,
      legalTransitions,
      timeline
    });
  }

  static createTask(req, res) {
    const user = req.user;
    const { project_id, title, description, priority = 'MEDIUM', due_date, assignee_ids = [], blocker_ids = [] } = req.body;

    const projectId = parseInt(project_id, 10);
    if (isNaN(projectId) || !title || !title.trim()) {
      return res.status(400).json({ error: 'Project ID and task title are required.' });
    }

    if (!hasProjectAccess(projectId, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value.' });
    }

    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      for (const uid of assignee_ids) {
        const isMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, uid);
        if (!isMember) {
          const u = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
          return res.status(400).json({ 
            error: `Cannot assign user ${u ? u.name : uid}: user is not a member of this project.` 
          });
        }
      }
    }

    const createTaskTx = db.transaction(() => {
      const maxNumRow = db.prepare('SELECT COALESCE(MAX(task_number), 0) as maxNum FROM tasks WHERE project_id = ?').get(projectId);
      const taskNumber = maxNumRow.maxNum + 1;

      const insertStmt = db.prepare(`
        INSERT INTO tasks (project_id, task_number, title, description, priority, status, previous_status, due_date, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'BACKLOG', NULL, ?, ?, datetime('now'), datetime('now'))
      `);

      const result = insertStmt.run(
        projectId,
        taskNumber,
        title.trim(),
        description?.trim() || '',
        priority,
        due_date || null,
        user.id
      );

      const taskId = result.lastInsertRowid;

      if (Array.isArray(assignee_ids)) {
        const assignStmt = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_at) VALUES (?, ?, datetime(\'now\'))');
        for (const uid of assignee_ids) {
          assignStmt.run(taskId, uid);
          const u = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
          AuditService.logActivity({
            taskId,
            userId: user.id,
            activityType: 'ASSIGNED',
            oldValue: null,
            newValue: `${u?.name || uid}`,
            commentText: `Assigned on task creation.`
          });
        }
      }

      if (Array.isArray(blocker_ids)) {
        const blockerStmt = db.prepare('INSERT OR IGNORE INTO task_blockers (task_id, blocked_by_task_id, created_at) VALUES (?, ?, datetime(\'now\'))');
        for (const bId of blocker_ids) {
          const blockerTask = db.prepare('SELECT id, project_id, task_number, title FROM tasks WHERE id = ?').get(bId);
          if (blockerTask && blockerTask.project_id === projectId) {
            blockerStmt.run(taskId, bId);
            AuditService.logActivity({
              taskId,
              userId: user.id,
              activityType: 'BLOCKER_ADDED',
              newValue: `Blocked by #${blockerTask.task_number}: ${blockerTask.title}`
            });
          }
        }
      }

      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'CREATED',
        newValue: `Created task "${title.trim()}" with priority ${priority}`
      });

      return taskId;
    });

    const newTaskId = createTaskTx();

    const createdRaw = db.prepare(`
      SELECT 
        t.*,
        p.key as project_key,
        p.name as project_name,
        u.name as created_by_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(newTaskId);

    return res.status(201).json({ task: TaskController.formatTask(createdRaw) });
  }

  static updateTask(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const { title, description, priority, due_date, status } = req.body;

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const currentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(currentTask.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const updates = [];
    const updateParams = [];

    if (title !== undefined && title.trim() !== currentTask.title) {
      updates.push('title = ?');
      updateParams.push(title.trim());
      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'FIELD_UPDATED',
        fieldName: 'title',
        oldValue: currentTask.title,
        newValue: title.trim()
      });
    }

    if (description !== undefined && (description.trim() || '') !== (currentTask.description || '')) {
      updates.push('description = ?');
      updateParams.push(description.trim());
      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'FIELD_UPDATED',
        fieldName: 'description',
        oldValue: currentTask.description || '(empty)',
        newValue: description.trim() || '(empty)'
      });
    }

    if (priority !== undefined && priority !== currentTask.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value.' });
      }
      updates.push('priority = ?');
      updateParams.push(priority);
      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'FIELD_UPDATED',
        fieldName: 'priority',
        oldValue: currentTask.priority,
        newValue: priority
      });
    }

    if (due_date !== undefined && due_date !== currentTask.due_date) {
      const formattedDate = due_date ? due_date.split('T')[0] : null;
      updates.push('due_date = ?');
      updateParams.push(formattedDate);
      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'FIELD_UPDATED',
        fieldName: 'due_date',
        oldValue: currentTask.due_date || '(none)',
        newValue: formattedDate || '(none)'
      });

      db.prepare('DELETE FROM alert_dismissals WHERE task_id = ?').run(taskId);
    }

    if (status !== undefined && status !== currentTask.status) {
      const validation = TaskLifecycleService.validateTransition(
        {
          id: currentTask.id,
          status: currentTask.status,
          previous_status: currentTask.previous_status,
          project_id: currentTask.project_id
        },
        status
      );

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      updates.push('status = ?', 'previous_status = ?');
      updateParams.push(status, validation.previousStatus ?? null);

      AuditService.logActivity({
        taskId,
        userId: user.id,
        activityType: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: currentTask.status,
        newValue: status
      });
    }

    if (updates.length === 0) {
      const formatted = TaskController.formatTask(
        db.prepare(`
          SELECT t.*, p.key as project_key, p.name as project_name, u.name as created_by_name
          FROM tasks t
          JOIN projects p ON t.project_id = p.id
          JOIN users u ON t.created_by = u.id
          WHERE t.id = ?
        `).get(taskId)
      );
      return res.json({ task: formatted });
    }

    updates.push('updated_at = datetime(\'now\')');
    updateParams.push(taskId);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...updateParams);

    const updatedRaw = db.prepare(`
      SELECT t.*, p.key as project_key, p.name as project_name, u.name as created_by_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(taskId);

    return res.json({ task: TaskController.formatTask(updatedRaw) });
  }

  static deleteTask(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    if (user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers can delete tasks.' });
    }

    const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    return res.json({ message: `Task "${task.title}" deleted successfully.` });
  }

  static addAssignee(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(task.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, userId);
    if (!isMember) {
      return res.status(400).json({ error: `User ${targetUser.name} is not a member of this project.` });
    }

    db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_at) VALUES (?, ?, datetime(\'now\'))').run(taskId, userId);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    AuditService.logActivity({
      taskId,
      userId: user.id,
      activityType: 'ASSIGNED',
      oldValue: null,
      newValue: targetUser.name
    });

    return res.json({ message: `Assigned ${targetUser.name} to task.` });
  }

  static removeAssignee(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(task.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?').run(taskId, userId);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    AuditService.logActivity({
      taskId,
      userId: user.id,
      activityType: 'UNASSIGNED',
      oldValue: targetUser.name,
      newValue: null
    });

    return res.json({ message: `Unassigned ${targetUser.name} from task.` });
  }

  static addBlocker(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const { blockerTaskId } = req.body;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    const blockerTask = db.prepare(`
      SELECT t.*, p.key as project_key
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(blockerTaskId);

    if (!task || !blockerTask) {
      return res.status(404).json({ error: 'Task or blocker task not found.' });
    }

    if (!hasProjectAccess(task.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    if (task.project_id !== blockerTask.project_id) {
      return res.status(400).json({ error: 'Blocker task must belong to the same project.' });
    }

    if (task.id === blockerTaskId) {
      return res.status(400).json({ error: 'A task cannot block itself.' });
    }

    if (TaskLifecycleService.wouldCreateCycle(taskId, blockerTaskId)) {
      return res.status(400).json({ error: 'Cannot add blocker: this would create a circular dependency cycle.' });
    }

    db.prepare('INSERT OR IGNORE INTO task_blockers (task_id, blocked_by_task_id, created_at) VALUES (?, ?, datetime(\'now\'))').run(taskId, blockerTaskId);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    AuditService.logActivity({
      taskId,
      userId: user.id,
      activityType: 'BLOCKER_ADDED',
      newValue: `Blocked by ${blockerTask.project_key}-${blockerTask.task_number}: ${blockerTask.title}`
    });

    return res.json({ message: 'Blocker added successfully.' });
  }

  static removeBlocker(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const blockerTaskId = parseInt(req.params.blockerId, 10);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    const blockerTask = db.prepare(`
      SELECT t.*, p.key as project_key
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(blockerTaskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(task.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    db.prepare('DELETE FROM task_blockers WHERE task_id = ? AND blocked_by_task_id = ?').run(taskId, blockerTaskId);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    AuditService.logActivity({
      taskId,
      userId: user.id,
      activityType: 'BLOCKER_REMOVED',
      oldValue: blockerTask ? `${blockerTask.project_key}-${blockerTask.task_number}: ${blockerTask.title}` : `Task #${blockerTaskId}`
    });

    return res.json({ message: 'Blocker removed successfully.' });
  }

  static addComment(req, res) {
    const user = req.user;
    const taskId = parseInt(req.params.id, 10);
    const { comment } = req.body;

    if (isNaN(taskId) || !comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    if (!hasProjectAccess(task.project_id, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    AuditService.logActivity({
      taskId,
      userId: user.id,
      activityType: 'COMMENT_ADDED',
      commentText: comment.trim()
    });

    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    return res.status(201).json({ message: 'Comment added successfully.' });
  }
}
