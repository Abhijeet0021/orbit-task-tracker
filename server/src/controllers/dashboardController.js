import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

export class DashboardController {
  static async getStats(req, res) {
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    // Project filter
    const projectFilter = { is_archived: false };
    if (user.role !== 'MANAGER') {
      projectFilter.members = user.id;
    }

    const allowedProjects = await Project.find(projectFilter).select('_id');
    const allowedProjectIds = allowedProjects.map(p => p._id);

    const baseTaskFilter = {
      project: { $in: allowedProjectIds }
    };

    // 1. Headline metrics
    const [openTasks, overdueTasks, dueThisWeek, completedThisWeek] = await Promise.all([
      Task.countDocuments({ ...baseTaskFilter, status: { $ne: 'DONE' } }),
      Task.countDocuments({
        ...baseTaskFilter,
        status: { $ne: 'DONE' },
        due_date: { $ne: null, $lt: todayStr }
      }),
      (() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        return Task.countDocuments({
          ...baseTaskFilter,
          status: { $ne: 'DONE' },
          due_date: { $gte: todayStr, $lte: nextWeekStr }
        });
      })(),
      (() => {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return Task.countDocuments({
          ...baseTaskFilter,
          status: 'DONE',
          updated_at: { $gte: lastWeek }
        });
      })()
    ]);

    // 2. Status Breakdown
    const allStatuses = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'];
    const statusCounts = await Task.aggregate([
      { $match: baseTaskFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusMap = new Map();
    statusCounts.forEach(sc => statusMap.set(sc._id, sc.count));

    const statusBreakdown = allStatuses.map(st => ({
      status: st,
      count: statusMap.get(st) || 0
    }));

    // 3. Assignee Breakdown
    const allUsers = await User.find().select('name email role avatar_color');
    const assigneeBreakdown = await Promise.all(allUsers.map(async (u) => {
      const uId = u._id;
      const [active, overdue, completed] = await Promise.all([
        Task.countDocuments({ ...baseTaskFilter, assignees: uId, status: { $ne: 'DONE' } }),
        Task.countDocuments({ ...baseTaskFilter, assignees: uId, status: { $ne: 'DONE' }, due_date: { $ne: null, $lt: todayStr } }),
        Task.countDocuments({ ...baseTaskFilter, assignees: uId, status: 'DONE' })
      ]);

      return {
        user_id: uId.toString(),
        user_name: u.name,
        user_email: u.email,
        user_role: u.role,
        avatar_color: u.avatar_color,
        active_tasks_count: active,
        overdue_tasks_count: overdue,
        completed_tasks_count: completed
      };
    }));

    assigneeBreakdown.sort((a, b) => b.active_tasks_count - a.active_tasks_count);

    // 4. 8-Week Historical Completed Tasks
    const eightWeeksCompletions = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7 + (now.getDay() || 7) - 1));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const count = await Task.countDocuments({
        ...baseTaskFilter,
        status: 'DONE',
        updated_at: { $gte: weekStart, $lte: weekEnd }
      });

      eightWeeksCompletions.push({
        weekLabel: i === 0 ? 'This Week' : label,
        startDate: startStr,
        endDate: endStr,
        completedCount: count
      });
    }

    return res.json({
      headline: {
        openTasks,
        overdueTasks,
        dueThisWeek,
        completedThisWeek
      },
      statusBreakdown,
      assigneeBreakdown,
      eightWeeksCompletions
    });
  }
}
