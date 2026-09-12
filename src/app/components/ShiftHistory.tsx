import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getShifts, getProjects, getTasks, Shift, Task } from '../data/mockData';
import { format, differenceInMinutes, startOfWeek, endOfWeek, isToday, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, Clock, MapPin, Calendar, TrendingUp, CheckCircle, ListTodo } from 'lucide-react';

export function ShiftHistory() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    const allShifts = getShifts();
    const userShifts = allShifts
      .filter(s => s.userId === currentUser.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    setShifts(userShifts);

    const allTasks = getTasks();
    const userTasks = allTasks
      .filter(t => t.assignedTo === currentUser.id)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    setTasks(userTasks);

    setProjects(getProjects());
  }, [currentUser]);

  const calculateHours = (shift: Shift) => {
    if (!shift.startTime || !shift.endTime) return 0;
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const minutes = differenceInMinutes(end, start);
    let hours = minutes / 60;
    if (shift.manualHours) {
      hours += shift.manualHours;
    }
    return hours;
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'pending-approval':
        return <Badge className="bg-orange-500">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'active':
        return <Badge className="bg-blue-600">Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter shifts
  const todayShifts = shifts.filter(s => isToday(new Date(s.startTime)));
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekShifts = shifts.filter(s => 
    isWithinInterval(new Date(s.startTime), { start: weekStart, end: weekEnd })
  );

  // Filter tasks
  const todayTasks = tasks.filter(t => {
    if (!t.completedAt) return false;
    return isToday(new Date(t.completedAt));
  });
  const weekTasks = tasks.filter(t => {
    if (!t.completedAt) return false;
    return isWithinInterval(new Date(t.completedAt), { start: weekStart, end: weekEnd });
  });

  // Calculate stats
  const todayHours = todayShifts.reduce((sum, s) => sum + calculateHours(s), 0);
  const weekHours = weekShifts.reduce((sum, s) => sum + calculateHours(s), 0);
  const totalHours = shifts.reduce((sum, s) => sum + calculateHours(s), 0);

  const renderShiftCard = (shift: Shift) => (
    <Card key={shift.id} className="shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{getProjectName(shift.projectId)}</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(shift.startTime), 'dd MMMM yyyy', { locale: it })}
            </p>
          </div>
          {getStatusBadge(shift.status)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Time</p>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(shift.startTime), 'HH:mm', { locale: it })}
                {shift.endTime && ` - ${format(new Date(shift.endTime), 'HH:mm', { locale: it })}`}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
            <p className="text-xl font-bold text-blue-600">{calculateHours(shift).toFixed(2)}h</p>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-sm">{shift.location}</p>
        </div>

        {shift.manualHours && (
          <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
            <span className="font-medium text-orange-800">
              Manual hours: +{shift.manualHours}h
            </span>
          </div>
        )}

        {shift.notes && (
          <div className="mt-2 p-2 bg-slate-50 border rounded text-sm">
            <p className="text-xs text-muted-foreground mb-1">Notes:</p>
            <p>{shift.notes}</p>
          </div>
        )}

        {shift.rejectionReason && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
            <p className="text-xs text-red-800 font-medium mb-1">Rejection reason:</p>
            <p className="text-red-900">{shift.rejectionReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTaskCard = (task: Task) => (
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{getProjectName(task.projectId)}</span>
          {task.completedAt && (
            <span>{format(new Date(task.completedAt), 'dd MMM HH:mm', { locale: it })}</span>
          )}
        </div>
        {task.notes && (
          <div className="mt-2 p-2 bg-slate-50 border rounded text-sm">
            <p className="text-xs text-muted-foreground mb-1">Notes:</p>
            <p>{task.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Work History</h1>
            <p className="text-sm text-blue-100">Shifts and tasks overview</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>

          {/* TODAY */}
          <TabsContent value="today" className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Shifts</p>
                      <p className="text-2xl font-bold text-blue-600">{todayShifts.length}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Hours</p>
                      <p className="text-2xl font-bold text-green-600">{todayHours.toFixed(1)}h</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today's Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayShifts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No shifts today</p>
                ) : (
                  todayShifts.map(renderShiftCard)
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  Today's Completed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No tasks completed today</p>
                ) : (
                  todayTasks.map(renderTaskCard)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WEEK */}
          <TabsContent value="week" className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Shifts</p>
                    <p className="text-2xl font-bold text-blue-600">{weekShifts.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold text-green-600">{weekHours.toFixed(1)}h</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tasks Done</p>
                    <p className="text-2xl font-bold text-purple-600">{weekTasks.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Week Period</p>
                    <p className="text-xs text-blue-700">
                      {format(weekStart, 'dd MMM', { locale: it })} - {format(weekEnd, 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            {/* Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weekShifts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No shifts this week</p>
                ) : (
                  weekShifts.map(renderShiftCard)
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Weekly Completed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weekTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No tasks completed this week</p>
                ) : (
                  weekTasks.map(renderTaskCard)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL TIME */}
          <TabsContent value="all" className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Shifts</p>
                    <p className="text-2xl font-bold text-blue-600">{shifts.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold text-green-600">{totalHours.toFixed(1)}h</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">All Tasks</p>
                    <p className="text-2xl font-bold text-purple-600">{tasks.filter(t => t.status === 'completed').length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* All Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">All Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shifts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No shifts recorded</p>
                ) : (
                  shifts.map(renderShiftCard)
                )}
              </CardContent>
            </Card>

            {/* All Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  All Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No tasks found</p>
                ) : (
                  tasks.map(renderTaskCard)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
