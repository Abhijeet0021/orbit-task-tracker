import { db } from '../config/database.js';

export class TaskLifecycleService {
  /**
   * Determine allowed transitions from a given current status.
   */
  static getLegalTransitions(currentStatus, previousStatus, unfinishedBlockers = []) {
    const hasUnfinishedBlockers = unfinishedBlockers.length > 0;
    const blockerNames = unfinishedBlockers.map(b => `${b.code} (${b.title})`).join(', ');

    switch (currentStatus) {
      case 'BACKLOG':
        return [
          { status: 'IN_PROGRESS', label: 'Start Progress', description: 'Begin active work on this task', allowed: true }
        ];

      case 'IN_PROGRESS':
        return [
          { status: 'IN_REVIEW', label: 'Submit for Review', description: 'Move to review stage', allowed: true },
          { status: 'BLOCKED', label: 'Mark as Blocked', description: 'Flag that work is impeded', allowed: true },
          { status: 'BACKLOG', label: 'Move to Backlog', description: 'Return to unstarted backlog', allowed: true }
        ];

      case 'IN_REVIEW':
        return [
          { 
            status: 'DONE', 
            label: 'Complete Task', 
            description: 'Mark work as finished', 
            allowed: !hasUnfinishedBlockers,
            blockReason: hasUnfinishedBlockers ? `Blocked by unfinished task(s): ${blockerNames}` : undefined
          },
          { status: 'IN_PROGRESS', label: 'Request Changes (In Progress)', description: 'Return to active work for revisions', allowed: true },
          { status: 'BLOCKED', label: 'Mark as Blocked', description: 'Flag that review or work is impeded', allowed: true },
          { status: 'BACKLOG', label: 'Move to Backlog', description: 'Return to unstarted backlog', allowed: true }
        ];

      case 'BLOCKED':
        const returnStatus = previousStatus === 'IN_REVIEW' ? 'IN_REVIEW' : 'IN_PROGRESS';
        return [
          { 
            status: returnStatus, 
            label: `Unblock (Return to ${returnStatus.replace('_', ' ')})`, 
            description: `Restore task to previous state (${returnStatus.replace('_', ' ')})`, 
            allowed: true 
          }
        ];

      case 'DONE':
        return [
          { status: 'BACKLOG', label: 'Reopen to Backlog', description: 'Reopen task in backlog', allowed: true },
          { status: 'IN_PROGRESS', label: 'Reopen to In Progress', description: 'Reopen task directly in progress', allowed: true }
        ];

      default:
        return [];
    }
  }

  /**
   * Get all unfinished blockers for a task.
   */
  static getUnfinishedBlockers(taskId) {
    const stmt = db.prepare(`
      SELECT 
        t.id,
        p.key || '-' || t.task_number as code,
        t.title,
        t.status
      FROM task_blockers b
      JOIN tasks t ON b.blocked_by_task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE b.task_id = ? AND t.status != 'DONE'
    `);
    return stmt.all(taskId);
  }

  /**
   * Validate if a state transition is legal according to lifecycle rules and blocker constraints.
   */
  static validateTransition(task, targetStatus) {
    if (task.status === targetStatus) {
      return { valid: true, previousStatus: task.previous_status };
    }

    const unfinishedBlockers = this.getUnfinishedBlockers(task.id);
    const legalOptions = this.getLegalTransitions(task.status, task.previous_status, unfinishedBlockers);

    const matchingOption = legalOptions.find(opt => opt.status === targetStatus);

    if (!matchingOption) {
      const allowedNames = legalOptions.map(o => o.status.replace('_', ' ')).join(', ') || 'None';
      return {
        valid: false,
        error: `Illegal status transition from ${task.status.replace('_', ' ')} to ${targetStatus.replace('_', ' ')}. Allowed transitions from this state are: ${allowedNames}.`
      };
    }

    if (!matchingOption.allowed) {
      return {
        valid: false,
        error: matchingOption.blockReason || `Cannot transition to ${targetStatus}: constraint violation.`
      };
    }

    let newPreviousStatus = task.previous_status;
    if (targetStatus === 'BLOCKED') {
      newPreviousStatus = task.status;
    } else if (task.status === 'BLOCKED') {
      newPreviousStatus = null;
    }

    return {
      valid: true,
      previousStatus: newPreviousStatus
    };
  }

  /**
   * Check if adding a blocker creates a circular dependency chain.
   */
  static wouldCreateCycle(taskId, newBlockerTaskId) {
    if (taskId === newBlockerTaskId) return true;

    const visited = new Set();
    const queue = [taskId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === newBlockerTaskId) {
        return true;
      }
      visited.add(current);

      const stmt = db.prepare('SELECT task_id FROM task_blockers WHERE blocked_by_task_id = ?');
      const rows = stmt.all(current);

      for (const row of rows) {
        if (row.task_id === newBlockerTaskId) {
          return true;
        }
        if (!visited.has(row.task_id)) {
          queue.push(row.task_id);
        }
      }
    }

    return false;
  }
}
