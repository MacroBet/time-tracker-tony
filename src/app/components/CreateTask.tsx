import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getUsers, getProjects, saveTask, Task } from '../data/mockData';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function CreateTask() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    
    const allUsers = getUsers();
    const workers = allUsers.filter(u => u.role === 'worker');
    setUsers(workers);
    setProjects(getProjects());
  }, [currentUser]);

  const handleCreate = () => {
    if (!title || !description || !projectId || !assignedTo) {
      toast.error('Fill in all required fields');
      return;
    }

    const newTask: Task = {
      id: `t${Date.now()}`,
      title,
      description,
      projectId,
      assignedTo,
      createdBy: currentUser?.id || '',
      status: 'pending',
      dueDate: dueDate || undefined,
    };

    saveTask(newTask);
    toast.success('Task created successfully!');
    navigate('/supervisor');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/supervisor')}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-purple-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">New Task</h1>
            <p className="text-sm text-purple-100">Assign a new task to a worker</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
            <CardDescription>Enter the task information to assign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Install electrical system"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe in detail what needs to be done..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project/Site *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project" className="h-12 text-base">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id} className="text-base py-3">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.location}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="worker">Assign to *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="worker" className="h-12 text-base">
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id} className="text-base py-3">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleCreate}
          className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-700"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Task
        </Button>

        <Button
          onClick={() => navigate('/supervisor')}
          variant="ghost"
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
