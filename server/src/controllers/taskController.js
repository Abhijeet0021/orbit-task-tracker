import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { TaskLifecycleService } from '../services/taskLifecycle.js';
import { AuditService } from '../services/auditService.js';
import { hasProjectAccess } from '../middleware/auth.js';

export class TaskController {
  static async listTasks(req, res) {
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
      const userProjects = await Project.find({ members: user.id }).select('_id');
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

    const sortFieldMap = {
      updated_at: 'updated_at',
      created_at: 'created_at',
      due_date: 'due_date',
      priority: 'priority',
      title: 'title',
      status: 'status'
    };
    const sortField = sortFieldMap[sort_by] || 'updated_at';
    const sortDir = sort_order.toLowerCase() === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('project', 'key name')
        .populate('assignees', 'name email role avatar_color')
        .populate('blockers', 'task_number title status')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum),
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
        created_at: t.created_at.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: t.updated_at.toISOString().replace('T', ' ').substring(0, 19),
        assignees: t.assignees.map(a => ({
          id: a._id.toString(),
          name: a.name,
          email: a.email,
          role: a.role,
          avatar_color: a.avatar_color
        })),
        blockers: t.blockers.map(b => ({
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
  }

  static async getTask(req, res) {
    const user = req.user;
    const taskId = req.params.id;

    const task = await Task.findById(taskId)
      .populate('project', 'key name members')
      .populate('assignees', 'name email role avatar_color')
      .populate({
        path: 'blockers',
        select: 'task_number title status project',
        populate: { path: 'project', select: 'key' }
      });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const hasAccess = await hasProjectAccess(task.project._id, user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = Boolean(task.due_date && task.due_date < todayStr && task.status !== 'DONE');

    const unfinishedBlockers = await TaskLifecycleService.getUnfinishedBlockers(task._id);
    const legalTransitions = TaskLifecycleService.getLegalTransitions(task.status, task.previous_status, unfinishedBlockers);
    const timeline = await AuditService.getTimeline(task._id);

    return res.json({
      task: {
        id: task._id.toString(),
        code: `${task.project.key}-${task.task_number}`,
        task_number: task.task_number,
        project_id: task.project._id.toString(),
        project_key: task.project.key,
        project_name: task.project.name,
        title: task.title,
        description: task.description,
        status: task.status,
        previous_status: task.previous_status,
        priority: task.priority,
        due_date: task.due_date,
        is_overdue: isOverdue,
        created_at: task.created_at.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: task.updated_at.toISOString().replace('T', ' ').substring(0, 19),
        assignees: task.assignees.map(a => ({
          id: a._id.toString(),
          name: a.name,
          email: a.email,
          role: a.role,
          avatar_color: a.avatar_color
        })),
        blockers: task.blockers.map(b => ({
          id: b._id.toString(),
          blocker_code: `${b.project?.key || 'TASK'}-${b.task_number}`,
          blocker_title: b.title,
          blocker_status: b.status
        }))
      },
      legalTransitions,
      timeline
    });
  }

  static async createTask(req, res) {
    const user = req.user;
    const { project_id, title, description, priority = 'MEDIUM', due_date, assignee_ids } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ error: 'Project ID and task title are required.' });
    }

    const project = await Project.findById(project_id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const hasAccess = await hasProjectAccess(project_id, user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to create tasks in this project.' });
    }

    // Determine sequential task_number for this project
    const lastTask = await Task.findOne({ project: project._id }).sort({ task_number: -1 });
    const nextNumber = (lastTask ? lastTask.task_number : 0) + 1;

    const task = await Task.create({
      project: project._id,
      task_number: nextNumber,
      title: title.trim(),
      description: description?.trim() || '',
      priority,
      status: 'BACKLOG',
      previous_status: null,
      due_date: due_date || null,
      assignees: Array.isArray(assignee_ids) ? assignee_ids : []
    });

    await AuditService.logActivity({
      taskId: task._id,
      userId: user.id,
      activityType: 'CREATED',
      newValue: `Task created with status Backlog`
    });

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
  }

  static async updateTask(req, res) {
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
  }

  static async deleteTask(req, res) {
    if (req.user && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only managers can delete tasks' });
    }

    const taskId = req.params.id;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Pull from any tasks that had this as blocker
    await Task.updateMany({ blockers: task._id }, { $pull: { blockers: task._id } });
    await Task.findByIdAndDelete(taskId);

    return res.json({ message: 'Task deleted successfully.' });
  }

  static async addAssignee(req, res) {
    const taskId = req.params.id;
    const { userId } = req.body;

    const [task, assignee] = await Promise.all([
      Task.findById(taskId),
      User.findById(userId)
    ]);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (!assignee) return res.status(404).json({ error: 'User not found.' });

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
  }

  static async removeAssignee(req, res) {
    const taskId = req.params.id;
    const userId = req.params.userId;

    const [task, assignee] = await Promise.all([
      Task.findById(taskId),
      User.findById(userId)
    ]);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (!assignee) return res.status(404).json({ error: 'User not found.' });

    task.assignees = task.assignees.filter(a => a.toString() !== userId.toString());
    await task.save();

    await AuditService.logActivity({
      taskId: task._id,
      userId: req.user.id,
      activityType: 'UNASSIGNED',
      oldValue: `${assignee.name} (${assignee.email})`
    });

    return res.json({ message: 'Assignee removed.' });
  }

  static async addBlocker(req, res) {
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
  }

  static async removeBlocker(req, res) {
    const taskId = req.params.id;
    const blockerId = req.params.blockerId;

    const [task, blockerTask] = await Promise.all([
      Task.findById(taskId),
      Task.findById(blockerId).populate('project', 'key')
    ]);

    if (!task) return res.status(404).json({ error: 'Task not found.' });

    task.blockers = task.blockers.filter(b => b.toString() !== blockerId.toString());
    await task.save();

    const blockerLabel = blockerTask ? `${blockerTask.project.key}-${blockerTask.task_number}` : blockerId;
    await AuditService.logActivity({
      taskId: task._id,
      userId: req.user.id,
      activityType: 'BLOCKER_REMOVED',
      oldValue: blockerLabel
    });

    return res.json({ message: 'Blocker removed.' });
  }

  static async addComment(req, res) {
    const taskId = req.params.id;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await AuditService.logActivity({
      taskId: task._id,
      userId: req.user.id,
      activityType: 'COMMENT_ADDED',
      commentText: comment.trim()
    });

    return res.status(201).json({ message: 'Comment added successfully.' });
  }

  static async getActivityFeed(req, res) {
    const user = req.user;
    const { project_id, user_id, activity_type, limit = '50' } = req.query;

    const activities = await AuditService.getGlobalFeed({
      user,
      projectId: project_id,
      userId: user_id,
      activityType: activity_type,
      limit: parseInt(limit, 10) || 50
    });

    return res.json({
      activities,
      count: activities.length
    });
  }

  static async exportCsv(req, res) {
    const user = req.user;
    const { q, project_id, status, priority, assignee_id, overdue, sort_by = 'updated_at', sort_order = 'desc' } = req.query;

    const filter = {};
    if (user.role !== 'MANAGER') {
      const userProjects = await Project.find({ members: user.id }).select('_id');
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
      .sort({ [sort_by || 'updated_at']: sort_order === 'asc' ? 1 : -1 });

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
      const assigneesStr = t.assignees.map(a => a.name).join('; ');
      const row = [
        escapeCsv(`${t.project?.key || 'TASK'}-${t.task_number}`),
        escapeCsv(t.project?.name || ''),
        escapeCsv(t.title),
        escapeCsv(t.status),
        escapeCsv(t.priority),
        escapeCsv(assigneesStr),
        escapeCsv(t.due_date || ''),
        escapeCsv(t.created_at.toISOString().split('T')[0]),
        escapeCsv(t.updated_at.toISOString().split('T')[0])
      ];
      csv += row.join(',') + '\n';
    }

    return res.send(csv);
  }
}
