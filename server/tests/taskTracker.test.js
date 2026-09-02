import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { initDatabase, closeDatabase } from '../src/config/database.js';
import { runSeed } from '../src/seed/seedData.js';
import { User } from '../src/models/User.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { TaskLifecycleService } from '../src/services/taskLifecycle.js';
import { TaskController } from '../src/controllers/taskController.js';
import { BulkController } from '../src/controllers/bulkController.js';
import { AlertController } from '../src/controllers/alertController.js';
import { ProjectController } from '../src/controllers/projectController.js';
import { AuditService } from '../src/services/auditService.js';

describe('Project & Task Tracking System — Comprehensive Test Suite (MongoDB/Mongoose)', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await initDatabase(uri);
  });

  afterAll(async () => {
    await closeDatabase();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await runSeed();
  });

  describe('1. RBAC & Access Control', () => {
    it('enforces that members cannot delete tasks', async () => {
      const member = await User.findOne({ role: 'MEMBER' });
      const task = await Task.findOne();

      const req = { user: { id: member._id.toString(), role: member.role }, params: { id: task._id.toString() } };
      let statusCode = 0;
      let jsonResponse = null;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonResponse = data; return res; }
      };

      await TaskController.deleteTask(req, res);
      expect(statusCode).toBe(403);
      expect(jsonResponse.error).toContain('Only managers can delete tasks');
    });

    it('enforces that managers CAN delete tasks', async () => {
      const manager = await User.findOne({ role: 'MANAGER' });
      const task = await Task.findOne();

      const req = { user: { id: manager._id.toString(), role: manager.role }, params: { id: task._id.toString() } };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonResponse = data; return res; }
      };

      await TaskController.deleteTask(req, res);
      expect(jsonResponse.message).toContain('deleted successfully');
      
      const check = await Task.findById(task._id);
      expect(check).toBeNull();
    });

    it('allows managers to archive and restore projects', async () => {
      const manager = await User.findOne({ role: 'MANAGER' });
      const project = await Project.findOne({ is_archived: false });

      const req = { user: { id: manager._id.toString(), role: manager.role }, params: { id: project._id.toString() } };
      const res = { json: (data) => data };

      await ProjectController.archiveProject(req, res);
      const archived = await Project.findById(project._id);
      expect(archived.is_archived).toBe(true);

      await ProjectController.restoreProject(req, res);
      const restored = await Project.findById(project._id);
      expect(restored.is_archived).toBe(false);
    });
  });

  describe('2. Strict Task Lifecycle State Machine & Blocker Rules', () => {
    it('rejects direct illegal jump from BACKLOG to DONE', async () => {
      const task = { _id: 'dummy', status: 'BACKLOG', previous_status: null, blockers: [] };
      const result = await TaskLifecycleService.validateTransition(task, 'DONE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Illegal status transition from BACKLOG to DONE');
    });

    it('allows legal progression: BACKLOG -> IN_PROGRESS -> IN_REVIEW -> DONE', async () => {
      let task = { _id: 'dummy', status: 'BACKLOG', previous_status: null, blockers: [] };
      
      let res1 = await TaskLifecycleService.validateTransition(task, 'IN_PROGRESS');
      expect(res1.valid).toBe(true);
      
      task.status = 'IN_PROGRESS';
      let res2 = await TaskLifecycleService.validateTransition(task, 'IN_REVIEW');
      expect(res2.valid).toBe(true);

      task.status = 'IN_REVIEW';
      let res3 = await TaskLifecycleService.validateTransition(task, 'DONE');
      expect(res3.valid).toBe(true);
    });

    it('rejects move to DONE when an unfinished blocker exists', async () => {
      const pAlpha = await Project.findOne({ key: 'ALP' });
      const alp4 = await Task.findOne({ project: pAlpha._id, task_number: 4 });

      alp4.status = 'IN_REVIEW';

      const result = await TaskLifecycleService.validateTransition(alp4, 'DONE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Blocked by unfinished task');
    });

    it('allows move to DONE when all blockers are completed', async () => {
      const pAlpha = await Project.findOne({ key: 'ALP' });
      const alp3 = await Task.findOne({ project: pAlpha._id, task_number: 3 });
      alp3.status = 'DONE';
      await alp3.save();

      const alp4 = await Task.findOne({ project: pAlpha._id, task_number: 4 });
      alp4.status = 'IN_REVIEW';

      const result = await TaskLifecycleService.validateTransition(alp4, 'DONE');
      expect(result.valid).toBe(true);
    });

    it('preserves and restores previous_status when unblocking', () => {
      const taskReviewBlocked = { status: 'BLOCKED', previous_status: 'IN_REVIEW' };
      const optionsReview = TaskLifecycleService.getLegalTransitions(taskReviewBlocked.status, taskReviewBlocked.previous_status);
      expect(optionsReview[0].status).toBe('IN_REVIEW');

      const taskProgressBlocked = { status: 'BLOCKED', previous_status: 'IN_PROGRESS' };
      const optionsProgress = TaskLifecycleService.getLegalTransitions(taskProgressBlocked.status, taskProgressBlocked.previous_status);
      expect(optionsProgress[0].status).toBe('IN_PROGRESS');
    });

    it('allows completed tasks to be reopened', async () => {
      const doneTask = { _id: 'dummy', status: 'DONE', previous_status: null, blockers: [] };
      const resProgress = await TaskLifecycleService.validateTransition(doneTask, 'IN_PROGRESS');
      const resBacklog = await TaskLifecycleService.validateTransition(doneTask, 'BACKLOG');
      expect(resProgress.valid).toBe(true);
      expect(resBacklog.valid).toBe(true);
    });

    it('prevents cyclical blocker dependencies', async () => {
      const pAlpha = await Project.findOne({ key: 'ALP' });

      const [tA, tB, tC] = await Promise.all([
        Task.create({ project: pAlpha._id, task_number: 901, title: 'Task A', status: 'BACKLOG', priority: 'MEDIUM' }),
        Task.create({ project: pAlpha._id, task_number: 902, title: 'Task B', status: 'BACKLOG', priority: 'MEDIUM' }),
        Task.create({ project: pAlpha._id, task_number: 903, title: 'Task C', status: 'BACKLOG', priority: 'MEDIUM' })
      ]);

      tA.blockers.push(tB._id);
      await tA.save();

      tB.blockers.push(tC._id);
      await tB.save();

      const wouldCycle = await TaskLifecycleService.wouldCreateCycle(tC._id, tA._id);
      expect(wouldCycle).toBe(true);
    });
  });

  describe('3. Project Membership & Auto-Unassignment', () => {
    it('unassigns user from all project tasks when removed from the project', async () => {
      const manager = await User.findOne({ role: 'MANAGER' });
      const member1 = await User.findOne({ email: 'member1@acme.com' });
      const pAlpha = await Project.findOne({ key: 'ALP' });

      const initialAssignedCount = await Task.countDocuments({ project: pAlpha._id, assignees: member1._id });
      expect(initialAssignedCount).toBeGreaterThan(0);

      const req = {
        user: { id: manager._id.toString(), role: manager.role },
        params: { id: pAlpha._id.toString(), userId: member1._id.toString() }
      };
      const res = { json: (data) => data };
      await ProjectController.removeMember(req, res);

      const updatedProject = await Project.findById(pAlpha._id);
      const isMember = updatedProject.members.some(m => m.toString() === member1._id.toString());
      expect(isMember).toBe(false);

      const postAssignedCount = await Task.countDocuments({ project: pAlpha._id, assignees: member1._id });
      expect(postAssignedCount).toBe(0);
    });
  });

  describe('4. Bulk Operations & Reporting', () => {
    it('reports per-task success and failures independently without failing the batch', async () => {
      const manager = await User.findOne({ role: 'MANAGER' });
      
      const backlogTask = await Task.findOne({ status: 'BACKLOG' });
      const doneTask = await Task.findOne({ status: 'DONE' });

      const req = {
        user: { id: manager._id.toString(), role: manager.role },
        body: {
          task_ids: [backlogTask._id.toString(), doneTask._id.toString()],
          action: 'UPDATE_STATUS',
          payload: { status: 'IN_PROGRESS' }
        }
      };

      let jsonResponse = null;
      const res = {
        json: (data) => { jsonResponse = data; return res; }
      };

      await BulkController.executeBulk(req, res);

      expect(jsonResponse.summary.total).toBe(2);
      expect(jsonResponse.summary.succeeded).toBe(2);
      
      const reqIllegal = {
        user: { id: manager._id.toString(), role: manager.role },
        body: {
          task_ids: [backlogTask._id.toString()],
          action: 'UPDATE_STATUS',
          payload: { status: 'DONE' }
        }
      };

      await BulkController.executeBulk(reqIllegal, res);
      expect(jsonResponse.summary.failed).toBe(1);
      expect(jsonResponse.results[0].success).toBe(false);
      expect(jsonResponse.results[0].error).toContain('Illegal status transition');
    });
  });

  describe('5. Overdue Alerts Dismissal & Resurface', () => {
    it('dismisses an overdue alert and brings it back when the due date changes', async () => {
      const member1 = await User.findOne({ email: 'member1@acme.com' });
      
      let reqAlerts = { user: { id: member1._id.toString(), role: member1.role } };
      let jsonAlerts = null;
      const resAlerts = { json: (data) => { jsonAlerts = data; return resAlerts; } };

      await AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      expect(jsonAlerts.count).toBeGreaterThan(0);
      const targetAlert = jsonAlerts.alerts[0];

      const reqDismiss = { user: { id: member1._id.toString() }, body: { taskId: targetAlert.task_id } };
      const resDismiss = { json: (data) => data };
      await AlertController.dismissAlert(reqDismiss, resDismiss);

      await AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      const stillThere = jsonAlerts.alerts.some((a) => a.task_id === targetAlert.task_id);
      expect(stillThere).toBe(false);

      const reqUpdate = {
        user: { id: member1._id.toString(), role: member1.role },
        params: { id: targetAlert.task_id },
        body: { due_date: '2026-08-15' }
      };
      const resUpdate = { json: (data) => data };
      await TaskController.updateTask(reqUpdate, resUpdate);

      await AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      const resurfaced = jsonAlerts.alerts.some((a) => a.task_id === targetAlert.task_id);
      expect(resurfaced).toBe(true);
    });
  });

  describe('6. Immutable Audit Timeline', () => {
    it('logs every task change and comments in chronological order', async () => {
      const manager = await User.findOne({ role: 'MANAGER' });
      const task = await Task.findOne();

      await AuditService.logActivity({
        taskId: task._id,
        userId: manager._id,
        activityType: 'COMMENT_ADDED',
        commentText: 'Verification audit entry.'
      });

      const timeline = await AuditService.getTimeline(task._id);
      expect(timeline.length).toBeGreaterThan(0);
      const lastEntry = timeline[timeline.length - 1];
      expect(lastEntry.comment_text).toBe('Verification audit entry.');
      expect(lastEntry.user_name).toContain('Sarah Connor');
    });
  });
});
