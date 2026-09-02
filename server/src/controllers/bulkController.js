import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { AlertDismissal } from '../models/AlertDismissal.js';
import { hasProjectAccess } from '../middleware/auth.js';
import { TaskLifecycleService } from '../services/taskLifecycle.js';
import { AuditService } from '../services/auditService.js';

export class BulkController {
  static async executeBulk(req, res) {
    const user = req.user;
    const task_ids = req.body.task_ids || req.body.taskIds || [];
    let action = req.body.action;
    let payload = req.body.payload || {};

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
      const task = await Task.findById(taskId).populate('project', 'key members');

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

      const taskCode = `${task.project?.key || 'TASK'}-${task.task_number}`;

      const hasAccess = await hasProjectAccess(task.project._id, user);
      if (!hasAccess) {
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

            const validation = await TaskLifecycleService.validateTransition(task, targetStatus);
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

            const oldStatus = task.status;
            task.status = targetStatus;
            task.previous_status = validation.previousStatus;
            await task.save();

            await AuditService.logActivity({
              taskId: task._id,
              userId: user.id,
              activityType: 'STATUS_CHANGED',
              fieldName: 'status',
              oldValue: oldStatus,
              newValue: targetStatus,
              commentText: 'Bulk status update.'
            });

            results.push({
              taskId,
              code: taskCode,
              title: task.title,
              success: true,
              message: `Status moved from ${oldStatus.replace('_', ' ')} to ${targetStatus.replace('_', ' ')}.`
            });
            break;
          }

          case 'ASSIGN_USER': {
            const targetUserId = payload?.userId;
            const targetUser = await User.findById(targetUserId);

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

            const isMember = task.project.members.some(m => m.toString() === targetUser._id.toString());
            if (!isMember) {
              results.push({
                taskId,
                code: taskCode,
                title: task.title,
                success: false,
                error: `User ${targetUser.name} is not a member of project ${task.project.key}.`
              });
              break;
            }

            if (!task.assignees.some(a => a.toString() === targetUser._id.toString())) {
              task.assignees.push(targetUser._id);
              await task.save();
            }

            await AuditService.logActivity({
              taskId: task._id,
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
            const oldDue = task.due_date;
            task.due_date = newDueDate;
            await task.save();

            await AlertDismissal.deleteMany({ task: task._id });

            await AuditService.logActivity({
              taskId: task._id,
              userId: user.id,
              activityType: 'FIELD_UPDATED',
              fieldName: 'due_date',
              oldValue: oldDue || '(none)',
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

            const oldPri = task.priority;
            task.priority = newPriority;
            await task.save();

            await AuditService.logActivity({
              taskId: task._id,
              userId: user.id,
              activityType: 'FIELD_UPDATED',
              fieldName: 'priority',
              oldValue: oldPri,
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
        failed,
        success: succeeded
      },
      results
    });
  }

  static async exportCsv(req, res) {
    const { TaskController } = await import('./taskController.js');
    return TaskController.exportCsv(req, res);
  }
}
