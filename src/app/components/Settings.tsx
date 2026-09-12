import React from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ArrowLeft, User, Building2, Bell, Shield, Database, Smartphone, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export function Settings() {
  const { currentUser, currentCompany, isOnline, lastSyncTime, logout } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-slate-300">Profile and preferences</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* User Profile */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="text-lg font-semibold">{currentUser?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p>{currentUser?.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <div className="mt-1">
                <Badge variant="secondary" className="capitalize">
                  {currentUser?.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-4xl">{currentCompany?.logo}</div>
              <div>
                <p className="font-semibold text-lg">{currentCompany?.name}</p>
                <p className="text-sm text-muted-foreground">ID: {currentCompany?.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Status
            </CardTitle>
            <CardDescription>
              Data is saved locally and synced when available
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Wifi className={`h-5 w-5 ${isOnline ? 'text-green-600' : 'text-red-600'}`} />
                <span className="font-medium">Connection</span>
              </div>
              <Badge variant={isOnline ? 'default' : 'destructive'} className={isOnline ? 'bg-green-600' : ''}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            {lastSyncTime && (
              <div className="text-sm text-muted-foreground">
                Last sync: {format(lastSyncTime, 'dd MMM yyyy HH:mm', { locale: it })}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Offline mode active - data saved locally</span>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="task-notifications">Task Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications for new tasks</p>
              </div>
              <Switch id="task-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="shift-notifications">Shift Notifications</Label>
                <p className="text-sm text-muted-foreground">Check-in/out reminders</p>
              </div>
              <Switch id="shift-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="approval-notifications">Approval Status</Label>
                <p className="text-sm text-muted-foreground">Updates on approved timesheets</p>
              </div>
              <Switch id="approval-notifications" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy and Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Demo Mode:</strong> This is a demo application. All data is saved
                locally in your browser (localStorage) and is not transmitted to external servers.
              </p>
            </div>
            <Button variant="outline" className="w-full">
              View Saved Data
            </Button>
            <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
              Clear All Local Data
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card className="shadow-lg border-red-200">
          <CardContent className="pt-6">
            <Button
              onClick={() => {
                logout();
                navigate('/');
              }}
              variant="destructive"
              className="w-full h-12"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>TimeTrack Pro v1.0.0</p>
          <p className="text-xs mt-1">© 2026 - Time tracking system for construction sites</p>
        </div>
      </div>
    </div>
  );
}
