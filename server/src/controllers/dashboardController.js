import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

export class DashboardController {
  static async getStats(req, res, next) {
    try {
      const user = req.user;
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Project filtering based on RBAC
      const projectFilter = { is_archived: false };
      if (user.role !== 'MANAGER') {
        projectFilter.members = user.id;
      }

      const allowedProjects = await Project.find(projectFilter).select('_id').lean();
      const allowedProjectIds = allowedProjects.map(p => p._id);

      const baseTaskFilter = {
        project: { $in: allowedProjectIds }
      };

      // 2. Setup date bounds for calculations
      const now = new Date();
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Precalculate 8-week historical boundaries
      const weekRanges = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7 + (now.getDay() || 7) - 1));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        weekRanges.push({
          weekLabel: i === 0 ? 'This Week' : label,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          start: weekStart,
          end: weekEnd
        });
      }

      // 3. Execute all dashboard aggregations concurrently in parallel
      const [
        facetResults,
        assigneeStats,
        allUsers,
        historyCounts
      ] = await Promise.all([
        // Aggregation 1: Faceted headline metrics & status breakdown in 1 pipeline
        Task.aggregate([
          { $match: baseTaskFilter },
          {
            $facet: {
              headline: [
                {
                  $group: {
                    _id: null,
                    openTasks: {
                      $sum: { $cond: [{ $ne: ['$status', 'DONE'] }, 1, 0] }
                    },
                    overdueTasks: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$status', 'DONE'] },
                              { $ne: ['$due_date', null] },
                              { $lt: ['$due_date', todayStr] }
                            ]
                          },
                          1,
                          0
                        ]
                      }
                    },
                    dueThisWeek: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$status', 'DONE'] },
                              { $gte: ['$due_date', todayStr] },
                              { $lte: ['$due_date', nextWeekStr] }
                            ]
                          },
                          1,
                          0
                        ]
                      }
                    },
                    completedThisWeek: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ['$status', 'DONE'] },
                              { $gte: ['$updated_at', lastWeek] }
                            ]
                          },
                          1,
                          0
                        ]
                      }
                    }
                  }
                }
              ],
              statusBreakdown: [
                {
                  $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                  }
                }
              ]
            }
          }
        ]),

        // Aggregation 2: Single pipeline for all assignees via $unwind & $group
        Task.aggregate([
          { $match: baseTaskFilter },
          { $unwind: '$assignees' },
          {
            $group: {
              _id: '$assignees',
              active_tasks_count: {
                $sum: { $cond: [{ $ne: ['$status', 'DONE'] }, 1, 0] }
              },
              overdue_tasks_count: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$status', 'DONE'] },
                        { $ne: ['$due_date', null] },
                        { $lt: ['$due_date', todayStr] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              completed_tasks_count: {
                $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] }
              }
            }
          }
        ]),

        // Query 3: Lightweight lean query for all user details
        User.find().select('name email role avatar_color').lean(),

        // Query 4: Parallel execution of 8 weekly counts
        Promise.all(
          weekRanges.map(range =>
            Task.countDocuments({
              ...baseTaskFilter,
              status: 'DONE',
              updated_at: { $gte: range.start, $lte: range.end }
            })
          )
        )
      ]);

      // 4. Format Headline Metrics
      const rawHeadline = facetResults[0]?.headline[0] || {};
      const headline = {
        openTasks: rawHeadline.openTasks || 0,
        overdueTasks: rawHeadline.overdueTasks || 0,
        dueThisWeek: rawHeadline.dueThisWeek || 0,
        completedThisWeek: rawHeadline.completedThisWeek || 0
      };

      // 5. Format Status Breakdown
      const allStatuses = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'];
      const statusMap = new Map();
      (facetResults[0]?.statusBreakdown || []).forEach(sc => {
        statusMap.set(sc._id, sc.count);
      });

      const statusBreakdown = allStatuses.map(st => ({
        status: st,
        count: statusMap.get(st) || 0
      }));

      // 6. Map Assignee Breakdown in constant memory time
      const assigneeMap = new Map();
      assigneeStats.forEach(as => {
        assigneeMap.set(as._id.toString(), as);
      });

      const assigneeBreakdown = allUsers.map(u => {
        const uId = u._id.toString();
        const stat = assigneeMap.get(uId) || {};
        return {
          user_id: uId,
          user_name: u.name,
          user_email: u.email,
          user_role: u.role,
          avatar_color: u.avatar_color,
          active_tasks_count: stat.active_tasks_count || 0,
          overdue_tasks_count: stat.overdue_tasks_count || 0,
          completed_tasks_count: stat.completed_tasks_count || 0
        };
      });

      assigneeBreakdown.sort((a, b) => b.active_tasks_count - a.active_tasks_count);

      // 7. Format 8-Week Historical Completions
      const eightWeeksCompletions = weekRanges.map((range, idx) => ({
        weekLabel: range.weekLabel,
        startDate: range.startDate,
        endDate: range.endDate,
        completedCount: historyCounts[idx] || 0
      }));

      return res.json({
        headline,
        statusBreakdown,
        assigneeBreakdown,
        eightWeeksCompletions
      });
    } catch (err) {
      next(err);
    }
  }
}
