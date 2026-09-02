import bcrypt from 'bcryptjs';
import { db, initDatabase } from '../config/database.js';
import { AuditService } from '../services/auditService.js';

export function runSeed() {
  console.log('🌱 Initializing Database Schema...');
  initDatabase();

  console.log('🧹 Cleaning existing data...');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM alert_dismissals;
    DELETE FROM task_activities;
    DELETE FROM task_blockers;
    DELETE FROM task_assignees;
    DELETE FROM tasks;
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM users;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('👤 Seeding Users (Manager & Members)...');
  const passwordHashManager = bcrypt.hashSync('Manager123!', 10);
  const passwordHashMember = bcrypt.hashSync('Member123!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-60 days'))
  `);

  const manager1 = insertUser.run('manager@acme.com', passwordHashManager, 'Sarah Connor (Manager)', 'MANAGER', '#ef4444').lastInsertRowid;
  const member1 = insertUser.run('member1@acme.com', passwordHashMember, 'Alex Rivera', 'MEMBER', '#3b82f6').lastInsertRowid;
  const member2 = insertUser.run('member2@acme.com', passwordHashMember, 'Devon Vance', 'MEMBER', '#10b981').lastInsertRowid;
  const member3 = insertUser.run('member3@acme.com', passwordHashMember, 'Elena Rostova', 'MEMBER', '#8b5cf6').lastInsertRowid;

  console.log('📁 Seeding Projects...');
  const insertProject = db.prepare(`
    INSERT INTO projects (key, name, description, owner_id, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-50 days'), datetime('now', '-50 days'))
  `);

  const pAlpha = insertProject.run('ALP', 'Alpha Cloud Platform', 'Core multi-tenant infrastructure and cloud microservices overhaul.', manager1, 0).lastInsertRowid;
  const pBilling = insertProject.run('BIL', 'Billing & Payments Engine', 'Stripe integration, subscription tiers, automated invoice dispatch.', manager1, 0).lastInsertRowid;
  const pMobile = insertProject.run('MOB', 'Mobile Companion App', 'iOS and Android React Native client for on-the-go fleet telemetry.', manager1, 0).lastInsertRowid;
  const pLegacy = insertProject.run('LEG', 'Legacy Migration', 'Decommissioning of legacy PHP monolith v1 servers.', manager1, 1).lastInsertRowid;

  console.log('👥 Adding Project Members...');
  const addMember = db.prepare('INSERT INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, datetime(\'now\', \'-45 days\'))');
  
  addMember.run(pAlpha, manager1);
  addMember.run(pAlpha, member1);
  addMember.run(pAlpha, member2);

  addMember.run(pBilling, manager1);
  addMember.run(pBilling, member1);
  addMember.run(pBilling, member3);

  addMember.run(pMobile, manager1);
  addMember.run(pMobile, member2);
  addMember.run(pMobile, member3);

  addMember.run(pLegacy, manager1);
  addMember.run(pLegacy, member1);

  console.log('📝 Seeding Tasks with Realistic Histories & Blockers...');

  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, task_number, title, description, priority, status, previous_status, due_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const assignTask = db.prepare('INSERT INTO task_assignees (task_id, user_id, assigned_at) VALUES (?, ?, ?)');
  const addBlocker = db.prepare('INSERT INTO task_blockers (task_id, blocked_by_task_id, created_at) VALUES (?, ?, ?)');

  const daysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const daysAhead = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // --- PROJECT 1: ALPHA CLOUD PLATFORM ---
  const t1 = insertTask.run(pAlpha, 1, 'Design OAuth 2.0 Identity Broker', 'Architect federated login with Google Workspace and GitHub SSO.', 'HIGH', 'DONE', null, daysAgo(25), manager1, `${daysAgo(40)} 10:00:00`, `${daysAgo(21)} 15:30:00`).lastInsertRowid;
  assignTask.run(t1, member1, `${daysAgo(40)} 10:05:00`);
  AuditService.logActivity({ taskId: t1, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: t1, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: t1, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  AuditService.logActivity({ taskId: t1, userId: manager1, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });
  AuditService.logActivity({ taskId: t1, userId: manager1, activityType: 'COMMENT_ADDED', commentText: 'Identity architecture RFC reviewed and approved by engineering committee.' });

  const t2 = insertTask.run(pAlpha, 2, 'Implement Rate Limiting Middleware', 'Token bucket rate limiter with Redis backend at 100 req/sec limit.', 'MEDIUM', 'IN_REVIEW', null, daysAhead(2), manager1, `${daysAgo(15)} 09:00:00`, `${daysAgo(1)} 14:00:00`).lastInsertRowid;
  assignTask.run(t2, member1, `${daysAgo(15)} 09:10:00`);
  assignTask.run(t2, member2, `${daysAgo(10)} 11:00:00`);
  AuditService.logActivity({ taskId: t2, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: t2, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: t2, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  AuditService.logActivity({ taskId: t2, userId: member1, activityType: 'COMMENT_ADDED', commentText: 'PR #142 opened with 98% test coverage.' });

  const t3 = insertTask.run(pAlpha, 3, 'Provision Kubernetes Staging Cluster', 'Set up Terraform scripts and Helm charts for staging cluster.', 'HIGH', 'IN_PROGRESS', null, daysAhead(4), manager1, `${daysAgo(10)} 08:30:00`, `${daysAgo(2)} 16:00:00`).lastInsertRowid;
  assignTask.run(t3, member2, `${daysAgo(10)} 08:35:00`);
  AuditService.logActivity({ taskId: t3, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: t3, userId: member2, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });

  const t4 = insertTask.run(pAlpha, 4, 'Deploy Canary Traffic Splitter', 'Configure Envoy ingress to route 5% traffic to canary builds.', 'MEDIUM', 'BLOCKED', 'IN_PROGRESS', daysAhead(6), manager1, `${daysAgo(8)} 11:00:00`, `${daysAgo(3)} 10:00:00`).lastInsertRowid;
  assignTask.run(t4, member1, `${daysAgo(8)} 11:05:00`);
  addBlocker.run(t4, t3, `${daysAgo(7)} 09:00:00`);
  AuditService.logActivity({ taskId: t4, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: t4, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: t4, userId: member1, activityType: 'BLOCKER_ADDED', newValue: 'Blocked by ALP-3 (Provision Kubernetes Staging Cluster)' });
  AuditService.logActivity({ taskId: t4, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'BLOCKED' });
  AuditService.logActivity({ taskId: t4, userId: member1, activityType: 'COMMENT_ADDED', commentText: 'Waiting for staging cluster DNS and ingress endpoints from Devon.' });

  const t5 = insertTask.run(pAlpha, 5, 'Security Audit: Rotate Database SSL Certificates', 'Update CA certs before old certificate expiration.', 'URGENT', 'IN_PROGRESS', null, daysAgo(4), manager1, `${daysAgo(14)} 13:00:00`, `${daysAgo(4)} 12:00:00`).lastInsertRowid;
  assignTask.run(t5, member1, `${daysAgo(14)} 13:05:00`);
  AuditService.logActivity({ taskId: t5, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: t5, userId: member1, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: t5, userId: manager1, activityType: 'COMMENT_ADDED', commentText: 'Please prioritize, client compliance deadline is approaching.' });

  const t6 = insertTask.run(pAlpha, 6, 'Implement OpenTelemetry Distributed Tracing', 'Add Jaeger / OTEL spans across gRPC services.', 'LOW', 'BACKLOG', null, daysAhead(20), manager1, `${daysAgo(5)} 10:00:00`, `${daysAgo(5)} 10:00:00`).lastInsertRowid;
  AuditService.logActivity({ taskId: t6, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });

  // --- PROJECT 2: BILLING & PAYMENTS ENGINE ---
  const tb1 = insertTask.run(pBilling, 1, 'Integrate Stripe Webhooks Idempotency', 'Prevent duplicate charge processing on network retry events.', 'HIGH', 'IN_PROGRESS', null, daysAgo(2), manager1, `${daysAgo(12)} 11:00:00`, `${daysAgo(2)} 09:00:00`).lastInsertRowid;
  assignTask.run(tb1, member3, `${daysAgo(12)} 11:05:00`);
  AuditService.logActivity({ taskId: tb1, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: tb1, userId: member3, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });

  const tb2 = insertTask.run(pBilling, 2, 'PDF Invoice Generation Service', 'Generate branded PDF receipts with QR payment codes.', 'MEDIUM', 'DONE', null, daysAgo(1), manager1, `${daysAgo(18)} 14:00:00`, `${daysAgo(1)} 16:30:00`).lastInsertRowid;
  assignTask.run(tb2, member3, `${daysAgo(18)} 14:05:00`);
  assignTask.run(tb2, member1, `${daysAgo(18)} 14:05:00`);
  AuditService.logActivity({ taskId: tb2, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: tb2, userId: member3, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: tb2, userId: member3, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  AuditService.logActivity({ taskId: tb2, userId: manager1, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });

  const tb3 = insertTask.run(pBilling, 3, 'Multi-Currency Settlement FX Calculations', 'Support EUR, GBP, JPY with real-time ECB rates feed.', 'MEDIUM', 'BACKLOG', null, daysAhead(14), manager1, `${daysAgo(6)} 09:00:00`, `${daysAgo(6)} 09:00:00`).lastInsertRowid;
  AuditService.logActivity({ taskId: tb3, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });

  // --- PROJECT 3: MOBILE COMPANION APP ---
  const tm1 = insertTask.run(pMobile, 1, 'Biometric FaceID / TouchID Authentication', 'Secure app launch using device secure enclave biometrics.', 'HIGH', 'IN_REVIEW', null, daysAhead(3), manager1, `${daysAgo(9)} 10:00:00`, `${daysAgo(1)} 11:00:00`).lastInsertRowid;
  assignTask.run(tm1, member2, `${daysAgo(9)} 10:05:00`);
  AuditService.logActivity({ taskId: tm1, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: tm1, userId: member2, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  AuditService.logActivity({ taskId: tm1, userId: member2, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });

  const tm2 = insertTask.run(pMobile, 2, 'Push Notification Deep Linking Router', 'Handle APNS & FCM payloads navigating directly to incident details.', 'URGENT', 'IN_PROGRESS', null, daysAgo(5), manager1, `${daysAgo(16)} 14:00:00`, `${daysAgo(5)} 10:00:00`).lastInsertRowid;
  assignTask.run(tm2, member2, `${daysAgo(16)} 14:05:00`);
  AuditService.logActivity({ taskId: tm2, userId: manager1, activityType: 'CREATED', newValue: 'Created task' });
  AuditService.logActivity({ taskId: tm2, userId: member2, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });

  // --- 8-WEEK HISTORICAL COMPLETIONS FOR DASHBOARD ---
  console.log('📊 Seeding 8-Week Historical Completed Tasks...');
  const pastCompletions = [
    { title: 'Setup GitHub Actions CI/CD Pipeline', weeksAgo: 7, user: member1, project: pAlpha },
    { title: 'Docker multi-stage build optimization', weeksAgo: 7, user: member2, project: pAlpha },
    { title: 'Database schema migration framework', weeksAgo: 6, user: member1, project: pBilling },
    { title: 'Initial React Native skeleton', weeksAgo: 6, user: member2, project: pMobile },
    { title: 'REST API Authentication tokens', weeksAgo: 5, user: member3, project: pBilling },
    { title: 'Client dashboard wireframes', weeksAgo: 5, user: member2, project: pMobile },
    { title: 'PostgreSQL connection pooling', weeksAgo: 4, user: member1, project: pAlpha },
    { title: 'Stripe customer portal integration', weeksAgo: 4, user: member3, project: pBilling },
    { title: 'Offline sync SQLite caching on device', weeksAgo: 3, user: member2, project: pMobile },
    { title: 'Prometheus metrics endpoint', weeksAgo: 3, user: member1, project: pAlpha },
    { title: 'VAT tax calculation engine', weeksAgo: 2, user: member3, project: pBilling },
    { title: 'Push notification certificates renewal', weeksAgo: 2, user: member2, project: pMobile },
    { title: 'Healthcheck ping endpoint', weeksAgo: 1, user: member1, project: pAlpha },
    { title: 'Invoice webhook audit log', weeksAgo: 1, user: member3, project: pBilling }
  ];

  let taskCounter = 10;
  for (const item of pastCompletions) {
    taskCounter++;
    const completedDate = `${daysAgo(item.weeksAgo * 7 + 2)} 15:00:00`;
    const createdDate = `${daysAgo(item.weeksAgo * 7 + 6)} 09:00:00`;
    const historicalTask = insertTask.run(
      item.project,
      taskCounter,
      item.title,
      'Historical completed task recorded in sprint cadence.',
      'MEDIUM',
      'DONE',
      null,
      daysAgo(item.weeksAgo * 7 + 3),
      manager1,
      createdDate,
      completedDate
    ).lastInsertRowid;

    assignTask.run(historicalTask, item.user, createdDate);
    AuditService.logActivity({ taskId: historicalTask, userId: manager1, activityType: 'CREATED', newValue: 'Task created' });
    AuditService.logActivity({ taskId: historicalTask, userId: item.user, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });
  }

  console.log('✅ Seeding completed successfully!');
}

if (process.argv[1] === import.meta.filename) {
  runSeed();
}
