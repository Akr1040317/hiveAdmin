import React from 'react';
import { FeedbackReport } from '@/app/actions/bugs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FeedbackReportCardProps {
  report: FeedbackReport;
  onConvert: (reportId: string) => void;
  converting?: boolean;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

function toDate(value: Date | { seconds: number; nanoseconds: number } | string | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // Handle ISO string from server action
    return new Date(value);
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  return new Date();
}

function parseSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
  const lower = severity.toLowerCase();
  if (lower.includes('critical')) return 'critical';
  if (lower.includes('high')) return 'high';
  if (lower.includes('medium')) return 'medium';
  if (lower.includes('low')) return 'low';
  if (lower.includes('affects functionality')) return 'high';
  return 'medium';
}

export function FeedbackReportCard({ report, onConvert, converting = false, accent = false }: FeedbackReportCardProps) {
  const severity = parseSeverity(report.severity);
  const reportDate = toDate(report.timestamp);
  const reporterName = report.name || report.email?.split('@')[0] || 'Unknown';

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/40',
    high: 'bg-red-500/20 text-red-400 border-red-500/40',
    medium: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  };

  return (
    <div className="border border-border-subtle rounded-lg p-4 bg-background-card hover:bg-background-hover transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-gray-50 mb-1 line-clamp-1">
                {report.subject || 'No subject'}
              </h3>
              <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                {report.description || 'No description provided'}
              </p>
            </div>
            <Badge className={cn('text-xs shrink-0', severityColors[severity])}>
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center">
                <span className="text-[10px] text-gray-300">U</span>
              </div>
              <span>{reporterName}</span>
            </div>
            <span>•</span>
            <span>{format(reportDate, 'MMM d, yyyy')}</span>
            {report.bugType && report.bugType !== 'Not specified' && (
              <>
                <span>•</span>
                <span className="text-gray-400">{report.bugType}</span>
              </>
            )}
          </div>
        </div>
        
        <Button
          size="sm"
          variant="primary"
          accent={accent}
          onClick={() => onConvert(report.id)}
          disabled={converting}
          className="shrink-0"
        >
          {converting ? 'Converting...' : 'Convert to Bug'}
        </Button>
      </div>
    </div>
  );
}
