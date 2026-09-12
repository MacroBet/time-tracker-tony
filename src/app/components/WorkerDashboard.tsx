import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { QrCode, Wifi, MapPin, Radio, Clock, LogOut, CheckCircle, AlertCircle, WifiOff } from 'lucide-react';
import { getShifts, getTasks, saveShift, Shift } from '../data/mockData';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import alternativeHeatLogo from 'figma:asset/c820a893380b6c8872f78925659e91dcc396fea5.png';

export function WorkerDashboard() {
  const { currentUser, currentCompany, projects, logout, isOnline, lastSyncTime } = useApp();
  const navigate = useNavigate();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadData();
  }, [currentUser]);

  const loadData = () => {
    const shifts = getShifts();
    const active = shifts.find(s => s.userId === currentUser?.id && s.status === 'active');
    setActiveShift(active || null);

    const tasks = getTasks();
    const userTasks = tasks.filter(t => t.assignedTo === currentUser?.id);
    setMyTasks(userTasks);
  };

  const handleCheckIn = (method: 'qr' | 'wifi' | 'gps' | 'nfc') => {
    if (!currentUser || !projects.length) return;

    const newShift: Shift = {
      id: `s${Date.now()}`,
      userId: currentUser.id,
      projectId: projects[0].id, // In real app, would detect/select project
      startTime: new Date().toISOString(),
      checkInMethod: method,
      status: 'active',
      location: projects[0].location,
    };

    saveShift(newShift);
    setActiveShift(newShift);
  };

  const handleCheckOut = () => {
    if (!activeShift) return;

    const updatedShift: Shift = {
      ...activeShift,
      endTime: new Date().toISOString(),
      status: 'pending-approval',
    };

    saveShift(updatedShift);
    setActiveShift(null);
    navigate('/shift-summary', { state: { shiftId: updatedShift.id } });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const calculateHours = () => {
    if (!activeShift?.startTime) return '0h 00m';
    const start = new Date(activeShift.startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {currentCompany?.id === 'c1' ? (
              <img src={alternativeHeatLogo} alt="alternativeHEAT" className="h-12 w-auto object-contain" />
            ) : (
              <div className="text-3xl">{currentCompany?.logo}</div>
            )}
            <div>
              <h1 className="text-xl font-bold">{currentUser?.name}</h1>
              <p className="text-sm text-blue-100">
                {currentCompany?.id === 'c1' ? 'alternativeHEAT' : currentCompany?.name}
              </p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-blue-500"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Sync Status */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline - Data saved locally</span>
              </>
            )}
          </div>
          {lastSyncTime && (
            <span className="text-xs text-blue-100">
              Last sync: {format(lastSyncTime, 'HH:mm', { locale: it })}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Active Shift Card */}
        {activeShift ? (
          <Card className="border-green-500 border-2 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600 animate-pulse" />
                  Active Shift
                </CardTitle>
                <Badge variant="default" className="bg-green-600">In Progress</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start Time</p>
                  <p className="font-semibold">
                    {format(new Date(activeShift.startTime), 'HH:mm', { locale: it })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hours Worked</p>
                  <p className="font-semibold text-lg text-green-600">{calculateHours()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Site</p>
                <p className="font-medium">{activeShift.location}</p>
              </div>
              <Button
                onClick={handleCheckOut}
                className="w-full h-14 text-lg bg-red-600 hover:bg-red-700"
                size="lg"
              >
                End Shift
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Site Check-in</CardTitle>
              <CardDescription>Select check-in method</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleCheckIn('qr')}
                variant="outline"
                className="h-24 flex flex-col gap-2 text-base hover:bg-blue-50 hover:border-blue-500"
              >
                <QrCode className="h-8 w-8 text-blue-600" />
                <span>QR Code</span>
              </Button>
              <Button
                onClick={() => handleCheckIn('gps')}
                variant="outline"
                className="h-24 flex flex-col gap-2 text-base hover:bg-green-50 hover:border-green-500"
              >
                <MapPin className="h-8 w-8 text-green-600" />
                <span>GPS</span>
              </Button>
              <Button
                onClick={() => handleCheckIn('wifi')}
                variant="outline"
                className="h-24 flex flex-col gap-2 text-base hover:bg-purple-50 hover:border-purple-500"
              >
                <Wifi className="h-8 w-8 text-purple-600" />
                <span>Wi-Fi</span>
              </Button>
              <Button
                onClick={() => handleCheckIn('nfc')}
                variant="outline"
                className="h-24 flex flex-col gap-2 text-base hover:bg-orange-50 hover:border-orange-500"
              >
                <Radio className="h-8 w-8 text-orange-600" />
                <span>NFC</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tasks */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">My Tasks</CardTitle>
            <CardDescription>Tasks assigned for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                No tasks assigned
              </p>
            ) : (
              myTasks.map(task => (
                <div
                  key={task.id}
                  className="p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/task-detail', { state: { taskId: task.id } })}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium">{task.title}</h3>
                    {task.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : task.status === 'in-progress' ? (
                      <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 border-2 border-slate-300 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <Badge
                      variant={
                        task.status === 'completed'
                          ? 'default'
                          : task.status === 'in-progress'
                          ? 'secondary'
                          : 'outline'
                      }
                      className={
                        task.status === 'completed'
                          ? 'bg-green-600'
                          : task.status === 'in-progress'
                          ? 'bg-orange-500'
                          : ''
                      }
                    >
                      {task.status === 'completed'
                        ? 'Completed'
                        : task.status === 'in-progress'
                        ? 'In Progress'
                        : 'To Do'}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-muted-foreground">
                        Due: {format(new Date(task.dueDate), 'dd MMM', { locale: it })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-16"
            onClick={() => navigate('/shift-history')}
          >
            <Clock className="mr-2 h-5 w-5" />
            Shift History
          </Button>
          <Button
            variant="outline"
            className="h-16"
            onClick={() => navigate('/settings')}
          >
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}