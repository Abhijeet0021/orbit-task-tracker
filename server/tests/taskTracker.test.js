import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/config/database.js';
import { runSeed } from '../src/seed/seedData.js';
import { TaskLifecycleService } from '../src/services/taskLifecycle.js';
import { TaskController } from '../src/controllers/taskController.js';
import { BulkController } from '../src/controllers/bulkController.js';
import { AlertController } from '../src/controllers/alertController.js';
import { ProjectController } from '../src/controllers/projectController.js';
import { AuditService } from '../src/services/auditService.js';

describe('Project & Task Tracking System — Comprehensive Test Suite (JavaScript)', () => {
  beforeEach(() => {
    runSeed();
  });

  describe('1. RBAC & Access Control', () => {
    it('enforces that members cannot delete tasks', () => {
      const member = db.prepare("SELECT * FROM users WHERE role = 'MEMBER'").get();
      const task = db.prepare('SELECT * FROM tasks LIMIT 1').get();

      const req = { user: member, params: { id: task.id.toString() } };
      let statusCode = 0;
      let jsonResponse = null;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonResponse = data; return res; }
      };

      TaskController.deleteTask(req, res);
      expect(statusCode).toBe(403);
      expect(jsonResponse.error).toContain('Only managers can delete tasks');
    });

    it('enforces that managers CAN delete tasks', () => {
      const manager = db.prepare("SELECT * FROM users WHERE role = 'MANAGER'").get();
      const task = db.prepare('SELECT * FROM tasks LIMIT 1').get();

      const req = { user: manager, params: { id: task.id.toString() } };
      let statusCode = 200;
      let jsonResponse = null;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { jsonResponse = data; return res; }
      };

      TaskController.deleteTask(req, res);
      expect(jsonResponse.message).toContain('deleted successfully');
      
      const check = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task.id);
      expect(check).toBeUndefined();
    });

    it('allows managers to archive and restore projects', () => {
      const manager = db.prepare("SELECT * FROM users WHERE role = 'MANAGER'").get();
      const project = db.prepare('SELECT * FROM projects WHERE is_archived = 0 LIMIT 1').get();

      const req = { user: manager, params: { id: project.id.toString() } };
      const res = { json: (data) => data };

      ProjectController.archiveProject(req, res);
      const archived = db.prepare('SELECT is_archived FROM projects WHERE id = ?').get(project.id);
      expect(archived.is_archived).toBe(1);

      ProjectController.restoreProject(req, res);
      const restored = db.prepare('SELECT is_archived FROM projects WHERE id = ?').get(project.id);
      expect(restored.is_archived).toBe(0);
    });
  });

  describe('2. Strict Task Lifecycle State Machine & Blocker Rules', () => {
    it('rejects direct illegal jump from BACKLOG to DONE', () => {
      const task = { id: 99, status: 'BACKLOG', previous_status: null, project_id: 1 };
      const result = TaskLifecycleService.validateTransition(task, 'DONE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Illegal status transition from BACKLOG to DONE');
    });

    it('allows legal progression: BACKLOG -> IN_PROGRESS -> IN_REVIEW -> DONE', () => {
      let task = { id: 999, status: 'BACKLOG', previous_status: null, project_id: 1 };
      
      let res1 = TaskLifecycleService.validateTransition(task, 'IN_PROGRESS');
      expect(res1.valid).toBe(true);
      
      task.status = 'IN_PROGRESS';
      let res2 = TaskLifecycleService.validateTransition(task, 'IN_REVIEW');
      expect(res2.valid).toBe(true);

      task.status = 'IN_REVIEW';
      let res3 = TaskLifecycleService.validateTransition(task, 'DONE');
      expect(res3.valid).toBe(true);
    });

    it('rejects move to DONE when an unfinished blocker exists', () => {
      const alp4 = db.prepare(`
        SELECT t.* FROM tasks t 
        JOIN projects p ON t.project_id = p.id 
        WHERE p.key = 'ALP' AND t.task_number = 4
      `).get();

      alp4.status = 'IN_REVIEW';

      const result = TaskLifecycleService.validateTransition(alp4, 'DONE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Blocked by unfinished task');
    });

    it('allows move to DONE when all blockers are completed', () => {
      const alp3 = db.prepare(`
        SELECT t.id FROM tasks t 
        JOIN projects p ON t.project_id = p.id 
        WHERE p.key = 'ALP' AND t.task_number = 3
      `).get();
      db.prepare("UPDATE tasks SET status = 'DONE' WHERE id = ?").run(alp3.id);

      const alp4 = db.prepare(`
        SELECT t.* FROM tasks t 
        JOIN projects p ON t.project_id = p.id 
        WHERE p.key = 'ALP' AND t.task_number = 4
      `).get();
      alp4.status = 'IN_REVIEW';

      const result = TaskLifecycleService.validateTransition(alp4, 'DONE');
      expect(result.valid).toBe(true);
    });

    it('preserves and restores previous_status when unblocking', () => {
      const taskReviewBlocked = { id: 101, status: 'BLOCKED', previous_status: 'IN_REVIEW', project_id: 1 };
      const optionsReview = TaskLifecycleService.getLegalTransitions(taskReviewBlocked.status, taskReviewBlocked.previous_status);
      expect(optionsReview[0].status).toBe('IN_REVIEW');

      const taskProgressBlocked = { id: 102, status: 'BLOCKED', previous_status: 'IN_PROGRESS', project_id: 1 };
      const optionsProgress = TaskLifecycleService.getLegalTransitions(taskProgressBlocked.status, taskProgressBlocked.previous_status);
      expect(optionsProgress[0].status).toBe('IN_PROGRESS');
    });

    it('allows completed tasks to be reopened', () => {
      const doneTask = { id: 103, status: 'DONE', previous_status: null, project_id: 1 };
      const resProgress = TaskLifecycleService.validateTransition(doneTask, 'IN_PROGRESS');
      const resBacklog = TaskLifecycleService.validateTransition(doneTask, 'BACKLOG');
      expect(resProgress.valid).toBe(true);
      expect(resBacklog.valid).toBe(true);
    });

    it('prevents cyclical blocker dependencies', () => {
      const pAlpha = db.prepare("SELECT id FROM projects WHERE key = 'ALP'").get();
      const uManager = db.prepare("SELECT id FROM users WHERE role = 'MANAGER'").get();

      const tA = db.prepare("INSERT INTO tasks (project_id, task_number, title, created_by) VALUES (?, 901, 'Task A', ?)").run(pAlpha.id, uManager.id).lastInsertRowid;
      const tB = db.prepare("INSERT INTO tasks (project_id, task_number, title, created_by) VALUES (?, 902, 'Task B', ?)").run(pAlpha.id, uManager.id).lastInsertRowid;
      const tC = db.prepare("INSERT INTO tasks (project_id, task_number, title, created_by) VALUES (?, 903, 'Task C', ?)").run(pAlpha.id, uManager.id).lastInsertRowid;

      db.prepare('INSERT INTO task_blockers (task_id, blocked_by_task_id) VALUES (?, ?)').run(tA, tB);
      db.prepare('INSERT INTO task_blockers (task_id, blocked_by_task_id) VALUES (?, ?)').run(tB, tC);

      const wouldCycle = TaskLifecycleService.wouldCreateCycle(tC, tA);
      expect(wouldCycle).toBe(true);
    });
  });

  describe('3. Project Membership & Auto-Unassignment', () => {
    it('unassigns user from all project tasks when removed from the project', () => {
      const manager = db.prepare("SELECT * FROM users WHERE role = 'MANAGER'").get();
      const member1 = db.prepare("SELECT * FROM users WHERE email = 'member1@acme.com'").get();
      const pAlpha = db.prepare("SELECT * FROM projects WHERE key = 'ALP'").get();

      const initialAssigned = db.prepare(`
        SELECT COUNT(*) as count FROM task_assignees ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.project_id = ? AND ta.user_id = ?
      `).get(pAlpha.id, member1.id);
      expect(initialAssigned.count).toBeGreaterThan(0);

      const req = { user: manager, params: { id: pAlpha.id.toString(), userId: member1.id.toString() } };
      const res = { json: (data) => data };
      ProjectController.removeMember(req, res);

      const isMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(pAlpha.id, member1.id);
      expect(isMember).toBeUndefined();

      const postAssigned = db.prepare(`
        SELECT COUNT(*) as count FROM task_assignees ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.project_id = ? AND ta.user_id = ?
      `).get(pAlpha.id, member1.id);
      expect(postAssigned.count).toBe(0);
    });
  });

  describe('4. Bulk Operations & Reporting', () => {
    it('reports per-task success and failures independently without failing the batch', () => {
      const manager = db.prepare("SELECT * FROM users WHERE role = 'MANAGER'").get();
      
      const backlogTask = db.prepare("SELECT id FROM tasks WHERE status = 'BACKLOG' LIMIT 1").get();
      const doneTask = db.prepare("SELECT id FROM tasks WHERE status = 'DONE' LIMIT 1").get();

      const req = {
        user: manager,
        body: {
          task_ids: [backlogTask.id, doneTask.id],
          action: 'UPDATE_STATUS',
          payload: { status: 'IN_PROGRESS' }
        }
      };

      let jsonResponse = null;
      const res = {
        json: (data) => { jsonResponse = data; return res; }
      };

      BulkController.executeBulk(req, res);

      expect(jsonResponse.summary.total).toBe(2);
      expect(jsonResponse.summary.succeeded).toBe(2);
      
      const reqIllegal = {
        user: manager,
        body: {
          task_ids: [backlogTask.id],
          action: 'UPDATE_STATUS',
          payload: { status: 'DONE' }
        }
      };

      BulkController.executeBulk(reqIllegal, res);
      expect(jsonResponse.summary.failed).toBe(1);
      expect(jsonResponse.results[0].success).toBe(false);
      expect(jsonResponse.results[0].error).toContain('Illegal status transition');
    });
  });

  describe('5. Overdue Alerts Dismissal & Resurface', () => {
    it('dismisses an overdue alert and brings it back when the due date changes', () => {
      const member1 = db.prepare("SELECT * FROM users WHERE email = 'member1@acme.com'").get();
      
      let reqAlerts = { user: member1 };
      let jsonAlerts = null;
      const resAlerts = { json: (data) => { jsonAlerts = data; return resAlerts; } };

      AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      expect(jsonAlerts.count).toBeGreaterThan(0);
      const targetAlert = jsonAlerts.alerts[0];

      const reqDismiss = { user: member1, body: { taskId: targetAlert.task_id } };
      const resDismiss = { json: (data) => data };
      AlertController.dismissAlert(reqDismiss, resDismiss);

      AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      const stillThere = jsonAlerts.alerts.some((a) => a.task_id === targetAlert.task_id);
      expect(stillThere).toBe(false);

      const reqUpdate = {
        user: member1,
        params: { id: targetAlert.task_id.toString() },
        body: { due_date: '2026-08-15' }
      };
      const resUpdate = { json: (data) => data };
      TaskController.updateTask(reqUpdate, resUpdate);

      AlertController.getOverdueAlerts(reqAlerts, resAlerts);
      const resurfaced = jsonAlerts.alerts.some((a) => a.task_id === targetAlert.task_id);
      expect(resurfaced).toBe(true);
    });
  });

  describe('6. Immutable Audit Timeline', () => {
    it('logs every task change and comments in chronological order', () => {
      const manager = db.prepare("SELECT * FROM users WHERE role = 'MANAGER'").get();
      const task = db.prepare('SELECT id FROM tasks LIMIT 1').get();

      AuditService.logActivity({
        taskId: task.id,
        userId: manager.id,
        activityType: 'COMMENT_ADDED',
        commentText: 'Verification audit entry.'
      });

      const timeline = AuditService.getTimeline(task.id);
      expect(timeline.length).toBeGreaterThan(0);
      const lastEntry = timeline[timeline.length - 1];
      expect(lastEntry.comment_text).toBe('Verification audit entry.');
      expect(lastEntry.user_name).toBe(manager.name);
    });
  });
});
