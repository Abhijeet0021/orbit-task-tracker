import { db } from '../config/database.js';
import { hasProjectAccess } from '../middleware/auth.js';
import { AuditService } from '../services/auditService.js';

export class ProjectController {
  static listProjects(req, res) {
    const user = req.user;
    const includeArchived = req.query.include_archived === 'true';

    let query = `
      SELECT 
        p.id,
        p.key,
        p.name,
        p.description,
        p.owner_id,
        u.name as owner_name,
        u.email as owner_email,
        p.is_archived,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as members_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as tasks_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
    `;

    const conditions = [];
    const params = [];

    if (!includeArchived) {
      conditions.push('p.is_archived = 0');
    }

    if (user.role !== 'MANAGER') {
      conditions.push('p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
      params.push(user.id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY p.name ASC';

    const projects = db.prepare(query).all(...params);

    const memberStmt = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name ASC
    `);

    const result = projects.map(p => ({
      ...p,
      is_archived: Boolean(p.is_archived),
      members: memberStmt.all(p.id)
    }));

    return res.json({ projects: result });
  }

  static getProject(req, res) {
    const user = req.user;
    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }

    if (!hasProjectAccess(projectId, user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const stmt = db.prepare(`
      SELECT 
        p.id,
        p.key,
        p.name,
        p.description,
        p.owner_id,
        u.name as owner_name,
        u.email as owner_email,
        p.is_archived,
        p.created_at,
        p.updated_at
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `);

    const project = stmt.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name ASC
    `).all(projectId);

    return res.json({
      project: {
        ...project,
        is_archived: Boolean(project.is_archived),
        members
      }
    });
  }

  static createProject(req, res) {
    const user = req.user;
    const { key, name, description } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: 'Project key and name are required.' });
    }

    const normalizedKey = key.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(normalizedKey)) {
      return res.status(400).json({ error: 'Project key must be 2-8 alphanumeric characters (e.g. PROJ, ENG).' });
    }

    const existing = db.prepare('SELECT id FROM projects WHERE key = ? COLLATE NOCASE').get(normalizedKey);
    if (existing) {
      return res.status(409).json({ error: `Project key '${normalizedKey}' is already taken.` });
    }

    const insertStmt = db.prepare(`
      INSERT INTO projects (key, name, description, owner_id, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `);

    const result = insertStmt.run(normalizedKey, name.trim(), description?.trim() || '', user.id);
    const projectId = result.lastInsertRowid;

    db.prepare(`INSERT OR IGNORE INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, datetime('now'))`).run(projectId, user.id);

    const createdProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return res.status(201).json({ project: createdProject });
  }

  static updateProject(req, res) {
    const projectId = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    db.prepare(`
      UPDATE projects 
      SET name = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name.trim(), description?.trim() || '', projectId);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return res.json({ project: updated });
  }

  static archiveProject(req, res) {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    db.prepare(`UPDATE projects SET is_archived = 1, updated_at = datetime('now') WHERE id = ?`).run(projectId);
    return res.json({ message: 'Project archived successfully.' });
  }

  static restoreProject(req, res) {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    db.prepare(`UPDATE projects SET is_archived = 0, updated_at = datetime('now') WHERE id = ?`).run(projectId);
    return res.json({ message: 'Project restored successfully.' });
  }

  static addMember(req, res) {
    const projectId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    if (isNaN(projectId) || !userId) {
      return res.status(400).json({ error: 'Project ID and user ID are required.' });
    }

    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO project_members (project_id, user_id, joined_at)
      VALUES (?, ?, datetime('now'))
    `).run(projectId, userId);

    return res.json({ message: `User ${user.name} added to project.` });
  }

  static removeMember(req, res) {
    const projectId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const currentManager = req.user;

    if (isNaN(projectId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid project ID or user ID.' });
    }

    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const removeTransaction = db.transaction(() => {
      const assignedTasks = db.prepare(`
        SELECT t.id, t.title 
        FROM tasks t
        JOIN task_assignees ta ON t.id = ta.task_id
        WHERE t.project_id = ? AND ta.user_id = ?
      `).all(projectId, userId);

      for (const task of assignedTasks) {
        db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?').run(task.id, userId);
        AuditService.logActivity({
          taskId: task.id,
          userId: currentManager.id,
          activityType: 'UNASSIGNED',
          oldValue: `${user.name} (${user.id})`,
          newValue: null,
          commentText: `User was removed from the project and unassigned.`
        });
      }

      db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
    });

    removeTransaction();

    return res.json({ message: `User ${user.name} removed from project and unassigned from its tasks.` });
  }
}
