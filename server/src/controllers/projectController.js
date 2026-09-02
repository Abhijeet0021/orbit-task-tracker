import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { AuditService } from '../services/auditService.js';
import { hasProjectAccess } from '../middleware/auth.js';

export class ProjectController {
  static async listProjects(req, res) {
    const user = req.user;
    const includeArchived = req.query.include_archived === 'true';

    const filter = {};
    if (!includeArchived) {
      filter.is_archived = false;
    }

    if (user.role !== 'MANAGER') {
      filter.members = user.id;
    }

    const projects = await Project.find(filter)
      .populate('created_by', 'name email')
      .populate('members', 'name email role avatar_color')
      .sort({ name: 1 });

    const result = await Promise.all(projects.map(async (p) => {
      const tasksCount = await Task.countDocuments({ project: p._id });
      return {
        id: p._id.toString(),
        key: p.key,
        name: p.name,
        description: p.description,
        is_archived: p.is_archived,
        created_at: p.created_at.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: p.updated_at.toISOString().replace('T', ' ').substring(0, 19),
        members_count: p.members.length,
        tasks_count: tasksCount,
        members: p.members.map(m => ({
          id: m._id.toString(),
          name: m.name,
          email: m.email,
          role: m.role,
          avatar_color: m.avatar_color
        }))
      };
    }));

    return res.json({ projects: result });
  }

  static async getProject(req, res) {
    const user = req.user;
    const projectId = req.params.id;

    const hasAccess = await hasProjectAccess(projectId, user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }

    const project = await Project.findById(projectId)
      .populate('created_by', 'name email')
      .populate('members', 'name email role avatar_color');

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const tasksCount = await Task.countDocuments({ project: project._id });

    return res.json({
      project: {
        id: project._id.toString(),
        key: project.key,
        name: project.name,
        description: project.description,
        is_archived: project.is_archived,
        created_at: project.created_at.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: project.updated_at.toISOString().replace('T', ' ').substring(0, 19),
        tasks_count: tasksCount,
        members: project.members.map(m => ({
          id: m._id.toString(),
          name: m.name,
          email: m.email,
          role: m.role,
          avatar_color: m.avatar_color
        }))
      }
    });
  }

  static async createProject(req, res) {
    const user = req.user;
    const { key, name, description } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: 'Project key and name are required.' });
    }

    const normalizedKey = key.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(normalizedKey)) {
      return res.status(400).json({ error: 'Project key must be 2-8 alphanumeric characters (e.g. PROJ, ENG).' });
    }

    const existing = await Project.findOne({ key: normalizedKey });
    if (existing) {
      return res.status(409).json({ error: `Project key '${normalizedKey}' is already taken.` });
    }

    const project = await Project.create({
      key: normalizedKey,
      name: name.trim(),
      description: description?.trim() || '',
      created_by: user.id,
      members: [user.id]
    });

    return res.status(201).json({
      project: {
        id: project._id.toString(),
        key: project.key,
        name: project.name,
        description: project.description,
        is_archived: project.is_archived
      }
    });
  }

  static async updateProject(req, res) {
    const projectId = req.params.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    project.name = name.trim();
    if (description !== undefined) {
      project.description = description.trim();
    }
    await project.save();

    return res.json({
      project: {
        id: project._id.toString(),
        key: project.key,
        name: project.name,
        description: project.description,
        is_archived: project.is_archived
      }
    });
  }

  static async archiveProject(req, res) {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    project.is_archived = true;
    await project.save();
    return res.json({ message: 'Project archived successfully.' });
  }

  static async restoreProject(req, res) {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    project.is_archived = false;
    await project.save();
    return res.json({ message: 'Project restored successfully.' });
  }

  static async addMember(req, res) {
    const projectId = req.params.id;
    const { userId } = req.body;

    if (!projectId || !userId) {
      return res.status(400).json({ error: 'Project ID and user ID are required.' });
    }

    const [project, user] = await Promise.all([
      Project.findById(projectId),
      User.findById(userId)
    ]);

    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!project.members.some(m => m.toString() === userId.toString())) {
      project.members.push(user._id);
      await project.save();
    }

    return res.json({ message: `User ${user.name} added to project.` });
  }

  static async removeMember(req, res) {
    const projectId = req.params.id;
    const userId = req.params.userId;
    const currentManager = req.user;

    const [project, user] = await Promise.all([
      Project.findById(projectId),
      User.findById(userId)
    ]);

    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // 1. Unassign user from all tasks in this project
    const assignedTasks = await Task.find({ project: project._id, assignees: user._id });

    for (const task of assignedTasks) {
      task.assignees = task.assignees.filter(a => a.toString() !== user._id.toString());
      await task.save();

      await AuditService.logActivity({
        taskId: task._id,
        userId: currentManager.id,
        activityType: 'UNASSIGNED',
        oldValue: `${user.name} (${user._id})`,
        newValue: null,
        commentText: 'User was removed from the project and unassigned.'
      });
    }

    // 2. Remove user from project members
    project.members = project.members.filter(m => m.toString() !== user._id.toString());
    await project.save();

    return res.json({ message: `User ${user.name} removed from project and unassigned from its tasks.` });
  }
}
