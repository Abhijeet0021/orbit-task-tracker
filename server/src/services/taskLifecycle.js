import mongoose from 'mongoose';
import { Task } from '../models/Task.js';

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
  static async getUnfinishedBlockers(taskId) {
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return [];
    }

    const task = await Task.findById(taskId);
    if (!task || !task.blockers || task.blockers.length === 0) {
      return [];
    }

    const unfinished = await Task.find({
      _id: { $in: task.blockers },
      status: { $ne: 'DONE' }
    }).populate('project');

    return unfinished.map(t => ({
      id: t._id.toString(),
      code: `${t.project?.key || 'TASK'}-${t.task_number}`,
      title: t.title,
      status: t.status
    }));
  }

  /**
   * Validate if a state transition is legal according to lifecycle rules and blocker constraints.
   */
  static async validateTransition(task, targetStatus) {
    if (task.status === targetStatus) {
      return { valid: true, previousStatus: task.previous_status };
    }

    const unfinishedBlockers = await this.getUnfinishedBlockers(task._id);
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
   * If task A is blocked by task B, we cannot make B blocked by A (or any task that transitively depends on A).
   */
  static async wouldCreateCycle(taskId, newBlockerTaskId) {
    const sTaskId = taskId.toString();
    const sNewBlockerId = newBlockerTaskId.toString();

    if (sTaskId === sNewBlockerId) return true;

    // Follow tasks that are blocked by taskId. If we ever reach newBlockerTaskId, adding it would close a cycle.
    const visited = new Set();
    const queue = [sTaskId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === sNewBlockerId) {
        return true;
      }
      visited.add(current);

      // Find all tasks that have `current` in their blockers list
      const dependentTasks = await Task.find({ blockers: current }).select('_id');
      for (const dep of dependentTasks) {
        const depId = dep._id.toString();
        if (depId === sNewBlockerId) {
          return true;
        }
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      }
    }

    return false;
  }
}
