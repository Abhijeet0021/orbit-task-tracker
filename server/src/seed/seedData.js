import bcrypt from 'bcryptjs';
import { initDatabase, closeDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { TaskActivity } from '../models/TaskActivity.js';
import { AlertDismissal } from '../models/AlertDismissal.js';
import { AuditService } from '../services/auditService.js';

export async function runSeed(customUri = null) {
  console.log('🌱 Initializing MongoDB Connection...');
  await initDatabase(customUri || undefined);

  console.log('🧹 Cleaning existing collections...');
  await Promise.all([
    AlertDismissal.deleteMany({}),
    TaskActivity.deleteMany({}),
    Task.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({})
  ]);

  console.log('👤 Seeding Users (Manager & Members)...');
  const passwordHash = bcrypt.hashSync('password123', 10);

  const [manager1, member1, member2, member3] = await Promise.all([
    User.create({
      name: 'Sarah Connor (Manager)',
      email: 'manager@acme.com',
      password: passwordHash,
      role: 'MANAGER',
      avatar_color: '#ef4444',
      created_at: new Date(Date.now() - 60 * 86400000)
    }),
    User.create({
      name: 'Alex Rivera',
      email: 'member1@acme.com',
      password: passwordHash,
      role: 'MEMBER',
      avatar_color: '#3b82f6',
      created_at: new Date(Date.now() - 60 * 86400000)
    }),
    User.create({
      name: 'Devon Vance',
      email: 'member2@acme.com',
      password: passwordHash,
      role: 'MEMBER',
      avatar_color: '#10b981',
      created_at: new Date(Date.now() - 60 * 86400000)
    }),
    User.create({
      name: 'Elena Rostova',
      email: 'member3@acme.com',
      password: passwordHash,
      role: 'MEMBER',
      avatar_color: '#8b5cf6',
      created_at: new Date(Date.now() - 60 * 86400000)
    })
  ]);

  console.log('📁 Seeding Projects...');
  const [pAlpha, pBilling, pMobile, pLegacy] = await Promise.all([
    Project.create({
      key: 'ALP',
      name: 'Alpha Cloud Platform',
      description: 'Core multi-tenant infrastructure and cloud microservices overhaul.',
      created_by: manager1._id,
      is_archived: false,
      members: [manager1._id, member1._id, member2._id],
      created_at: new Date(Date.now() - 50 * 86400000),
      updated_at: new Date(Date.now() - 50 * 86400000)
    }),
    Project.create({
      key: 'BIL',
      name: 'Billing & Payments Engine',
      description: 'Stripe integration, subscription tiers, automated invoice dispatch.',
      created_by: manager1._id,
      is_archived: false,
      members: [manager1._id, member1._id, member3._id],
      created_at: new Date(Date.now() - 50 * 86400000),
      updated_at: new Date(Date.now() - 50 * 86400000)
    }),
    Project.create({
      key: 'MOB',
      name: 'Mobile Companion App',
      description: 'iOS and Android React Native client for on-the-go fleet telemetry.',
      created_by: manager1._id,
      is_archived: false,
      members: [manager1._id, member2._id, member3._id],
      created_at: new Date(Date.now() - 50 * 86400000),
      updated_at: new Date(Date.now() - 50 * 86400000)
    }),
    Project.create({
      key: 'LEG',
      name: 'Legacy Migration',
      description: 'Decommissioning of legacy PHP monolith v1 servers.',
      created_by: manager1._id,
      is_archived: true,
      members: [manager1._id, member1._id],
      created_at: new Date(Date.now() - 50 * 86400000),
      updated_at: new Date(Date.now() - 50 * 86400000)
    })
  ]);

  console.log('📝 Seeding Tasks with Realistic Histories & Blockers...');

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
  const t1 = await Task.create({
    project: pAlpha._id,
    task_number: 1,
    title: 'Design OAuth 2.0 Identity Broker',
    description: 'Architect federated login with Google Workspace and GitHub SSO.',
    priority: 'HIGH',
    status: 'DONE',
    previous_status: null,
    due_date: daysAgo(25),
    assignees: [member1._id],
    created_at: new Date(Date.now() - 40 * 86400000),
    updated_at: new Date(Date.now() - 21 * 86400000)
  });
  await AuditService.logActivity({ taskId: t1._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: t1._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: t1._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  await AuditService.logActivity({ taskId: t1._id, userId: manager1._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });
  await AuditService.logActivity({ taskId: t1._id, userId: manager1._id, activityType: 'COMMENT_ADDED', commentText: 'Identity architecture RFC reviewed and approved by engineering committee.' });

  const t2 = await Task.create({
    project: pAlpha._id,
    task_number: 2,
    title: 'Implement Rate Limiting Middleware',
    description: 'Token bucket rate limiter with Redis backend at 100 req/sec limit.',
    priority: 'MEDIUM',
    status: 'IN_REVIEW',
    previous_status: null,
    due_date: daysAhead(2),
    assignees: [member1._id, member2._id],
    created_at: new Date(Date.now() - 15 * 86400000),
    updated_at: new Date(Date.now() - 1 * 86400000)
  });
  await AuditService.logActivity({ taskId: t2._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: t2._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: t2._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  await AuditService.logActivity({ taskId: t2._id, userId: member1._id, activityType: 'COMMENT_ADDED', commentText: 'PR #142 opened with 98% test coverage.' });

  const t3 = await Task.create({
    project: pAlpha._id,
    task_number: 3,
    title: 'Provision Kubernetes Staging Cluster',
    description: 'Set up Terraform scripts and Helm charts for staging cluster.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    previous_status: null,
    due_date: daysAhead(4),
    assignees: [member2._id],
    created_at: new Date(Date.now() - 10 * 86400000),
    updated_at: new Date(Date.now() - 2 * 86400000)
  });
  await AuditService.logActivity({ taskId: t3._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: t3._id, userId: member2._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });

  const t4 = await Task.create({
    project: pAlpha._id,
    task_number: 4,
    title: 'Deploy Canary Traffic Splitter',
    description: 'Configure Envoy ingress to route 5% traffic to canary builds.',
    priority: 'MEDIUM',
    status: 'BLOCKED',
    previous_status: 'IN_PROGRESS',
    due_date: daysAhead(6),
    assignees: [member1._id],
    blockers: [t3._id],
    created_at: new Date(Date.now() - 8 * 86400000),
    updated_at: new Date(Date.now() - 3 * 86400000)
  });
  await AuditService.logActivity({ taskId: t4._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: t4._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: t4._id, userId: member1._id, activityType: 'BLOCKER_ADDED', newValue: 'Blocked by ALP-3 (Provision Kubernetes Staging Cluster)' });
  await AuditService.logActivity({ taskId: t4._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'BLOCKED' });
  await AuditService.logActivity({ taskId: t4._id, userId: member1._id, activityType: 'COMMENT_ADDED', commentText: 'Waiting for staging cluster DNS and ingress endpoints from Devon.' });

  const t5 = await Task.create({
    project: pAlpha._id,
    task_number: 5,
    title: 'Security Audit: Rotate Database SSL Certificates',
    description: 'Update CA certs before old certificate expiration.',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    previous_status: null,
    due_date: daysAgo(4),
    assignees: [member1._id],
    created_at: new Date(Date.now() - 14 * 86400000),
    updated_at: new Date(Date.now() - 4 * 86400000)
  });
  await AuditService.logActivity({ taskId: t5._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: t5._id, userId: member1._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: t5._id, userId: manager1._id, activityType: 'COMMENT_ADDED', commentText: 'Please prioritize, client compliance deadline is approaching.' });

  const t6 = await Task.create({
    project: pAlpha._id,
    task_number: 6,
    title: 'Implement OpenTelemetry Distributed Tracing',
    description: 'Add Jaeger / OTEL spans across gRPC services.',
    priority: 'LOW',
    status: 'BACKLOG',
    previous_status: null,
    due_date: daysAhead(20),
    assignees: [],
    created_at: new Date(Date.now() - 5 * 86400000),
    updated_at: new Date(Date.now() - 5 * 86400000)
  });
  await AuditService.logActivity({ taskId: t6._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });

  // --- PROJECT 2: BILLING & PAYMENTS ENGINE ---
  const tb1 = await Task.create({
    project: pBilling._id,
    task_number: 1,
    title: 'Integrate Stripe Webhooks Idempotency',
    description: 'Prevent duplicate charge processing on network retry events.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    previous_status: null,
    due_date: daysAgo(2),
    assignees: [member3._id],
    created_at: new Date(Date.now() - 12 * 86400000),
    updated_at: new Date(Date.now() - 2 * 86400000)
  });
  await AuditService.logActivity({ taskId: tb1._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: tb1._id, userId: member3._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });

  const tb2 = await Task.create({
    project: pBilling._id,
    task_number: 2,
    title: 'PDF Invoice Generation Service',
    description: 'Generate branded PDF receipts with QR payment codes.',
    priority: 'MEDIUM',
    status: 'DONE',
    previous_status: null,
    due_date: daysAgo(1),
    assignees: [member3._id, member1._id],
    created_at: new Date(Date.now() - 18 * 86400000),
    updated_at: new Date(Date.now() - 1 * 86400000)
  });
  await AuditService.logActivity({ taskId: tb2._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: tb2._id, userId: member3._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: tb2._id, userId: member3._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });
  await AuditService.logActivity({ taskId: tb2._id, userId: manager1._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });

  // --- PROJECT 3: MOBILE COMPANION APP ---
  const tm1 = await Task.create({
    project: pMobile._id,
    task_number: 1,
    title: 'Biometric FaceID / TouchID Authentication',
    description: 'Secure app launch using device secure enclave biometrics.',
    priority: 'HIGH',
    status: 'IN_REVIEW',
    previous_status: null,
    due_date: daysAhead(3),
    assignees: [member2._id],
    created_at: new Date(Date.now() - 9 * 86400000),
    updated_at: new Date(Date.now() - 1 * 86400000)
  });
  await AuditService.logActivity({ taskId: tm1._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Created task' });
  await AuditService.logActivity({ taskId: tm1._id, userId: member2._id, activityType: 'STATUS_CHANGED', oldValue: 'BACKLOG', newValue: 'IN_PROGRESS' });
  await AuditService.logActivity({ taskId: tm1._id, userId: member2._id, activityType: 'STATUS_CHANGED', oldValue: 'IN_PROGRESS', newValue: 'IN_REVIEW' });

  // --- 8-WEEK HISTORICAL COMPLETIONS FOR DASHBOARD ---
  console.log('📊 Seeding 8-Week Historical Completed Tasks...');
  const pastCompletions = [
    { title: 'Setup GitHub Actions CI/CD Pipeline', weeksAgo: 7, user: member1._id, project: pAlpha._id },
    { title: 'Docker multi-stage build optimization', weeksAgo: 7, user: member2._id, project: pAlpha._id },
    { title: 'Database schema migration framework', weeksAgo: 6, user: member1._id, project: pBilling._id },
    { title: 'Initial React Native skeleton', weeksAgo: 6, user: member2._id, project: pMobile._id },
    { title: 'REST API Authentication tokens', weeksAgo: 5, user: member3._id, project: pBilling._id },
    { title: 'Client dashboard wireframes', weeksAgo: 5, user: member2._id, project: pMobile._id },
    { title: 'PostgreSQL connection pooling', weeksAgo: 4, user: member1._id, project: pAlpha._id },
    { title: 'Stripe customer portal integration', weeksAgo: 4, user: member3._id, project: pBilling._id },
    { title: 'Offline sync SQLite caching on device', weeksAgo: 3, user: member2._id, project: pMobile._id },
    { title: 'Prometheus metrics endpoint', weeksAgo: 3, user: member1._id, project: pAlpha._id },
    { title: 'VAT tax calculation engine', weeksAgo: 2, user: member3._id, project: pBilling._id },
    { title: 'Push notification certificates renewal', weeksAgo: 2, user: member2._id, project: pMobile._id },
    { title: 'Healthcheck ping endpoint', weeksAgo: 1, user: member1._id, project: pAlpha._id },
    { title: 'Invoice webhook audit log', weeksAgo: 1, user: member3._id, project: pBilling._id }
  ];

  let taskCounter = 10;
  for (const item of pastCompletions) {
    taskCounter++;
    const completedDate = new Date(Date.now() - (item.weeksAgo * 7 + 2) * 86400000);
    const createdDate = new Date(Date.now() - (item.weeksAgo * 7 + 6) * 86400000);

    const histTask = await Task.create({
      project: item.project,
      task_number: taskCounter,
      title: item.title,
      description: 'Historical completed task recorded in sprint cadence.',
      priority: 'MEDIUM',
      status: 'DONE',
      previous_status: null,
      due_date: daysAgo(item.weeksAgo * 7 + 3),
      assignees: [item.user],
      created_at: createdDate,
      updated_at: completedDate
    });

    await AuditService.logActivity({ taskId: histTask._id, userId: manager1._id, activityType: 'CREATED', newValue: 'Task created' });
    await AuditService.logActivity({ taskId: histTask._id, userId: item.user, activityType: 'STATUS_CHANGED', oldValue: 'IN_REVIEW', newValue: 'DONE' });
  }

  console.log('✅ Seeding completed successfully!');
}

if (process.argv[1] === import.meta.filename) {
  runSeed().then(() => {
    closeDatabase().then(() => process.exit(0));
  }).catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}
