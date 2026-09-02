import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { ProjectController } from '../controllers/projectController.js';
import { TaskController } from '../controllers/taskController.js';
import { BulkController } from '../controllers/bulkController.js';
import { AlertController } from '../controllers/alertController.js';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate, requireManager } from '../middleware/auth.js';

export const router = Router();

// Auth routes
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authenticate, AuthController.me);
router.get('/users', authenticate, AuthController.listUsers);

// Project routes
router.get('/projects', authenticate, ProjectController.listProjects);
router.post('/projects', authenticate, requireManager, ProjectController.createProject);
router.get('/projects/:id', authenticate, ProjectController.getProject);
router.put('/projects/:id', authenticate, requireManager, ProjectController.updateProject);
router.post('/projects/:id/archive', authenticate, requireManager, ProjectController.archiveProject);
router.post('/projects/:id/restore', authenticate, requireManager, ProjectController.restoreProject);
router.post('/projects/:id/members', authenticate, requireManager, ProjectController.addMember);
router.delete('/projects/:id/members/:userId', authenticate, requireManager, ProjectController.removeMember);

// Task routes
router.get('/tasks', authenticate, TaskController.listTasks);
router.get('/tasks/export.csv', authenticate, TaskController.exportCsv);
router.get('/tasks/export-csv', authenticate, TaskController.exportCsv);
router.get('/activities', authenticate, TaskController.getActivityFeed);
router.get('/activity', authenticate, TaskController.getActivityFeed);
router.post('/tasks/bulk', authenticate, BulkController.executeBulk);
router.post('/tasks/bulk-update', authenticate, BulkController.executeBulk);
router.post('/tasks', authenticate, TaskController.createTask);
router.get('/tasks/:id', authenticate, TaskController.getTask);
router.put('/tasks/:id', authenticate, TaskController.updateTask);
router.delete('/tasks/:id', authenticate, TaskController.deleteTask);

// Task Sub-resources
router.post('/tasks/:id/assignees', authenticate, TaskController.addAssignee);
router.delete('/tasks/:id/assignees/:userId', authenticate, TaskController.removeAssignee);
router.post('/tasks/:id/blockers', authenticate, TaskController.addBlocker);
router.delete('/tasks/:id/blockers/:blockerId', authenticate, TaskController.removeBlocker);
router.post('/tasks/:id/comments', authenticate, TaskController.addComment);

// Overdue Alerts
router.get('/alerts', authenticate, AlertController.getOverdueAlerts);
router.get('/alerts/overdue', authenticate, AlertController.getOverdueAlerts);
router.post('/alerts/dismiss', authenticate, AlertController.dismissAlert);

// Dashboard
router.get('/dashboard', authenticate, DashboardController.getStats);
router.get('/dashboard/stats', authenticate, DashboardController.getStats);
