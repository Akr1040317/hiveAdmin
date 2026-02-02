'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { Goal, getGoals, createGoal, updateGoal, deleteGoal } from '@/app/actions/goals';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GoalCard } from '@/components/goals/GoalCard';
import { PeriodNavigator } from '@/components/goals/PeriodNavigator';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import type { PropertyField } from '@/components/shared/DetailDrawer';
import {
  getCurrentMonthPeriod,
  getCurrentWeekPeriod,
  getPreviousMonthPeriod,
  getNextMonthPeriod,
  getPreviousWeekPeriod,
  getNextWeekPeriod,
  formatMonthPeriod,
  formatWeekPeriod,
  isCurrentPeriod,
  isPastPeriod,
  isFuturePeriod,
} from '@/lib/goals';
import { format } from 'date-fns';
import { Target, Plus, Sparkles } from 'lucide-react';
import { 
  GOAL_TEMPLATES, 
  CATEGORY_LABELS, 
  CATEGORY_DESCRIPTIONS,
  getTemplatesByCategory,
  getTemplateById,
  type GoalTemplate 
} from '@/lib/goal-templates';
import { GoalCategory } from '@/app/actions/goals';

function GoalsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView } = useView();
  const accentClasses = project?.accentClasses;
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'monthly' | 'weekly'>('monthly');
  const [monthlyPeriod, setMonthlyPeriod] = useState(getCurrentMonthPeriod());
  const [weeklyPeriod, setWeeklyPeriod] = useState(getCurrentWeekPeriod());
  const [filter, setFilter] = useState<'all' | 'current' | 'past' | 'future'>('all');
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | 'all'>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);
  
  const [newGoalData, setNewGoalData] = useState<Partial<Goal>>({
    title: 'New Goal',
    description: '',
    type: 'monthly',
    goalType: 'numerical',
    category: 'general',
    period: monthlyPeriod,
    targetValue: 100,
    currentValue: 0,
    unit: '',
    completed: false,
  });

  const { execute: loadGoals, loading } = useServerAction(getGoals);
  const { execute: handleCreateGoal } = useServerAction(createGoal);
  const { execute: handleUpdateGoal } = useServerAction(updateGoal);
  const { execute: handleDeleteGoal } = useServerAction(deleteGoal);

  useEffect(() => {
    if (projectId) {
      loadGoals(projectId).then((data) => {
        if (data) setGoals(data);
      });
    }
  }, [projectId]);

  // Update period when switching tabs
  useEffect(() => {
    if (activeTab === 'monthly') {
      setNewGoalData(prev => ({ ...prev, period: monthlyPeriod, type: 'monthly' }));
    } else {
      setNewGoalData(prev => ({ ...prev, period: weeklyPeriod, type: 'weekly' }));
    }
  }, [activeTab, monthlyPeriod, weeklyPeriod]);

  const currentPeriod = activeTab === 'monthly' ? monthlyPeriod : weeklyPeriod;
  const formattedPeriod = activeTab === 'monthly' 
    ? formatMonthPeriod(monthlyPeriod)
    : formatWeekPeriod(weeklyPeriod);

  const filteredGoals = useMemo(() => {
    let result = goals.filter(g => g.type === activeTab);
    
    // Filter by category
    if (categoryFilter !== 'all') {
      result = result.filter(g => g.category === categoryFilter);
    }
    
    if (filter === 'current') {
      result = result.filter(g => isCurrentPeriod(g.period, g.type));
    } else if (filter === 'past') {
      result = result.filter(g => isPastPeriod(g.period, g.type));
    } else if (filter === 'future') {
      result = result.filter(g => isFuturePeriod(g.period, g.type));
    }
    
    // Sort by period (newest first), then by createdAt
    return result.sort((a, b) => {
      if (a.period !== b.period) {
        return b.period.localeCompare(a.period);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [goals, activeTab, filter, categoryFilter]);

  const periodGoals = useMemo(() => {
    return filteredGoals.filter(g => g.period === currentPeriod);
  }, [filteredGoals, currentPeriod]);

  const handleCreate = async (data: Partial<Goal>) => {
    if (!projectId) return;
    
    const goalType = data.goalType || 'numerical';
    const newGoal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: data.title || 'Untitled Goal',
      description: data.description || '',
      type: data.type || 'monthly',
      goalType: goalType,
      category: data.category || 'general',
      period: data.period || currentPeriod,
      ...(goalType === 'numerical' ? {
        targetValue: data.targetValue || 100,
        currentValue: data.currentValue || 0,
        ...(data.unit ? { unit: data.unit } : {}),
      } : {
        completed: data.completed || false,
      }),
      ...(data.linkedEntityType ? { linkedEntityType: data.linkedEntityType } : {}),
      ...(data.linkedEntityId ? { linkedEntityId: data.linkedEntityId } : {}),
    };
    
    await handleCreateGoal(projectId, newGoal);
    const updated = await loadGoals(projectId);
    if (updated) setGoals(updated);
    setIsDrawerOpen(false);
    resetNewGoalData();
  };

  const handleUpdate = async (updates: Partial<Goal>) => {
    if (!projectId || !selectedGoal) return;
    await handleUpdateGoal(projectId, selectedGoal.id, updates);
    const updated = await loadGoals(projectId);
    if (updated) setGoals(updated);
    setSelectedGoal({ ...selectedGoal, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedGoal) return;
    if (confirm('Are you sure you want to delete this goal?')) {
      await handleDeleteGoal(projectId, selectedGoal.id);
      const updated = await loadGoals(projectId);
      if (updated) setGoals(updated);
      setIsDrawerOpen(false);
      setSelectedGoal(null);
    }
  };

  const handleUpdateProgress = async (goalId: string, currentValue: number) => {
    if (!projectId) return;
    await handleUpdateGoal(projectId, goalId, { currentValue });
    const updated = await loadGoals(projectId);
    if (updated) setGoals(updated);
  };

  const handleToggleComplete = async (goalId: string, completed: boolean) => {
    if (!projectId) return;
    const updateData: any = { completed };
    if (completed) {
      updateData.completedAt = new Date();
    }
    await handleUpdateGoal(projectId, goalId, updateData);
    const updated = await loadGoals(projectId);
    if (updated) setGoals(updated);
  };

  const resetNewGoalData = () => {
    const period = activeTab === 'monthly' ? monthlyPeriod : weeklyPeriod;
    setNewGoalData({
      title: 'New Goal',
      description: '',
      type: activeTab,
      goalType: 'numerical',
      category: 'general',
      period: period,
      targetValue: 100,
      currentValue: 0,
      unit: '',
      completed: false,
    });
    setSelectedTemplate(null);
  };

  const handleTemplateSelect = (template: GoalTemplate) => {
    const period = template.suggestedPeriod === 'monthly' ? monthlyPeriod : weeklyPeriod;
    setSelectedTemplate(template);
    setNewGoalData({
      title: template.defaultTitle.replace('{target}', String(template.defaultTarget || 100)),
      description: template.description,
      type: template.suggestedPeriod,
      goalType: template.goalType,
      category: template.category,
      period: period,
      targetValue: template.defaultTarget,
      currentValue: 0,
      unit: template.defaultUnit || '',
      completed: false,
    });
    setShowTemplates(false);
    setIsDrawerOpen(true);
  };

  const handlePreviousPeriod = () => {
    if (activeTab === 'monthly') {
      setMonthlyPeriod(getPreviousMonthPeriod(monthlyPeriod));
    } else {
      setWeeklyPeriod(getPreviousWeekPeriod(weeklyPeriod));
    }
  };

  const handleNextPeriod = () => {
    if (activeTab === 'monthly') {
      setMonthlyPeriod(getNextMonthPeriod(monthlyPeriod));
    } else {
      setWeeklyPeriod(getNextWeekPeriod(weeklyPeriod));
    }
  };

  const handleGoToCurrent = () => {
    if (activeTab === 'monthly') {
      setMonthlyPeriod(getCurrentMonthPeriod());
    } else {
      setWeeklyPeriod(getCurrentWeekPeriod());
    }
  };

  const isCurrent = isCurrentPeriod(currentPeriod, activeTab);
  const accent = project?.accentColorKey || false;

  const goalTypeOptions = [
    { value: 'numerical', label: 'Numerical' },
    { value: 'yesno', label: 'Yes/No' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Goals</h1>
            <p className="text-sm text-gray-400">Track monthly and weekly goals with progress</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle px-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('monthly')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'monthly'
                ? cn('border-current', accentClasses?.text, accentClasses?.text)
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            Monthly Goals
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'weekly'
                ? cn('border-current', accentClasses?.text, accentClasses?.text)
                : 'border-transparent text-gray-400 hover:text-gray-300'
            )}
          >
            Weekly Goals
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PeriodNavigator
            period={currentPeriod}
            type={activeTab}
            onPrevious={handlePreviousPeriod}
            onNext={handleNextPeriod}
            onCurrent={handleGoToCurrent}
            formattedPeriod={formattedPeriod}
            isCurrent={isCurrent}
            accent={accent}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GoalCategory | 'all')}
            className={cn(
              'h-8 px-3 rounded-notion border border-border-subtle bg-background-card text-sm text-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              accent ? 'focus:ring-violet-500/40' : 'focus:ring-gray-500/40'
            )}
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className={cn(
              'h-8 px-3 rounded-notion border border-border-subtle bg-background-card text-sm text-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              accent ? 'focus:ring-violet-500/40' : 'focus:ring-gray-500/40'
            )}
          >
            <option value="all">All Periods</option>
            <option value="current">Current</option>
            <option value="past">Past</option>
            <option value="future">Future</option>
          </select>
          
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              accent={accent}
              className="flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Templates
            </Button>
            
            {showTemplates && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowTemplates(false)}
                />
                <div className={cn(
                  'absolute right-0 top-full mt-2 w-96 max-h-[600px] overflow-y-auto',
                  'bg-background-card border border-border-subtle rounded-notion shadow-xl z-50',
                  'p-4 space-y-4'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-50">Goal Templates</h3>
                    <button
                      onClick={() => setShowTemplates(false)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      ×
                    </button>
                  </div>
                  
                  {Object.entries(GOAL_TEMPLATES).map(([category, templates]) => (
                    <div key={category} className="space-y-2">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {CATEGORY_LABELS[category as GoalCategory]}
                      </div>
                      <div className="space-y-1">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className={cn(
                              'w-full text-left p-2 rounded-notion text-xs',
                              'hover:bg-background-hover transition-colors',
                              'border border-transparent hover:border-border-subtle'
                            )}
                          >
                            <div className="font-medium text-gray-50">{template.name}</div>
                            <div className="text-gray-400 mt-0.5">{template.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedGoal(null);
              resetNewGoalData();
              setIsDrawerOpen(true);
            }}
            accent={accent}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Goal
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading goals...</div>
        ) : filter === 'all' ? (
          // Show all goals grouped by period
          <div className="space-y-6">
            {Object.entries(
              filteredGoals.reduce((acc, goal) => {
                if (!acc[goal.period]) {
                  acc[goal.period] = [];
                }
                acc[goal.period].push(goal);
                return acc;
              }, {} as Record<string, Goal[]>)
            )
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([period, periodGoals]) => {
                const formatted = activeTab === 'monthly' 
                  ? formatMonthPeriod(period)
                  : formatWeekPeriod(period);
                const isPeriodCurrent = isCurrentPeriod(period, activeTab);
                const isPeriodPast = isPastPeriod(period, activeTab);
                const isPeriodFuture = isFuturePeriod(period, activeTab);
                
                return (
                  <div key={period} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={cn(
                        'text-sm font-semibold',
                        isPeriodCurrent ? 'text-gray-50' : isPeriodPast ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {formatted}
                      </h3>
                      {isPeriodCurrent && (
                        <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400 border-green-500/40">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {periodGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onEdit={(g) => {
                            setSelectedGoal(g);
                            setIsDrawerOpen(true);
                          }}
                          onDelete={handleDelete}
                          onUpdateProgress={handleUpdateProgress}
                          onToggleComplete={handleToggleComplete}
                          accent={accent}
                          isPast={isPeriodPast}
                          isFuture={isPeriodFuture}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            
            {filteredGoals.length === 0 && (
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No {activeTab} goals found</p>
                <p className="text-sm text-gray-500">Create your first goal to get started!</p>
              </div>
            )}
          </div>
        ) : (
          // Show goals for current period or filtered period
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {periodGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => {
                  setSelectedGoal(g);
                  setIsDrawerOpen(true);
                }}
                onDelete={handleDelete}
                onUpdateProgress={handleUpdateProgress}
                onToggleComplete={handleToggleComplete}
                accent={accent}
                isPast={isPastPeriod(goal.period, goal.type)}
                isFuture={isFuturePeriod(goal.period, goal.type)}
              />
            ))}
            
            {periodGoals.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No goals for {formattedPeriod}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedGoal(null);
                    resetNewGoalData();
                    setIsDrawerOpen(true);
                  }}
                  accent={accent}
                  className="mt-2"
                >
                  Create Goal
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedGoal(null);
          resetNewGoalData();
        }}
        title={selectedGoal?.title || newGoalData.title || 'New Goal'}
        onTitleChange={(title) => {
          if (selectedGoal) {
            handleUpdate({ title });
          } else {
            setNewGoalData(prev => ({ ...prev, title }));
          }
        }}
        properties={[
          {
            key: 'category',
            label: 'Category',
            type: 'select' as const,
            value: selectedGoal?.category || newGoalData.category || 'general',
            options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
            onChange: (value) => {
              if (selectedGoal) {
                handleUpdate({ category: value as GoalCategory });
              } else {
                setNewGoalData(prev => ({ ...prev, category: value as GoalCategory }));
              }
            },
          },
          {
            key: 'goalType',
            label: 'Goal Type',
            type: 'select' as const,
            value: selectedGoal?.goalType || newGoalData.goalType || 'numerical',
            options: goalTypeOptions,
            onChange: (value) => {
              if (selectedGoal) {
                handleUpdate({ goalType: value as Goal['goalType'] });
              } else {
                setNewGoalData(prev => ({ ...prev, goalType: value as Goal['goalType'] }));
              }
            },
          },
          {
            key: 'type',
            label: 'Period Type',
            type: 'select' as const,
            value: selectedGoal?.type || newGoalData.type || activeTab,
            options: [
              { value: 'monthly', label: 'Monthly' },
              { value: 'weekly', label: 'Weekly' },
            ],
            onChange: (value) => {
              const period = value === 'monthly' ? monthlyPeriod : weeklyPeriod;
              if (selectedGoal) {
                handleUpdate({ type: value as Goal['type'], period });
              } else {
                setNewGoalData(prev => ({ ...prev, type: value as Goal['type'], period }));
              }
            },
          },
          ...((selectedGoal?.goalType === 'numerical' || newGoalData.goalType === 'numerical' ? [
            {
              key: 'targetValue',
              label: 'Target Value',
              type: 'number' as const,
              value: selectedGoal?.targetValue || newGoalData.targetValue || 100,
              onChange: (value) => {
                const numValue = typeof value === 'number' ? value : (parseFloat(String(value)) || 100);
                if (selectedGoal) {
                  handleUpdate({ targetValue: numValue });
                } else {
                  setNewGoalData(prev => ({ ...prev, targetValue: numValue }));
                }
              },
            },
            {
              key: 'currentValue',
              label: 'Current Value',
              type: 'number' as const,
              value: selectedGoal?.currentValue || newGoalData.currentValue || 0,
              onChange: (value) => {
                const numValue = typeof value === 'number' ? value : (parseFloat(String(value)) || 0);
                if (selectedGoal) {
                  handleUpdate({ currentValue: numValue });
                } else {
                  setNewGoalData(prev => ({ ...prev, currentValue: numValue }));
                }
              },
            },
            {
              key: 'unit',
              label: 'Unit (optional)',
              type: 'text' as const,
              value: selectedGoal?.unit || newGoalData.unit || '',
              onChange: (value) => {
                if (selectedGoal) {
                  handleUpdate({ unit: value });
                } else {
                  setNewGoalData(prev => ({ ...prev, unit: value }));
                }
              },
            },
          ] : []) as PropertyField[]),
        ]}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedGoal?.description || newGoalData.description || '',
            onChange: (value) => {
              if (selectedGoal) {
                handleUpdate({ description: value });
              } else {
                setNewGoalData(prev => ({ ...prev, description: value }));
              }
            },
            placeholder: 'Describe this goal...',
          },
        ]}
        metadata={selectedGoal ? {
          createdAt: selectedGoal.createdAt,
          updatedAt: selectedGoal.updatedAt,
          createdBy: selectedGoal.createdBy,
        } : undefined}
        onSave={() => {
          if (selectedGoal) {
            setIsDrawerOpen(false);
          } else {
            handleCreate(newGoalData);
          }
        }}
        onDelete={selectedGoal ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function GoalsPage() {
  return (
    <ViewProvider moduleName="goals" defaultViewType="table">
      <GoalsContent />
    </ViewProvider>
  );
}
