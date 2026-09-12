import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { getTasks, getUsers, getProjects, saveTask, Task } from '../data/mockData';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, CheckCircle, MapPin, User, Calendar, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

export function TaskDetail() {
  const { currentUser, refreshData } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const taskId = location.state?.taskId;
  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    
    if (!taskId) {
      navigate('/dashboard');
      return;
    }

    loadTaskData();
  }, []);

  const loadTaskData = () => {
    setIsLoading(true);
    const tasks = getTasks();
    const foundTask = tasks.find(t => t.id === taskId);
    
    if (foundTask) {
      setTask(foundTask);
      setNotes(foundTask.notes || '');
    } else {
      navigate('/dashboard');
      return;
    }

    setUsers(getUsers());
    setProjects(getProjects());
    setIsLoading(false);
  };

  const handleStartTask = () => {
    if (!task) return;
    const updatedTask: Task = {
      ...task,
      status: 'in-progress',
    };
    saveTask(updatedTask);
    setTask(updatedTask);
    refreshData();
    toast.success('Task started');
  };

  const handleCompleteTask = () => {
    if (!task) return;
    const updatedTask: Task = {
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes,
    };
    saveTask(updatedTask);
    refreshData();
    toast.success('Task completed!');
    navigate('/dashboard');
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const getProjectInfo = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  const project = getProjectInfo(task.projectId);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Task Detail</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-xl pr-4">{task.title}</CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground">{task.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <p className="font-medium">{getUserName(task.assignedTo)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">Created by</p>
                  <p className="font-medium">{getUserName(task.createdBy)}</p>
                </div>
              </div>
            </div>

            {project && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">Site</p>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.location}</p>
                </div>
              </div>
            )}

            {task.dueDate && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {format(new Date(task.dueDate), 'dd MMMM yyyy', { locale: it })}
                  </p>
                </div>
              </div>
            )}

            {task.completedAt && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed on</p>
                  <p className="font-medium text-green-600">
                    {format(new Date(task.completedAt), 'dd MMMM yyyy HH:mm', { locale: it })}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {task.status !== 'completed' && task.assignedTo === currentUser?.id && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Notes and Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Add progress notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe work status, issues encountered, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="text-base"
                />
              </div>

              <div className="space-y-3">
                {task.status === 'pending' && (
                  <Button
                    onClick={handleStartTask}
                    className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    <PlayCircle className="mr-2 h-5 w-5" />
                    Start Task
                  </Button>
                )}

                {task.status === 'in-progress' && (
                  <Button
                    onClick={handleCompleteTask}
                    className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Mark as Completed
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {task.notes && (
          <Card className="shadow-lg bg-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Previous Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{task.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}