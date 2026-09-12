import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { getShifts, saveShift, Shift } from '../data/mockData';
import { format, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, MapPin, CheckCircle, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export function ShiftSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const shiftId = location.state?.shiftId;
  const [shift, setShift] = useState<Shift | null>(null);
  const [manualHours, setManualHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!shiftId) {
      navigate('/dashboard');
      return;
    }

    const shifts = getShifts();
    const foundShift = shifts.find(s => s.id === shiftId);
    if (foundShift) {
      setShift(foundShift);
      setManualHours(foundShift.manualHours?.toString() || '');
      setNotes(foundShift.notes || '');
    }
  }, [shiftId]);

  const calculateTotalHours = () => {
    if (!shift?.startTime || !shift?.endTime) return 0;
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const minutes = differenceInMinutes(end, start);
    return (minutes / 60).toFixed(2);
  };

  const getFinalHours = () => {
    const base = parseFloat(calculateTotalHours());
    const manual = parseFloat(manualHours) || 0;
    return (base + manual).toFixed(2);
  };

  const handleSubmit = () => {
    if (!shift) return;

    const updatedShift: Shift = {
      ...shift,
      manualHours: parseFloat(manualHours) || undefined,
      notes,
      status: 'pending-approval',
    };

    saveShift(updatedShift);
    toast.success('Timesheet submitted for approval');
    navigate('/dashboard');
  };

  if (!shift) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <h1 className="text-xl font-bold">Shift Summary</h1>
        <p className="text-sm text-blue-100">Review and confirm your hours</p>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Shift Details Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Shift Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Start</Label>
                <p className="text-lg font-semibold">
                  {format(new Date(shift.startTime), 'HH:mm', { locale: it })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(shift.startTime), 'dd MMMM yyyy', { locale: it })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">End</Label>
                <p className="text-lg font-semibold">
                  {shift.endTime
                    ? format(new Date(shift.endTime), 'HH:mm', { locale: it })
                    : 'In progress'}
                </p>
                {shift.endTime && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(shift.endTime), 'dd MMMM yyyy', { locale: it })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-muted-foreground">Site</Label>
                <p className="font-medium">{shift.location}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label>Automatic Hours</Label>
                <p className="text-xl font-bold text-blue-600">{calculateTotalHours()}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Adjustments */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-orange-600" />
              Manual Adjustments
            </CardTitle>
            <CardDescription>
              Add extra hours or corrections (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-hours">Additional Hours</Label>
              <Input
                id="manual-hours"
                type="number"
                step="0.5"
                placeholder="0.0"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                className="h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">
                Example: 1.5 for one and a half hours extra
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes and Reasons</Label>
              <Textarea
                id="notes"
                placeholder="Explain why you're adding extra hours or any issues during the shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="text-base"
              />
            </div>

            {manualHours && parseFloat(manualHours) !== 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 mb-1">Total with adjustments:</p>
                <p className="text-2xl font-bold text-orange-600">{getFinalHours()}h</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Card className="shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold">Submit for Approval</h3>
                <p className="text-sm text-muted-foreground">
                  Your supervisor will receive the approval request
                </p>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
              size="lg"
            >
              Confirm and Submit
            </Button>
          </CardContent>
        </Card>

        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
