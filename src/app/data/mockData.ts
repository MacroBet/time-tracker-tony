export interface Company {
  id: string;
  name: string;
  logo: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'worker' | 'supervisor' | 'manager' | 'admin';
  companyId: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  companyId: string;
  qrCode?: string;
  wifiSSID?: string;
  gpsLat?: number;
  gpsLng?: number;
  nfcId?: string;
}

export interface Shift {
  id: string;
  userId: string;
  projectId: string;
  startTime: string;
  endTime?: string;
  checkInMethod: 'qr' | 'wifi' | 'gps' | 'nfc' | 'manual';
  status: 'active' | 'completed' | 'pending-approval' | 'approved' | 'rejected';
  manualHours?: number;
  notes?: string;
  location?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo: string;
  createdBy: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate?: string;
  notes?: string;
  photos?: string[];
  completedAt?: string;
  createdAt?: string;
}

export const mockCompanies: Company[] = [
  { id: 'c1', name: 'alternativeHEAT', logo: 'figma:asset/c820a893380b6c8872f78925659e91dcc396fea5.png' },
  { id: 'c2', name: 'Elite Plumbing Services', logo: '🔧' },
  { id: 'c3', name: 'Premier Electrical', logo: '⚡' },
  { id: 'c4', name: 'ProMech HVAC', logo: '🌡️' },
];

export const mockUsers: User[] = [
  { id: 'u1', name: 'Marco Rossi', email: 'marco@buildcorp.com', role: 'worker', companyId: 'c1' },
  { id: 'u2', name: 'Luigi Verdi', email: 'luigi@eliteplumbing.com', role: 'worker', companyId: 'c2' },
  { id: 'u3', name: 'Anna Bianchi', email: 'anna@buildcorp.com', role: 'supervisor', companyId: 'c1' },
  { id: 'u4', name: 'Paolo Neri', email: 'paolo@buildcorp.com', role: 'manager', companyId: 'c1' },
  { id: 'u5', name: 'Sofia Romano', email: 'sofia@eliteplumbing.com', role: 'supervisor', companyId: 'c2' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Residential Tower A',
    location: 'Via Roma 123, Milano',
    companyId: 'c1',
    qrCode: 'QR-TOWER-A-001',
    wifiSSID: 'BuildSite-TowerA',
    gpsLat: 45.4642,
    gpsLng: 9.1900,
    nfcId: 'NFC-TOWER-A',
  },
  {
    id: 'p2',
    name: 'Commercial Complex B',
    location: 'Corso Buenos Aires 45, Milano',
    companyId: 'c2',
    qrCode: 'QR-COMPLEX-B-002',
    wifiSSID: 'BuildSite-ComplexB',
    gpsLat: 45.4777,
    gpsLng: 9.2060,
    nfcId: 'NFC-COMPLEX-B',
  },
  {
    id: 'p3',
    name: 'Office Renovation',
    location: 'Via Torino 88, Milano',
    companyId: 'c1',
    qrCode: 'QR-OFFICE-003',
    wifiSSID: 'BuildSite-Office',
    gpsLat: 45.4654,
    gpsLng: 9.1859,
    nfcId: 'NFC-OFFICE',
  },
];

export const mockShifts: Shift[] = [
  // Today's shifts
  {
    id: 's1',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-02-12T08:00:00',
    endTime: '2026-02-12T17:00:00',
    checkInMethod: 'qr',
    status: 'pending-approval',
    location: 'Via Roma 123, Milano',
    notes: 'Completed foundation work',
  },
  {
    id: 's2',
    userId: 'u2',
    projectId: 'p2',
    startTime: '2026-02-12T07:30:00',
    endTime: '2026-02-12T16:30:00',
    checkInMethod: 'gps',
    status: 'pending-approval',
    location: 'Corso Buenos Aires 45, Milano',
    manualHours: 1,
    notes: 'Added 1 hour for emergency pipe fix',
  },
  // This week (Feb 10-16)
  {
    id: 's3',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-02-11T08:00:00',
    endTime: '2026-02-11T17:30:00',
    checkInMethod: 'wifi',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-11T18:00:00',
  },
  {
    id: 's4',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-02-10T08:00:00',
    endTime: '2026-02-10T17:00:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-10T18:00:00',
  },
  {
    id: 's5',
    userId: 'u1',
    projectId: 'p3',
    startTime: '2026-02-09T09:00:00',
    endTime: '2026-02-09T18:00:00',
    checkInMethod: 'wifi',
    status: 'approved',
    location: 'Via Torino 88, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-09T19:00:00',
    manualHours: 0.5,
  },
  {
    id: 's6',
    userId: 'u2',
    projectId: 'p2',
    startTime: '2026-02-11T07:00:00',
    endTime: '2026-02-11T15:30:00',
    checkInMethod: 'gps',
    status: 'approved',
    location: 'Corso Buenos Aires 45, Milano',
    approvedBy: 'u5',
    approvedAt: '2026-02-11T16:00:00',
  },
  // Previous weeks
  {
    id: 's7',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-02-05T08:00:00',
    endTime: '2026-02-05T17:00:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-05T18:00:00',
  },
  {
    id: 's8',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-02-04T08:00:00',
    endTime: '2026-02-04T16:30:00',
    checkInMethod: 'wifi',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-04T17:00:00',
  },
  {
    id: 's9',
    userId: 'u1',
    projectId: 'p3',
    startTime: '2026-02-03T08:30:00',
    endTime: '2026-02-03T17:30:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Torino 88, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-02-03T18:00:00',
  },
  {
    id: 's10',
    userId: 'u2',
    projectId: 'p2',
    startTime: '2026-02-06T07:30:00',
    endTime: '2026-02-06T16:00:00',
    checkInMethod: 'gps',
    status: 'approved',
    location: 'Corso Buenos Aires 45, Milano',
    approvedBy: 'u5',
    approvedAt: '2026-02-06T17:00:00',
  },
  // January shifts
  {
    id: 's11',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-01-28T08:00:00',
    endTime: '2026-01-28T17:00:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-01-28T18:00:00',
  },
  {
    id: 's12',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-01-27T08:00:00',
    endTime: '2026-01-27T17:30:00',
    checkInMethod: 'wifi',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-01-27T18:00:00',
  },
  {
    id: 's13',
    userId: 'u1',
    projectId: 'p3',
    startTime: '2026-01-26T09:00:00',
    endTime: '2026-01-26T18:00:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Torino 88, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-01-26T19:00:00',
  },
  {
    id: 's14',
    userId: 'u2',
    projectId: 'p2',
    startTime: '2026-01-30T07:30:00',
    endTime: '2026-01-30T16:30:00',
    checkInMethod: 'gps',
    status: 'rejected',
    location: 'Corso Buenos Aires 45, Milano',
    rejectionReason: 'GPS coordinates do not match project location',
  },
  {
    id: 's15',
    userId: 'u1',
    projectId: 'p1',
    startTime: '2026-01-22T08:00:00',
    endTime: '2026-01-22T17:00:00',
    checkInMethod: 'qr',
    status: 'approved',
    location: 'Via Roma 123, Milano',
    approvedBy: 'u3',
    approvedAt: '2026-01-22T18:00:00',
  },
];

export const mockTasks: Task[] = [
  // Today's tasks
  {
    id: 't1',
    title: 'Install electrical wiring - Floor 3',
    description: 'Complete electrical installation for third floor residential units',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'in-progress',
    dueDate: '2026-02-15',
    createdAt: '2026-02-12T09:00:00',
  },
  {
    id: 't2',
    title: 'Fix bathroom plumbing leak',
    description: 'Emergency repair for bathroom leak in unit 204',
    projectId: 'p2',
    assignedTo: 'u2',
    createdBy: 'u5',
    status: 'completed',
    dueDate: '2026-02-12',
    completedAt: '2026-02-12T15:30:00',
    createdAt: '2026-02-12T08:00:00',
    notes: 'Replaced damaged pipe section',
  },
  // This week
  {
    id: 't3',
    title: 'Safety inspection preparation',
    description: 'Prepare all areas for safety inspection next week',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-02-14',
    completedAt: '2026-02-11T16:45:00',
    createdAt: '2026-02-08T10:00:00',
    notes: 'All safety equipment verified and in place',
  },
  {
    id: 't4',
    title: 'Install HVAC system - Floor 2',
    description: 'Complete HVAC installation for second floor units',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-02-10',
    completedAt: '2026-02-10T17:30:00',
    createdAt: '2026-02-08T11:00:00',
  },
  {
    id: 't5',
    title: 'Paint exterior walls',
    description: 'Apply first coat of paint to building exterior',
    projectId: 'p3',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-02-09',
    completedAt: '2026-02-09T18:00:00',
    createdAt: '2026-02-07T09:00:00',
    notes: 'Weather conditions perfect for painting',
  },
  // Previous weeks
  {
    id: 't6',
    title: 'Repair kitchen sink drainage',
    description: 'Fix slow drainage in unit 301 kitchen',
    projectId: 'p2',
    assignedTo: 'u2',
    createdBy: 'u5',
    status: 'completed',
    dueDate: '2026-02-06',
    completedAt: '2026-02-06T14:20:00',
    createdAt: '2026-02-05T08:00:00',
  },
  {
    id: 't7',
    title: 'Install window frames - Floor 1',
    description: 'Install all window frames on first floor',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-02-05',
    completedAt: '2026-02-05T17:00:00',
    createdAt: '2026-02-03T10:00:00',
  },
  {
    id: 't8',
    title: 'Concrete pouring - Foundation',
    description: 'Pour concrete for building foundation',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-02-04',
    completedAt: '2026-02-04T16:30:00',
    createdAt: '2026-02-01T09:00:00',
    notes: 'Foundation curing in progress',
  },
  {
    id: 't9',
    title: 'Install water heater - Unit 205',
    description: 'Replace old water heater with new unit',
    projectId: 'p2',
    assignedTo: 'u2',
    createdBy: 'u5',
    status: 'completed',
    dueDate: '2026-02-03',
    completedAt: '2026-02-03T15:00:00',
    createdAt: '2026-02-01T08:00:00',
  },
  // January tasks
  {
    id: 't10',
    title: 'Demolition - Interior walls',
    description: 'Remove non-load bearing walls as per blueprint',
    projectId: 'p3',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-01-30',
    completedAt: '2026-01-30T17:00:00',
    createdAt: '2026-01-27T09:00:00',
  },
  {
    id: 't11',
    title: 'Electrical panel upgrade',
    description: 'Upgrade main electrical panel for increased capacity',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-01-28',
    completedAt: '2026-01-28T16:00:00',
    createdAt: '2026-01-25T10:00:00',
    notes: 'Inspection passed',
  },
  {
    id: 't12',
    title: 'Flooring installation - Lobby',
    description: 'Install marble flooring in main lobby area',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-01-27',
    completedAt: '2026-01-27T18:00:00',
    createdAt: '2026-01-23T09:00:00',
  },
  {
    id: 't13',
    title: 'Plumbing inspection',
    description: 'Complete pre-inspection plumbing check',
    projectId: 'p2',
    assignedTo: 'u2',
    createdBy: 'u5',
    status: 'completed',
    dueDate: '2026-01-26',
    completedAt: '2026-01-26T14:00:00',
    createdAt: '2026-01-23T08:00:00',
  },
  {
    id: 't14',
    title: 'Install fire alarm system',
    description: 'Install fire detection and alarm system throughout building',
    projectId: 'p1',
    assignedTo: 'u1',
    createdBy: 'u3',
    status: 'completed',
    dueDate: '2026-01-25',
    completedAt: '2026-01-25T17:30:00',
    createdAt: '2026-01-20T09:00:00',
  },
  {
    id: 't15',
    title: 'Repair gas line leak',
    description: 'Emergency gas line repair in basement',
    projectId: 'p2',
    assignedTo: 'u2',
    createdBy: 'u5',
    status: 'completed',
    dueDate: '2026-01-24',
    completedAt: '2026-01-24T13:00:00',
    createdAt: '2026-01-24T08:00:00',
    notes: 'Emergency repair - completed within 5 hours',
  },
];

// Initialize localStorage with mock data if empty
export function initializeMockData() {
  if (!localStorage.getItem('companies')) {
    localStorage.setItem('companies', JSON.stringify(mockCompanies));
  }
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify(mockUsers));
  }
  if (!localStorage.getItem('projects')) {
    localStorage.setItem('projects', JSON.stringify(mockProjects));
  }
  if (!localStorage.getItem('shifts')) {
    localStorage.setItem('shifts', JSON.stringify(mockShifts));
  }
  if (!localStorage.getItem('tasks')) {
    localStorage.setItem('tasks', JSON.stringify(mockTasks));
  }
}

// Helper functions for localStorage operations
export function getCompanies(): Company[] {
  return JSON.parse(localStorage.getItem('companies') || '[]');
}

export function getUsers(): User[] {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

export function getProjects(): Project[] {
  return JSON.parse(localStorage.getItem('projects') || '[]');
}

export function getShifts(): Shift[] {
  return JSON.parse(localStorage.getItem('shifts') || '[]');
}

export function getTasks(): Task[] {
  return JSON.parse(localStorage.getItem('tasks') || '[]');
}

export function saveShift(shift: Shift) {
  const shifts = getShifts();
  const index = shifts.findIndex(s => s.id === shift.id);
  if (index >= 0) {
    shifts[index] = shift;
  } else {
    shifts.push(shift);
  }
  localStorage.setItem('shifts', JSON.stringify(shifts));
}

export function saveTask(task: Task) {
  const tasks = getTasks();
  const index = tasks.findIndex(t => t.id === task.id);
  if (index >= 0) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }
  localStorage.setItem('tasks', JSON.stringify(tasks));
}