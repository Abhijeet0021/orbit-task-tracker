import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { AuditService } from '../services/auditService.js';
import { hasProjectAccess } from '../middleware/auth.js';

export class ProjectController {
  static async listProjects(req, res, next) {
    try {
      const user = req.user;
      const includeArchived = req.query.include_archived === 'true';

      const filter = {};
      if (!includeArchived) {
        filter.is_archived = false;
      }

      if (user.role !== 'MANAGER') {
        filter.members = user.id;
      }

      // Query projects using .lean() for fast read performance
      const projects = await Project.find(filter)
        .populate('created_by', 'name email')
        .populate('owner', 'name email role avatar_color')
        .populate('members', 'name email role avatar_color')
        .sort({ name: 1 })
        .lean();

      // Eliminate N+1 query problem by aggregating task counts in a single query
      const projectIds = projects.map(p => p._id);
      const taskCounts = await Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$project', count: { $sum: 1 } } }
      ]);

      const countMap = new Map();
      taskCounts.forEach(tc => countMap.set(tc._id.toString(), tc.count));

      const result = projects.map(p => {
        const pId = p._id.toString();
        const tasksCount = countMap.get(pId) || 0;
        return {
          id: pId,
          key: p.key,
          name: p.name,
          description: p.description,
          is_archived: p.is_archived,
          created_at: p.created_at ? p.created_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          updated_at: p.updated_at ? p.updated_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          owner_id: p.owner ? p.owner._id.toString() : null,
          owner: p.owner ? {
            id: p.owner._id.toString(),
            name: p.owner.name,
            email: p.owner.email,
            role: p.owner.role,
            avatar_color: p.owner.avatar_color
          } : null,
          members_count: p.members ? p.members.length : 0,
          tasks_count: tasksCount,
          members: (p.members || []).map(m => ({
            id: m._id.toString(),
            name: m.name,
            email: m.email,
            role: m.role,
            avatar_color: m.avatar_color
          }))
        };
      });

      return res.json({ projects: result });
    } catch (err) {
      next(err);
    }
  }

  static async getProject(req, res, next) {
    try {
      const user = req.user;
      const projectId = req.params.id;

      const hasAccess = await hasProjectAccess(projectId, user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
      }

      // Concurrently fetch project details and task count with .lean()
      const [project, tasksCount] = await Promise.all([
        Project.findById(projectId)
          .populate('created_by', 'name email')
          .populate('owner', 'name email role avatar_color')
          .populate('members', 'name email role avatar_color')
          .lean(),
        Task.countDocuments({ project: projectId })
      ]);

      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      return res.json({
        project: {
          id: project._id.toString(),
          key: project.key,
          name: project.name,
          description: project.description,
          is_archived: project.is_archived,
          created_at: project.created_at ? project.created_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          updated_at: project.updated_at ? project.updated_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          owner_id: project.owner ? project.owner._id.toString() : null,
          owner: project.owner ? {
            id: project.owner._id.toString(),
            name: project.owner.name,
            email: project.owner.email,
            role: project.owner.role,
            avatar_color: project.owner.avatar_color
          } : null,
          tasks_count: tasksCount,
          members: (project.members || []).map(m => ({
            id: m._id.toString(),
            name: m.name,
            email: m.email,
            role: m.role,
            avatar_color: m.avatar_color
          }))
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createProject(req, res, next) {
    try {
      const user = req.user;
      const { key, name, description, owner_id } = req.body;

      if (!key || !name) {
        return res.status(400).json({ error: 'Project key and name are required.' });
      }

      const normalizedKey = key.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,8}$/.test(normalizedKey)) {
        return res.status(400).json({ error: 'Project key must be 2-8 alphanumeric characters (e.g. PROJ, ENG).' });
      }

      const existing = await Project.findOne({ key: normalizedKey }).lean();
      if (existing) {
        return res.status(409).json({ error: `Project key '${normalizedKey}' is already taken.` });
      }

      // The owner defaults to the creating manager when none is named. An owner
      // is always a member of their own project.
      let ownerId = user.id;
      if (owner_id) {
        const owner = await User.findById(owner_id).select('_id').lean();
        if (!owner) {
          return res.status(404).json({ error: 'The selected project owner does not exist.' });
        }
        ownerId = owner._id.toString();
      }

      const project = await Project.create({
        key: normalizedKey,
        name: name.trim(),
        description: description?.trim() || '',
        created_by: user.id,
        owner: ownerId,
        members: Array.from(new Set([user.id, ownerId]))
      });

      return res.status(201).json({
        project: {
          id: project._id.toString(),
          key: project.key,
          name: project.name,
          description: project.description,
          owner_id: project.owner.toString(),
          is_archived: project.is_archived
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProject(req, res, next) {
    try {
      const projectId = req.params.id;
      const { name, description, owner_id } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Project name is required.' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      project.name = name.trim();
      if (description !== undefined) {
        project.description = String(description).trim();
      }

      if (owner_id !== undefined) {
        const owner = await User.findById(owner_id).select('_id').lean();
        if (!owner) {
          return res.status(404).json({ error: 'The selected project owner does not exist.' });
        }
        project.owner = owner._id;
        if (!project.members.some(m => m.toString() === owner._id.toString())) {
          project.members.push(owner._id);
        }
      }

      await project.save();

      return res.json({
        project: {
          id: project._id.toString(),
          key: project.key,
          name: project.name,
          description: project.description,
          owner_id: project.owner ? project.owner.toString() : null,
          is_archived: project.is_archived
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async archiveProject(req, res, next) {
    try {
      const projectId = req.params.id;
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      project.is_archived = true;
      await project.save();
      return res.json({ message: 'Project archived successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async restoreProject(req, res, next) {
    try {
      const projectId = req.params.id;
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      project.is_archived = false;
      await project.save();
      return res.json({ message: 'Project restored successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async addMember(req, res, next) {
    try {
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
    } catch (err) {
      next(err);
    }
  }

  static async removeMember(req, res, next) {
    try {
      const projectId = req.params.id;
      const userId = req.params.userId;
      const currentManager = req.user;

      const [project, user] = await Promise.all([
        Project.findById(projectId),
        User.findById(userId)
      ]);

      if (!project) return res.status(404).json({ error: 'Project not found.' });
      if (!user) return res.status(404).json({ error: 'User not found.' });

      if (project.owner && project.owner.toString() === user._id.toString()) {
        return res.status(400).json({
          error: `${user.name} owns this project. Assign a different owner before removing them.`
        });
      }

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
    } catch (err) {
      next(err);
    }
  }
}
