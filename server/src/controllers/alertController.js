import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { AlertDismissal } from '../models/AlertDismissal.js';

export class AlertController {
  static async getOverdueAlerts(req, res) {
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    // Find all dismissals by this user
    const dismissals = await AlertDismissal.find({ user: user.id });
    const dismissedMap = new Map();
    for (const d of dismissals) {
      dismissedMap.set(d.task.toString(), d.dismissed_due_date);
    }

    const tasks = await Task.find({
      assignees: user.id,
      status: { $ne: 'DONE' },
      due_date: { $ne: null, $lt: todayStr }
    })
    .populate('project', 'key name is_archived')
    .populate('assignees', 'name email role avatar_color')
    .sort({ due_date: 1 });

    const alerts = [];
    const todayDate = new Date(todayStr);

    for (const t of tasks) {
      if (t.project && t.project.is_archived) continue;

      const tId = t._id.toString();
      if (dismissedMap.get(tId) === t.due_date) {
        continue; // Active dismissal for current due date
      }

      const dueDate = new Date(t.due_date);
      const diffTime = Math.abs(todayDate - dueDate);
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      alerts.push({
        task_id: tId,
        task_code: `${t.project?.key || 'TASK'}-${t.task_number}`,
        task_title: t.title,
        project_id: t.project?._id.toString(),
        project_key: t.project?.key || '',
        project_name: t.project?.name || '',
        due_date: t.due_date,
        priority: t.priority,
        status: t.status,
        days_overdue: daysOverdue,
        assignees: t.assignees.map(a => ({
          id: a._id.toString(),
          name: a.name,
          email: a.email,
          role: a.role,
          avatar_color: a.avatar_color
        }))
      });
    }

    return res.json({
      alerts,
      count: alerts.length
    });
  }

  static async dismissAlert(req, res) {
    const user = req.user;
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Valid taskId is required.' });
    }

    const task = await Task.findById(taskId);
    if (!task || !task.due_date) {
      return res.status(404).json({ error: 'Overdue task not found.' });
    }

    const isAssigned = task.assignees.some(a => a.toString() === user.id.toString());
    if (!isAssigned) {
      return res.status(403).json({ error: 'You can only dismiss alerts for tasks assigned to you.' });
    }

    await AlertDismissal.findOneAndUpdate(
      { user: user.id, task: task._id },
      { dismissed_due_date: task.due_date, dismissed_at: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    return res.json({ message: 'Alert dismissed successfully.' });
  }
}
