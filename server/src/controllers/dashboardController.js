import { db } from '../config/database.js';

export class DashboardController {
  static getStats(req, res) {
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    let projectScopeCondition = 'p.is_archived = 0';
    const params = [];

    if (user.role !== 'MANAGER') {
      projectScopeCondition += ' AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
      params.push(user.id);
    }

    const openTasksQuery = `
      SELECT COUNT(*) as count 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE ${projectScopeCondition} AND t.status != 'DONE'
    `;
    const openTasks = db.prepare(openTasksQuery).get(...params).count;

    const overdueTasksQuery = `
      SELECT COUNT(*) as count 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE ${projectScopeCondition} 
        AND t.status != 'DONE' 
        AND t.due_date IS NOT NULL 
        AND t.due_date < ?
    `;
    const overdueTasks = db.prepare(overdueTasksQuery).get(...params, todayStr).count;

    const dueThisWeekQuery = `
      SELECT COUNT(*) as count 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE ${projectScopeCondition} 
        AND t.status != 'DONE' 
        AND t.due_date IS NOT NULL 
        AND t.due_date >= ? 
        AND t.due_date <= date(?, '+7 days')
    `;
    const dueThisWeek = db.prepare(dueThisWeekQuery).get(...params, todayStr, todayStr).count;

    const completedThisWeekQuery = `
      SELECT COUNT(*) as count 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE ${projectScopeCondition} 
        AND t.status = 'DONE' 
        AND t.updated_at >= date(?, '-7 days')
    `;
    const completedThisWeek = db.prepare(completedThisWeekQuery).get(...params, todayStr).count;

    const statusBreakdownQuery = `
      SELECT t.status, COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE ${projectScopeCondition}
      GROUP BY t.status
    `;
    const rawStatusCounts = db.prepare(statusBreakdownQuery).all(...params);
    
    const allStatuses = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'];
    const statusBreakdown = allStatuses.map(st => {
      const found = rawStatusCounts.find(r => r.status === st);
      return {
        status: st,
        count: found ? found.count : 0
      };
    });

    const assigneeBreakdownQuery = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        u.avatar_color,
        COUNT(CASE WHEN t.status != 'DONE' THEN 1 END) as active_tasks_count,
        COUNT(CASE WHEN t.status != 'DONE' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 END) as overdue_tasks_count,
        COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) as completed_tasks_count
      FROM users u
      LEFT JOIN task_assignees ta ON u.id = ta.user_id
      LEFT JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id AND ${projectScopeCondition}
      GROUP BY u.id
      ORDER BY active_tasks_count DESC, u.name ASC
    `;
    const assigneeBreakdown = db.prepare(assigneeBreakdownQuery).all(todayStr, ...params);

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

      const weekCountQuery = `
        SELECT COUNT(DISTINCT t.id) as count
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE ${projectScopeCondition}
          AND t.status = 'DONE'
          AND date(t.updated_at) >= ?
          AND date(t.updated_at) <= ?
      `;

      const resRow = db.prepare(weekCountQuery).get(...params, startStr, endStr);
      
      eightWeeksCompletions.push({
        weekLabel: i === 0 ? 'This Week' : label,
        startDate: startStr,
        endDate: endStr,
        completedCount: resRow?.count || 0
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
