import { createBrowserRouter, Outlet } from 'react-router';
import { Login } from './components/Login';
import { WorkerDashboard } from './components/WorkerDashboard';
import { SupervisorDashboard } from './components/SupervisorDashboard';
import { ShiftSummary } from './components/ShiftSummary';
import { ShiftHistory } from './components/ShiftHistory';
import { TaskDetail } from './components/TaskDetail';
import { CreateTask } from './components/CreateTask';
import { Settings } from './components/Settings';
import { AppProvider } from './contexts/AppContext';

function RootLayout() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        Component: Login,
      },
      {
        path: '/dashboard',
        Component: WorkerDashboard,
      },
      {
        path: '/supervisor',
        Component: SupervisorDashboard,
      },
      {
        path: '/shift-summary',
        Component: ShiftSummary,
      },
      {
        path: '/shift-history',
        Component: ShiftHistory,
      },
      {
        path: '/task-detail',
        Component: TaskDetail,
      },
      {
        path: '/create-task',
        Component: CreateTask,
      },
      {
        path: '/settings',
        Component: Settings,
      },
      {
        path: '*',
        Component: Login,
      },
    ],
  },
]);
