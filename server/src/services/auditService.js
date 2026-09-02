import { TaskActivity } from '../models/TaskActivity.js';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';

export class AuditService {
  /**
   * Log an immutable activity record for a task.
   */
  static async logActivity({
    taskId,
    userId = null,
    activityType,
    fieldName = null,
    oldValue = null,
    newValue = null,
    commentText = null
  }) {
    return await TaskActivity.create({
      task: taskId,
      user: userId || null,
      activity_type: activityType,
      field_name: fieldName || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      comment_text: commentText || null,
      created_at: new Date()
    });
  }

  /**
   * Retrieve the complete, immutable timeline of a task.
   */
  static async getTimeline(taskId) {
    const activities = await TaskActivity.find({ task: taskId })
      .populate('user', 'name email role avatar_color')
      .sort({ created_at: 1 });

    return activities.map(a => ({
      id: a._id.toString(),
      task_id: a.task.toString(),
      user_id: a.user?._id?.toString() || null,
      user_name: a.user?.name || 'System',
      user_email: a.user?.email || null,
      user_role: a.user?.role || null,
      avatar_color: a.user?.avatar_color || '#3b82f6',
      activity_type: a.activity_type,
      field_name: a.field_name,
      old_value: a.old_value,
      new_value: a.new_value,
      comment_text: a.comment_text,
      created_at: a.created_at.toISOString().replace('T', ' ').substring(0, 19)
    }));
  }

  /**
   * Retrieve global cross-project activity feed scoped to user access.
   */
  static async getGlobalFeed({ user, projectId = null, userId = null, activityType = null, limit = 50 }) {
    const filter = {};

    if (userId) {
      filter.user = userId;
    }
    if (activityType) {
      filter.activity_type = activityType;
    }

    let taskFilter = {};
    if (user.role !== 'MANAGER') {
      const allowedProjects = await Project.find({ members: user.id }).select('_id');
      const allowedProjectIds = allowedProjects.map(p => p._id);
      taskFilter.project = { $in: allowedProjectIds };
    }

    if (projectId) {
      taskFilter.project = projectId;
    }

    if (Object.keys(taskFilter).length > 0) {
      const matchingTasks = await Task.find(taskFilter).select('_id');
      const matchingTaskIds = matchingTasks.map(t => t._id);
      filter.task = { $in: matchingTaskIds };
    }

    const activities = await TaskActivity.find(filter)
      .populate('user', 'name email role avatar_color')
      .populate({
        path: 'task',
        select: 'task_number title project',
        populate: { path: 'project', select: 'key name' }
      })
      .sort({ created_at: -1 })
      .limit(Math.min(100, Math.max(1, limit)));

    return activities.filter(a => a.task && a.task.project).map(a => ({
      id: a._id.toString(),
      task_id: a.task._id.toString(),
      task_number: a.task.task_number,
      task_title: a.task.title,
      project_id: a.task.project._id.toString(),
      project_key: a.task.project.key,
      project_name: a.task.project.name,
      user_id: a.user?._id?.toString() || null,
      user_name: a.user?.name || 'System',
      user_email: a.user?.email || null,
      user_role: a.user?.role || null,
      avatar_color: a.user?.avatar_color || '#3b82f6',
      activity_type: a.activity_type,
      field_name: a.field_name,
      old_value: a.old_value,
      new_value: a.new_value,
      comment_text: a.comment_text,
      created_at: a.created_at.toISOString().replace('T', ' ').substring(0, 19)
    }));
  }
}
