'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GoalProgressBar } from './GoalProgressBar';
import { Goal } from '@/app/actions/goals';
import { cn } from '@/lib/utils';
import { Check, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { CATEGORY_LABELS } from '@/lib/goal-templates';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onUpdateProgress?: (goalId: string, currentValue: number) => void;
  onToggleComplete?: (goalId: string, completed: boolean) => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  isPast?: boolean;
  isFuture?: boolean;
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onUpdateProgress,
  onToggleComplete,
  accent = false,
  isPast = false,
  isFuture = false,
}: GoalCardProps) {
  const [progressValue, setProgressValue] = useState(
    goal.goalType === 'numerical' ? String(goal.currentValue || 0) : ''
  );

  // Update local state when goal changes
  useEffect(() => {
    if (goal.goalType === 'numerical') {
      setProgressValue(String(goal.currentValue || 0));
    }
  }, [goal.currentValue, goal.goalType]);

  const handleToggleComplete = () => {
    if (goal.goalType === 'yesno' && onToggleComplete) {
      onToggleComplete(goal.id, !goal.completed);
    }
  };

  const opacityClass = isPast ? 'opacity-60' : isFuture ? 'opacity-80' : '';
  const isComplete = goal.goalType === 'yesno' 
    ? goal.completed 
    : goal.goalType === 'numerical' 
      ? (goal.currentValue || 0) >= (goal.targetValue || 0)
      : false;

  return (
    <Card className={cn(
      'hover:border-border transition-all duration-200 relative overflow-hidden',
      opacityClass,
      isComplete && !isPast && 'ring-1 ring-green-500/20'
    )} accent={typeof accent === 'boolean' ? accent : !!accent}>
      {/* Completion indicator stripe */}
      {isComplete && !isPast && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/40 via-emerald-500/40 to-green-500/40" />
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-2">
              {goal.goalType === 'yesno' && (
                <button
                  onClick={handleToggleComplete}
                  className={cn(
                    'mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                    'hover:scale-110 active:scale-95',
                    goal.completed
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/20 border-green-500/50 text-green-400 shadow-lg shadow-green-500/10'
                      : 'border-border-subtle hover:border-gray-600 hover:bg-background-hover'
                  )}
                >
                  {goal.completed && <Check className="w-4 h-4" />}
                </button>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <h4 className={cn(
                    'font-semibold text-sm flex-1',
                    goal.goalType === 'yesno' && goal.completed ? 'line-through text-gray-500' : 'text-gray-50'
                  )}>
                    {goal.title}
                  </h4>
                  {goal.goalType === 'numerical' && (
                    <div className={cn(
                      'px-2 py-0.5 rounded-md text-xs font-bold tabular-nums flex-shrink-0',
                      isComplete 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    )}>
                      {Math.round(((goal.currentValue || 0) / (goal.targetValue || 1)) * 100)}%
                    </div>
                  )}
                </div>
                {goal.description && (
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                    {goal.description}
                  </p>
                )}
                
                {goal.goalType === 'numerical' && (
                  <div className="mt-3">
                    <GoalProgressBar
                      currentValue={goal.currentValue || 0}
                      targetValue={goal.targetValue || 0}
                      unit={goal.unit}
                      showIcon={true}
                    />
                    
                    {/* Inline progress editor */}
                    {onUpdateProgress && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const current = goal.currentValue || 0;
                            const newValue = Math.max(0, current - 1);
                            onUpdateProgress(goal.id, newValue);
                          }}
                          className={cn(
                            'flex-shrink-0 w-7 h-7 rounded border flex items-center justify-center',
                            'bg-background-card border-border-subtle hover:border-gray-600',
                            'text-gray-400 hover:text-gray-300 transition-colors',
                            'text-sm font-semibold'
                          )}
                        >
                          −
                        </button>
                        
                        <Input
                          type="number"
                          value={progressValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            const numVal = parseFloat(val);
                            if (val === '' || (!isNaN(numVal) && numVal >= 0)) {
                              setProgressValue(val);
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const maxVal = goal.targetValue || 0;
                            const finalVal = Math.min(maxVal, Math.max(0, val));
                            if (finalVal !== (goal.currentValue || 0)) {
                              onUpdateProgress(goal.id, finalVal);
                            } else {
                              setProgressValue(String(goal.currentValue || 0));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className={cn(
                            'h-7 text-sm font-medium text-center tabular-nums flex-1 min-w-0',
                            'text-gray-50 bg-background-card border-border-subtle',
                            'focus:ring-1 focus:ring-offset-0'
                          )}
                          min={0}
                          max={goal.targetValue}
                          accent={typeof accent === 'boolean' ? accent : !!accent}
                        />
                        
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {goal.unit || ''}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const current = goal.currentValue || 0;
                            const maxVal = goal.targetValue || 0;
                            const newValue = Math.min(maxVal, current + 1);
                            onUpdateProgress(goal.id, newValue);
                          }}
                          className={cn(
                            'flex-shrink-0 w-7 h-7 rounded border flex items-center justify-center',
                            'bg-background-card border-border-subtle hover:border-gray-600',
                            'text-gray-400 hover:text-gray-300 transition-colors',
                            'text-sm font-semibold'
                          )}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {goal.goalType === 'yesno' && goal.completed && goal.completedAt && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span>Completed on {format(new Date(goal.completedAt), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {goal.category && goal.category !== 'general' && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs capitalize',
                  goal.category === 'tasks' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                  goal.category === 'features' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' :
                  goal.category === 'bugs' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                  goal.category === 'content' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                  goal.category === 'meetings' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                  goal.category === 'operations' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                  goal.category === 'team' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/40'
                )}
              >
                {CATEGORY_LABELS[goal.category]}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                'text-xs capitalize',
                goal.type === 'monthly' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
              )}
            >
              {goal.type}
            </Badge>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(goal)}
              className="h-7 w-7 p-0"
              accent={accent}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to delete this goal?')) {
                  onDelete(goal);
                }
              }}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
