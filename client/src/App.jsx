import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AlertProvider } from './context/AlertContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then(m => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage.jsx').then(m => ({ default: m.ProjectDetailPage })));
const TasksListPage = lazy(() => import('./pages/TasksListPage.jsx').then(m => ({ default: m.TasksListPage })));
const MyTasksPage = lazy(() => import('./pages/MyTasksPage.jsx').then(m => ({ default: m.MyTasksPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx').then(m => ({ default: m.AlertsPage })));
const ActivityFeedPage = lazy(() => import('./pages/ActivityFeedPage.jsx').then(m => ({ default: m.ActivityFeedPage })));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white text-xs font-semibold gap-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Authenticating...</span>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }}
          className="text-slate-500 hover:text-slate-300 text-[11px] underline transition-colors cursor-pointer mt-2"
        >
          Taking too long? Click to reset session
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <AuthProvider>
      <AlertProvider>
        <ToastProvider>
          <Suspense fallback={
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs">
              Loading...
            </div>
          }>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="tasks" element={<TasksListPage />} />
                <Route path="my-tasks" element={<MyTasksPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="activity" element={<ActivityFeedPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AlertProvider>
    </AuthProvider>
  );
};
