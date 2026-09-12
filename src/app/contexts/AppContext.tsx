import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Company, Project, Shift, Task, initializeMockData, getCompanies, getUsers, getProjects, getShifts, getTasks } from '../data/mockData';

interface AppContextType {
  currentUser: User | null;
  currentCompany: Company | null;
  companies: Company[];
  users: User[];
  projects: Project[];
  shifts: Shift[];
  tasks: Task[];
  login: (userId: string) => void;
  logout: () => void;
  refreshData: () => void;
  isOnline: boolean;
  lastSyncTime: Date | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initialize mock data on first load
    initializeMockData();
    loadData();

    // Load saved user session
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
      const user = getUsers().find(u => u.id === savedUserId);
      if (user) {
        setCurrentUser(user);
        const company = getCompanies().find(c => c.id === user.companyId);
        setCurrentCompany(company || null);
      }
    }

    // Online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = () => {
    setCompanies(getCompanies());
    setUsers(getUsers());
    setProjects(getProjects());
    setShifts(getShifts());
    setTasks(getTasks());
  };

  const refreshData = () => {
    loadData();
  };

  const syncData = () => {
    // Simulate sync - in real app would sync with backend
    setLastSyncTime(new Date());
    loadData();
  };

  const login = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      const company = companies.find(c => c.id === user.companyId);
      setCurrentCompany(company || null);
      localStorage.setItem('currentUserId', userId);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentCompany(null);
    localStorage.removeItem('currentUserId');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentCompany,
        companies,
        users,
        projects,
        shifts,
        tasks,
        login,
        logout,
        refreshData,
        isOnline,
        lastSyncTime,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
