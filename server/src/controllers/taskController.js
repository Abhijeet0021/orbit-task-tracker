import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { TaskLifecycleService } from '../services/taskLifecycle.js';
import { AuditService } from '../services/auditService.js';
import { hasProjectAccess } from '../middleware/auth.js';

// Whitelisted sort keys. `priority` maps to the derived numeric rank so that
// "sort by priority" orders by severity rather than alphabetically.
const SORT_FIELDS = {
  updated_at: 'updated_at',
  created_at: 'created_at',
  due_date: 'due_date',
  priority: 'priority_rank',
  title: 'title',
  status: 'status'
};

export class TaskController {
  static async listTasks(req, res, next) {
    try {
      const user = req.user;
      const {
        q,
        project_id,
        status,
        priority,
        assignee_id,
        overdue,
        sort_by = 'updated_at',
        sort_order = 'desc',
        page = 1,
        limit = 20
      } = req.query;

      const filter = {};

      // Project scoping for non-managers
      if (user.role !== 'MANAGER') {
        const userProjects = await Project.find({ members: user.id }).select('_id').lean();
        const allowedIds = userProjects.map(p => p._id);
        if (project_id) {
          if (!allowedIds.some(id => id.toString() === project_id.toString())) {
            return res.json({ tasks: [], pagination: { total: 0, page: 1, limit: Number(limit), totalPages: 0 } });
          }
          filter.project = project_id;
        } else {
          filter.project = { $in: allowedIds };
        }
      } else if (project_id) {
        filter.project = project_id;
      }

      if (status) filter.status = status;
      if (priority) filter.priority = priority;

      if (assignee_id) {
        if (assignee_id === 'unassigned') {
          filter.assignees = { $size: 0 };
        } else {
          filter.assignees = assignee_id;
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (overdue === 'true') {
        filter.due_date = { $ne: null, $lt: todayStr };
        filter.status = { $ne: 'DONE' };
      }

      if (q && q.trim()) {
        const searchRegex = new RegExp(q.trim(), 'i');
        filter.$or = [
          { title: searchRegex },
          { description: searchRegex }
        ];
      }

      const sortField = SORT_FIELDS[sort_by] || 'updated_at';
      const sortDir = sort_order.toLowerCase() === 'asc' ? 1 : -1;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      // Parallelize task retrieval with .lean() and total count
      const [tasks, total] = await Promise.all([
        Task.find(filter)
          .populate('project', 'key name')
          .populate('assignees', 'name email role avatar_color')
          .populate('blockers', 'task_number title status')
          .sort({ [sortField]: sortDir })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Task.countDocuments(filter)
      ]);

      const formattedTasks = tasks.map(t => {
        const isOverdue = Boolean(t.due_date && t.due_date < todayStr && t.status !== 'DONE');
        return {
          id: t._id.toString(),
          code: `${t.project?.key || 'TASK'}-${t.task_number}`,
          task_number: t.task_number,
          project_id: t.project?._id.toString(),
          project_key: t.project?.key || '',
          project_name: t.project?.name || '',
          title: t.title,
          description: t.description,
          status: t.status,
          previous_status: t.previous_status,
          priority: t.priority,
          due_date: t.due_date,
          is_overdue: isOverdue,
          created_at: t.created_at ? t.created_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          updated_at: t.updated_at ? t.updated_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          assignees: (t.assignees || []).map(a => ({
            id: a._id.toString(),
            name: a.name,
            email: a.email,
            role: a.role,
            avatar_color: a.avatar_color
          })),
          blockers: (t.blockers || []).map(b => ({
            id: b._id.toString(),
            title: b.title,
            status: b.status
          }))
        };
      });

      return res.json({
        tasks: formattedTasks,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTask(req, res, next) {
    try {
      const user = req.user;
      const taskId = req.params.id;

      const task = await Task.findById(taskId)
        .populate('project', 'key name members')
        .populate('assignees', 'name email role avatar_color')
        .populate({
          path: 'blockers',
          select: 'task_number title status project',
          populate: { path: 'project', select: 'key' }
        })
        .lean();

      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const hasAccess = await hasProjectAccess(task.project._id, user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const isOverdue = Boolean(task.due_date && task.due_date < todayStr && task.status !== 'DONE');

      // Fetch blockers and timeline concurrently
      const [unfinishedBlockers, timeline] = await Promise.all([
        TaskLifecycleService.getUnfinishedBlockers(task._id),
        AuditService.getTimeline(task._id)
      ]);

      const legalTransitions = TaskLifecycleService.getLegalTransitions(task.status, task.previous_status, unfinishedBlockers);

      return res.json({
        task: {
          id: task._id.toString(),
          code: `${task.project?.key || 'TASK'}-${task.task_number}`,
          task_number: task.task_number,
          project_id: task.project?._id.toString(),
          project_key: task.project?.key || '',
          project_name: task.project?.name || '',
          title: task.title,
          description: task.description,
          status: task.status,
          previous_status: task.previous_status,
          priority: task.priority,
          due_date: task.due_date,
          is_overdue: isOverdue,
          created_at: task.created_at ? task.created_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          updated_at: task.updated_at ? task.updated_at.toISOString().replace('T', ' ').substring(0, 19) : '',
          assignees: (task.assignees || []).map(a => ({
            id: a._id.toString(),
            name: a.name,
            email: a.email,
            role: a.role,
            avatar_color: a.avatar_color
          })),
          blockers: (task.blockers || []).map(b => ({
            id: b._id.toString(),
            blocker_code: `${b.project?.key || 'TASK'}-${b.task_number}`,
            blocker_title: b.title,
            blocker_status: b.status
          }))
        },
        legalTransitions,
        timeline
      });
    } catch (err) {
      next(err);
    }
  }

  static async createTask(req, res, next) {
    try {
      const user = req.user;
      const { project_id, title, description, priority = 'MEDIUM', due_date, assignee_ids, blocker_ids } = req.body;

      if (!project_id || !title) {
        return res.status(400).json({ error: 'Project ID and task title are required.' });
      }

      const project = await Project.findById(project_id).lean();
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const hasAccess = await hasProjectAccess(project_id, user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to create tasks in this project.' });
      }

      // Determine sequential task_number for this project efficiently
      const lastTask = await Task.findOne({ project: project._id }).sort({ task_number: -1 }).select('task_number').lean();
      const nextNumber = (lastTask ? lastTask.task_number : 0) + 1;

      // Only project members may be assigned, matching the bulk-assign rule.
      const memberIds = new Set((project.members || []).map(m => m.toString()));
      const initialAssignees = (Array.isArray(assignee_ids) ? assignee_ids : [])
        .filter(id => mongoose.Types.ObjectId.isValid(id) && memberIds.has(id.toString()));

      const task = await Task.create({
        project: project._id,
        task_number: nextNumber,
        title: title.trim(),
        description: description?.trim() || '',
        priority,
        status: 'BACKLOG',
        previous_status: null,
        due_date: due_date || null,
        assignees: initialAssignees
      });

      await AuditService.logActivity({
        taskId: task._id,
        userId: user.id,
        activityType: 'CREATED',
        newValue: `Task created with status Backlog`
      });

      // Blocking dependencies chosen on the create form, validated the same way
      // as POST /tasks/:id/blockers.
      if (Array.isArray(blocker_ids) && blocker_ids.length > 0) {
        for (const blockerId of blocker_ids) {
          if (!mongoose.Types.ObjectId.isValid(blockerId)) continue;
          if (blockerId.toString() === task._id.toString()) continue;
          if (task.blockers.some(b => b.toString() === blockerId.toString())) continue;

          const blockerTask = await Task.findById(blockerId).populate('project', 'key');
          if (!blockerTask) continue;
          // A task may only be blocked by other tasks in the same project.
          if (blockerTask.project._id.toString() !== task.project.toString()) continue;
          if (await TaskLifecycleService.wouldCreateCycle(task._id, blockerTask._id)) continue;

          task.blockers.push(blockerTask._id);
          await AuditService.logActivity({
            taskId: task._id,
            userId: user.id,
            activityType: 'BLOCKER_ADDED',
            newValue: `Blocked by ${blockerTask.project.key}-${blockerTask.task_number}: ${blockerTask.title}`
          });
        }

        if (task.blockers.length > 0) {
          await task.save();
        }
      }

      return res.status(201).json({
        task: {
          id: task._id.toString(),
          code: `${project.key}-${task.task_number}`,
          task_number: task.task_number,
          title: task.title,
          status: task.status,
          priority: task.priority
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTask(req, res, next) {
    try {
      const user = req.user;
      const taskId = req.params.id;
      const { title, description, priority, due_date, status } = req.body;

      const task = await Task.findById(taskId).populate('project', 'key name');
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const hasAccess = await hasProjectAccess(task.project._id, user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to modify this task.' });
      }

      // Handle status change validation
      if (status && status !== task.status) {
        const validation = await TaskLifecycleService.validateTransition(task, status);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        const oldStatus = task.status;
        task.status = status;
        task.previous_status = validation.previousStatus;

        await AuditService.logActivity({
          taskId: task._id,
          userId: user.id,
          activityType: 'STATUS_CHANGED',
          fieldName: 'status',
          oldValue: oldStatus,
          newValue: status
        });
      }

      if (title && title.trim() !== task.title) {
        const oldVal = task.title;
        task.title = title.trim();
        await AuditService.logActivity({
          taskId: task._id,
          userId: user.id,
          activityType: 'FIELD_UPDATED',
          fieldName: 'title',
          oldValue: oldVal,
          newValue: task.title
        });
      }

      if (description !== undefined && description !== task.description) {
        task.description = description.trim();
        await AuditService.logActivity({
          taskId: task._id,
          userId: user.id,
          activityType: 'FIELD_UPDATED',
          fieldName: 'description',
          oldValue: '...',
          newValue: '...'
        });
      }

      if (priority && priority !== task.priority) {
        const oldVal = task.priority;
        task.priority = priority;
        await AuditService.logActivity({
          taskId: task._id,
          userId: user.id,
          activityType: 'FIELD_UPDATED',
          fieldName: 'priority',
          oldValue: oldVal,
          newValue: priority
        });
      }

      if (due_date !== undefined && due_date !== task.due_date) {
        const oldVal = task.due_date;
        task.due_date = due_date || null;
        await AuditService.logActivity({
          taskId: task._id,
          userId: user.id,
          activityType: 'FIELD_UPDATED',
          fieldName: 'due_date',
          oldValue: oldVal,
          newValue: task.due_date
        });
      }

      await task.save();

      return res.json({
        task: {
          id: task._id.toString(),
          code: `${task.project.key}-${task.task_number}`,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTask(req, res, next) {
    try {
      if (req.user && req.user.role !== 'MANAGER') {
        return res.status(403).json({ error: 'Only managers can delete tasks' });
      }

      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      // Pull from any tasks that had this as blocker
      await Promise.all([
        Task.updateMany({ blockers: task._id }, { $pull: { blockers: task._id } }),
        Task.findByIdAndDelete(taskId)
      ]);

      return res.json({ message: 'Task deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async addAssignee(req, res, next) {
    try {
      const taskId = req.params.id;
      const { userId } = req.body;

      const [task, assignee] = await Promise.all([
        Task.findById(taskId),
        User.findById(userId)
      ]);

      if (!task) return res.status(404).json({ error: 'Task not found.' });
      if (!assignee) return res.status(404).json({ error: 'User not found.' });

      const hasAccess = await hasProjectAccess(task.project, req.user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      const project = await Project.findById(task.project).select('members').lean();
      const isMember = (project?.members || []).some(m => m.toString() === assignee._id.toString());
      if (!isMember) {
        return res.status(400).json({ error: `${assignee.name} is not a member of this project.` });
      }

      if (!task.assignees.some(a => a.toString() === userId.toString())) {
        task.assignees.push(assignee._id);
        await task.save();

        await AuditService.logActivity({
          taskId: task._id,
          userId: req.user.id,
          activityType: 'ASSIGNED',
          newValue: `${assignee.name} (${assignee.email})`
        });
      }

      return res.json({ message: 'Assignee added.' });
    } catch (err) {
      next(err);
    }
  }

  static async removeAssignee(req, res, next) {
    try {
      const taskId = req.params.id;
      const userId = req.params.userId;

      const [task, assignee] = await Promise.all([
        Task.findById(taskId),
        User.findById(userId)
      ]);

      if (!task) return res.status(404).json({ error: 'Task not found.' });
      if (!assignee) return res.status(404).json({ error: 'User not found.' });

      const hasAccess = await hasProjectAccess(task.project, req.user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      task.assignees = task.assignees.filter(a => a.toString() !== userId.toString());
      await task.save();

      await AuditService.logActivity({
        taskId: task._id,
        userId: req.user.id,
        activityType: 'UNASSIGNED',
        oldValue: `${assignee.name} (${assignee.email})`
      });

      return res.json({ message: 'Assignee removed.' });
    } catch (err) {
      next(err);
    }
  }

  static async addBlocker(req, res, next) {
    try {
      const taskId = req.params.id;
      const { blockerTaskId } = req.body;

      if (!blockerTaskId) {
        return res.status(400).json({ error: 'Blocker task ID is required.' });
      }

      if (taskId.toString() === blockerTaskId.toString()) {
        return res.status(400).json({ error: 'A task cannot block itself.' });
      }

      const [task, blockerTask] = await Promise.all([
        Task.findById(taskId).populate('project', 'key'),
        Task.findById(blockerTaskId).populate('project', 'key')
      ]);

      if (!task || !blockerTask) {
        return res.status(404).json({ error: 'Task or blocker task not found.' });
      }

      const canSeeTask = await hasProjectAccess(task.project._id, req.user);
      if (!canSeeTask) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      // A task may only be blocked by other tasks in the same project. This also
      // makes the access check above sufficient for the blocking task.
      if (blockerTask.project._id.toString() !== task.project._id.toString()) {
        return res.status(400).json({
          error: `Cannot add dependency: ${blockerTask.project.key}-${blockerTask.task_number} belongs to a different project. A task can only be blocked by tasks in ${task.project.key}.`
        });
      }

      // Check for circular dependency
      const isCycle = await TaskLifecycleService.wouldCreateCycle(task._id, blockerTask._id);
      if (isCycle) {
        return res.status(400).json({
          error: `Cannot add dependency: creating a circular dependency cycle between ${task.project.key}-${task.task_number} and ${blockerTask.project.key}-${blockerTask.task_number}.`
        });
      }

      if (!task.blockers.some(b => b.toString() === blockerTask._id.toString())) {
        task.blockers.push(blockerTask._id);
        await task.save();

        await AuditService.logActivity({
          taskId: task._id,
          userId: req.user.id,
          activityType: 'BLOCKER_ADDED',
          newValue: `Blocked by ${blockerTask.project.key}-${blockerTask.task_number}: ${blockerTask.title}`
        });
      }

      return res.status(201).json({ message: 'Blocker added successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async removeBlocker(req, res, next) {
    try {
      const taskId = req.params.id;
      const blockerId = req.params.blockerId;

      const [task, blockerTask] = await Promise.all([
        Task.findById(taskId),
        Task.findById(blockerId).populate('project', 'key')
      ]);

      if (!task) return res.status(404).json({ error: 'Task not found.' });

      const hasAccess = await hasProjectAccess(task.project, req.user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      task.blockers = task.blockers.filter(b => b.toString() !== blockerId.toString());
      await task.save();

      const blockerCode = blockerTask ? `${blockerTask.project.key}-${blockerTask.task_number}` : blockerId;
      await AuditService.logActivity({
        taskId: task._id,
        userId: req.user.id,
        activityType: 'BLOCKER_REMOVED',
        newValue: `Removed blocker ${blockerCode}`
      });

      return res.json({ message: 'Blocker removed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async addComment(req, res, next) {
    try {
      const taskId = req.params.id;
      const { comment } = req.body;

      if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Comment text cannot be empty.' });
      }

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const hasAccess = await hasProjectAccess(task.project, req.user);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }

      await AuditService.logActivity({
        taskId: task._id,
        userId: req.user.id,
        activityType: 'COMMENT_ADDED',
        commentText: comment.trim()
      });

      return res.status(201).json({ message: 'Comment added successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async getActivityFeed(req, res, next) {
    try {
      const user = req.user;
      const { project_id, user_id, activity_type, limit = '50' } = req.query;

      const activities = await AuditService.getGlobalFeed({
        user,
        projectId: project_id,
        userId: user_id,
        activityType: activity_type,
        limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
      });

      return res.json({
        activities,
        count: activities.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async exportCsv(req, res, next) {
    try {
      const user = req.user;
      const { q, project_id, status, priority, assignee_id, overdue, sort_by = 'updated_at', sort_order = 'desc' } = req.query;

      const filter = {};
      if (user.role !== 'MANAGER') {
        const userProjects = await Project.find({ members: user.id }).select('_id').lean();
        const allowedIds = userProjects.map(p => p._id);
        if (project_id) {
          if (!allowedIds.some(id => id.toString() === project_id.toString())) {
            res.setHeader('Content-Type', 'text/csv');
            return res.send('Task ID,Project,Title,Status,Priority,Assignees,Due Date,Created At,Updated At\n');
          }
          filter.project = project_id;
        } else {
          filter.project = { $in: allowedIds };
        }
      } else if (project_id) {
        filter.project = project_id;
      }

      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (assignee_id) {
        if (assignee_id === 'unassigned') filter.assignees = { $size: 0 };
        else filter.assignees = assignee_id;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (overdue === 'true') {
        filter.due_date = { $ne: null, $lt: todayStr };
        filter.status = { $ne: 'DONE' };
      }

      if (q && q.trim()) {
        const searchRegex = new RegExp(q.trim(), 'i');
        filter.$or = [{ title: searchRegex }, { description: searchRegex }];
      }

      const tasks = await Task.find(filter)
        .populate('project', 'key name')
        .populate('assignees', 'name')
        .sort({ [SORT_FIELDS[sort_by] || 'updated_at']: sort_order === 'asc' ? 1 : -1 })
        .lean();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.csv"');

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = ['Task ID', 'Project', 'Title', 'Status', 'Priority', 'Assignees', 'Due Date', 'Created At', 'Updated At'];
      let csv = headers.join(',') + '\n';

      for (const t of tasks) {
        const assigneesStr = (t.assignees || []).map(a => a.name).join('; ');
        const row = [
          escapeCsv(`${t.project?.key || 'TASK'}-${t.task_number}`),
          escapeCsv(t.project?.name || ''),
          escapeCsv(t.title),
          escapeCsv(t.status),
          escapeCsv(t.priority),
          escapeCsv(assigneesStr),
          escapeCsv(t.due_date || ''),
          escapeCsv(t.created_at ? t.created_at.toISOString().split('T')[0] : ''),
          escapeCsv(t.updated_at ? t.updated_at.toISOString().split('T')[0] : '')
        ];
        csv += row.join(',') + '\n';
      }

      return res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}
