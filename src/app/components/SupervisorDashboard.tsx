import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getTasks, getUsers, getProjects, saveShift, saveTask, Shift, Task } from '../data/mockData';
import { format, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { ClipboardCheck, CheckCircle, XCircle, Clock, Users, ListTodo, LogOut, Filter, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function SupervisorDashboard() {
  const { currentUser, currentCompany, logout } = useApp();
  const navigate = useNavigate();
  const [pendingShifts, setPendingShifts] = useState<Shift[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadData();
  }, [currentUser]);

  const loadData = () => {
    const shifts = getShifts();
    const pending = shifts.filter(s => s.status === 'pending-approval');
    setPendingShifts(pending);

    const tasks = getTasks();
    setAllTasks(tasks);

    setUsers(getUsers());
    setProjects(getProjects());
  };

  const calculateHours = (shift: Shift) => {
    if (!shift.startTime || !shift.endTime) return '0.00';
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const minutes = differenceInMinutes(end, start);
    let hours = minutes / 60;
    if (shift.manualHours) {
      hours += shift.manualHours;
    }
    return hours.toFixed(2);
  };

  const handleApprove = (shiftId: string) => {
    const shifts = getShifts();
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      const updatedShift: Shift = {
        ...shift,
        status: 'approved',
        approvedBy: currentUser?.id,
        approvedAt: new Date().toISOString(),
      };
      saveShift(updatedShift);
      toast.success('Timesheet approved');
      loadData();
    }
  };

  const handleReject = (shiftId: string) => {
    const shifts = getShifts();
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      const updatedShift: Shift = {
        ...shift,
        status: 'rejected',
        rejectionReason: 'Needs review',
      };
      saveShift(updatedShift);
      toast.error('Timesheet rejected');
      loadData();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const filteredTasks = filterProject === 'all'
    ? allTasks
    : allTasks.filter(t => t.projectId === filterProject);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{currentCompany?.logo}</div>
            <div>
              <h1 className="text-xl font-bold">{currentUser?.name}</h1>
              <p className="text-sm text-purple-100">Supervisor - {currentCompany?.name}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-purple-500"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{pendingShifts.length}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {allTasks.filter(t => t.status !== 'completed').length}
                  </p>
                </div>
                <ListTodo className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Workers</p>
                  <p className="text-2xl font-bold text-green-600">
                    {users.filter(u => u.role === 'worker').length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timesheets" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="timesheets" className="text-base">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-base">
              <ListTodo className="mr-2 h-4 w-4" />
              Tasks
            </TabsTrigger>
          </TabsList>

          {/* Timesheets Tab */}
          <TabsContent value="timesheets" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Approval Requests</h2>
              <Badge variant="secondary">{pendingShifts.length} pending</Badge>
            </div>

            {pendingShifts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>No timesheets to approve</p>
                </CardContent>
              </Card>
            ) : (
              pendingShifts.map(shift => (
                <Card key={shift.id} className="shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{getUserName(shift.userId)}</h3>
                        <p className="text-sm text-muted-foreground">{getProjectName(shift.projectId)}</p>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        Pending
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-medium">
                          {format(new Date(shift.startTime), 'dd MMM yyyy', { locale: it })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="font-medium">
                          {format(new Date(shift.startTime), 'HH:mm', { locale: it })} -{' '}
                          {shift.endTime ? format(new Date(shift.endTime), 'HH:mm', { locale: it }) : '---'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                        <p className="text-xl font-bold text-blue-600">{calculateHours(shift)}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Check-in</p>
                        <p className="font-medium capitalize">{shift.checkInMethod}</p>
                      </div>
                    </div>

                    {shift.manualHours && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-3">
                        <p className="text-xs text-orange-800 font-medium mb-1">
                          Manual hours added: +{shift.manualHours}h
                        </p>
                        {shift.notes && (
                          <p className="text-sm text-orange-900">{shift.notes}</p>
                        )}
                      </div>
                    )}

                    {shift.notes && !shift.manualHours && (
                      <div className="p-3 bg-slate-50 border rounded-lg mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                        <p className="text-sm">{shift.notes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleApprove(shift.id)}
                        className="bg-green-600 hover:bg-green-700 h-12"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(shift.id)}
                        variant="destructive"
                        className="h-12"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="max-w-xs">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => navigate('/create-task')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </div>

            {filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                  <p>No tasks found</p>
                </CardContent>
              </Card>
            ) : (
              filteredTasks.map(task => (
                <Card key={task.id} className="shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{task.title}</h3>
                      <Badge
                        variant={task.status === 'completed' ? 'default' : 'secondary'}
                        className={
                          task.status === 'completed'
                            ? 'bg-green-600'
                            : task.status === 'in-progress'
                            ? 'bg-orange-500'
                            : 'bg-slate-500'
                        }
                      >
                        {task.status === 'completed'
                          ? 'Completed'
                          : task.status === 'in-progress'
                          ? 'In Progress'
                          : 'To Do'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>Assigned to: <strong>{getUserName(task.assignedTo)}</strong></span>
                      {task.dueDate && (
                        <span className="text-muted-foreground">
                          {format(new Date(task.dueDate), 'dd MMM', { locale: it })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
