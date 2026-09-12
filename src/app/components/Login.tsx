import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Building2, LogIn } from 'lucide-react';
import alternativeHeatLogo from 'figma:asset/c820a893380b6c8872f78925659e91dcc396fea5.png';

export function Login() {
  const { companies, users, login } = useApp();
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const navigate = useNavigate();

  const filteredUsers = selectedCompany
    ? users.filter(u => u.companyId === selectedCompany)
    : [];

  const handleLogin = () => {
    if (selectedUser) {
      login(selectedUser);
      const user = users.find(u => u.id === selectedUser);
      if (user?.role === 'supervisor' || user?.role === 'manager' || user?.role === 'admin') {
        navigate('/supervisor');
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center">
            <Building2 className="w-12 h-12 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl">TimeTrack Pro</CardTitle>
            <CardDescription className="text-base mt-2">
              Time tracking and task management for construction teams
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Company</label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Choose your company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id} className="text-base py-3">
                    <div className="flex items-center gap-3">
                      {company.id === 'c1' ? (
                        <img src={alternativeHeatLogo} alt="alternativeHEAT" className="h-8 w-auto object-contain" />
                      ) : company.logo.startsWith('figma:asset') ? (
                        <img src={company.logo} alt={company.name} className="h-8 w-auto object-contain" />
                      ) : (
                        <span className="text-2xl">{company.logo}</span>
                      )}
                      <span>{company.id === 'c1' ? 'alternativeHEAT' : company.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCompany && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-14 text-base">
                  <SelectValue placeholder="Choose your name" />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map(user => (
                    <SelectItem key={user.id} value={user.id} className="text-base py-3">
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={!selectedUser}
            className="w-full h-14 text-lg"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign In
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Demo Mode - Data saved in localStorage</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}