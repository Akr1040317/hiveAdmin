'use client';

import React, { useState } from 'react';
import { X, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface AttendeeSelectorProps {
  attendees: string[];
  teamMembers: string[];
  onChange: (attendees: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function AttendeeSelector({
  attendees = [],
  teamMembers = [],
  onChange,
  placeholder = 'Add attendee email...',
  className,
}: AttendeeSelectorProps) {
  const [emailInput, setEmailInput] = useState('');
  const [selectedTeamMember, setSelectedTeamMember] = useState('');

  const handleAddEmail = () => {
    const email = emailInput.trim();
    if (email && email.includes('@') && !attendees.includes(email)) {
      onChange([...attendees, email]);
      setEmailInput('');
    }
  };

  const handleAddTeamMember = () => {
    if (selectedTeamMember && !attendees.includes(selectedTeamMember)) {
      onChange([...attendees, selectedTeamMember]);
      setSelectedTeamMember('');
    }
  };

  const handleRemoveAttendee = (email: string) => {
    onChange(attendees.filter(a => a !== email));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Attendees
        </label>
        
        {/* Selected attendees display */}
        {attendees.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attendees.map((email) => (
              <Badge
                key={email}
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1.5"
              >
                <User className="w-3 h-3" />
                <span>{email}</span>
                <button
                  onClick={() => handleRemoveAttendee(email)}
                  className="ml-1 hover:text-red-400 transition-colors"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Team member selector */}
        {teamMembers.length > 0 && (
          <div className="flex gap-2">
            <Select
              value={selectedTeamMember}
              onChange={(e) => setSelectedTeamMember(e.target.value)}
              className="flex-1"
            >
              <option value="" disabled>Select team member...</option>
              {teamMembers
                .filter(email => !attendees.includes(email))
                .map((email) => (
                  <option key={email} value={email}>
                    {email.split('@')[0]} ({email})
                  </option>
                ))}
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddTeamMember}
              disabled={!selectedTeamMember}
              className="px-3"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Free text email input */}
        <div className="flex gap-2">
          <Input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddEmail}
            disabled={!emailInput.trim() || !emailInput.includes('@') || attendees.includes(emailInput.trim())}
            className="px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
