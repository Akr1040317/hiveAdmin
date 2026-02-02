'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, Calendar, User, Mail, Check, Wand2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';

export interface PropertyField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number';
  value: any;
  options?: { value: string; label: string }[];
  onChange: (value: any) => void;
}

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (title: string) => void;
  properties: PropertyField[];
  bodyFields?: {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }[];
  metadata?: {
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string;
  };
  onSave?: () => void;
  onDelete?: () => void;
  onUnconvert?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  // Copy details functionality
  onCopyDetails?: () => void;
  copyDetailsText?: string;
  // Email functionality
  reporterEmail?: string | null;
  onGenerateEmail?: () => Promise<{ subject: string; body: string }>;
  onSendEmail?: (subject: string, body: string) => Promise<void>;
  lastEmailSent?: Date;
  lastEmailSubject?: string;
  // Assignment functionality
  assignedTo?: string | null;
  teamMembers?: string[];
  onAssignedToChange?: (email: string | null) => void;
  showAssignment?: boolean;
  // Custom content to render after body fields
  customContent?: React.ReactNode;
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  onTitleChange,
  properties,
  bodyFields = [],
  metadata,
  onSave,
  onDelete,
  onUnconvert,
  accent = false,
  onCopyDetails,
  copyDetailsText,
  reporterEmail,
  onGenerateEmail,
  onSendEmail,
  lastEmailSent,
  lastEmailSubject,
  assignedTo,
  teamMembers = [],
  onAssignedToChange,
  showAssignment = false,
  customContent,
}: DetailDrawerProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    if (showEmailComposer && !emailSubject) {
      setEmailSubject(lastEmailSubject || `Update: ${title || 'Bug Report'}`);
    }
  }, [showEmailComposer, lastEmailSubject, title]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (localTitle !== title) {
      onTitleChange(localTitle);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    // Could show a toast here
  };

  const handleCopyDetails = async () => {
    if (onCopyDetails && copyDetailsText) {
      try {
        await navigator.clipboard.writeText(copyDetailsText);
        setCopiedDetails(true);
        setTimeout(() => {
          setCopiedDetails(false);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = copyDetailsText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopiedDetails(true);
          setTimeout(() => {
            setCopiedDetails(false);
          }, 2000);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const handleGenerateEmail = async () => {
    if (!onGenerateEmail) return;
    
    setGeneratingEmail(true);
    try {
      const result = await onGenerateEmail();
      setEmailSubject(result.subject);
      setEmailBody(result.body);
    } catch (error) {
      console.error('Error generating email:', error);
      alert(`Failed to generate email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!onSendEmail || !emailSubject.trim() || !emailBody.trim()) {
      alert('Please fill in all email fields');
      return;
    }

    setSendingEmail(true);
    try {
      await onSendEmail(emailSubject, emailBody);
      setShowEmailComposer(false);
      setEmailSubject('');
      setEmailBody('');
      alert('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gradient-to-b from-background-card to-background border-l border-border-subtle z-50',
            'flex flex-col shadow-2xl backdrop-blur-sm',
            'animate-slide-in-right'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-background-card/80 backdrop-blur-sm">
            <div className="flex-1">
              {isEditingTitle ? (
                <Input
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleBlur();
                    }
                    if (e.key === 'Escape') {
                      setLocalTitle(title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-base font-medium"
                  accent={typeof accent === 'boolean' ? accent : !!accent}
                />
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="text-base font-medium text-gray-50 cursor-text hover:bg-background-hover px-1 py-0.5 rounded-notion -ml-1"
                >
                  {title || 'Untitled'}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onCopyDetails && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyDetails}
                  className="h-7 px-2 text-xs"
                  title="Copy details"
                >
                  {copiedDetails ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Details
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="h-7 w-7 p-0"
                title="Copy link"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(window.location.href, '_blank')}
                className="h-7 w-7 p-0"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Properties */}
            {(properties.length > 0 || showAssignment) && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Properties
                </h3>
                <div className="space-y-3">
                  {/* Assignment Field */}
                  {showAssignment && onAssignedToChange && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-400 w-24 flex-shrink-0">
                        Assigned To
                      </label>
                      <div className="flex-1">
                        <Select
                          value={assignedTo || ''}
                          onChange={(e) => onAssignedToChange(e.target.value || null)}
                          className="h-8 text-sm"
                          accent={typeof accent === 'boolean' ? accent : !!accent}
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((email) => (
                            <option key={email} value={email}>
                              {email.split('@')[0]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )}
                  {properties.map((prop) => (
                    <div key={prop.key} className="flex items-center gap-3">
                      <label className="text-xs text-gray-400 w-24 flex-shrink-0">
                        {prop.label}
                      </label>
                      <div className="flex-1">
                        {prop.type === 'select' ? (
                          <Select
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(e.target.value)}
                            className="h-8 text-sm"
                            accent={typeof accent === 'boolean' ? accent : !!accent}
                          >
                            {prop.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        ) : prop.type === 'multiselect' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {prop.options?.map((opt) => {
                              const isSelected = Array.isArray(prop.value) && prop.value.includes(opt.value);
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    const current = Array.isArray(prop.value) ? prop.value : [];
                                    if (isSelected) {
                                      prop.onChange(current.filter(v => v !== opt.value));
                                    } else {
                                      prop.onChange([...current, opt.value]);
                                    }
                                  }}
                                  className={cn(
                                    'px-2 py-0.5 rounded-notion text-xs border transition-colors',
                                    isSelected
                                      ? 'bg-accent-purple-subtle border-accent-purple-border text-accent-purple-light'
                                      : 'bg-background-card border-border-subtle text-gray-300 hover:border-border'
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : prop.type === 'date' ? (
                          <Input
                            type="date"
                            value={prop.value ? format(new Date(prop.value), 'yyyy-MM-dd') : ''}
                            onChange={(e) => prop.onChange(e.target.value ? new Date(e.target.value) : null)}
                            className="h-8 text-sm"
                            accent={typeof accent === 'boolean' ? accent : !!accent}
                          />
                        ) : prop.type === 'number' ? (
                          <Input
                            type="number"
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(Number(e.target.value))}
                            className="h-8 text-sm"
                            accent={typeof accent === 'boolean' ? accent : !!accent}
                          />
                        ) : (
                          <Input
                            value={prop.value || ''}
                            onChange={(e) => prop.onChange(e.target.value)}
                            className="h-8 text-sm"
                            accent={typeof accent === 'boolean' ? accent : !!accent}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body Fields */}
            {bodyFields.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                  {field.label}
                </label>
                <textarea
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={field.placeholder}
                  className={cn(
                    'w-full min-h-[120px] rounded-notion border border-border-subtle bg-background-card px-2.5 py-2',
                    'text-sm text-gray-100 placeholder:text-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background transition-all duration-notion',
                    accent
                      ? 'focus:ring-violet-500/40 focus:border-violet-500/30'
                      : 'focus:ring-gray-500/40 focus:border-border',
                    'resize-none'
                  )}
                />
              </div>
            ))}

            {/* Email Section */}
            {reporterEmail && onSendEmail && (
              <div className="pt-4 border-t border-border-subtle">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    Send Email Update
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowEmailComposer(!showEmailComposer);
                      if (!showEmailComposer && !emailSubject) {
                        setEmailSubject(lastEmailSubject || `Update: ${title || 'Bug Report'}`);
                      }
                    }}
                    className="text-xs h-6 px-2"
                  >
                    {showEmailComposer ? 'Cancel' : 'Compose Email'}
                  </Button>
                </div>
                {showEmailComposer && (
                  <div className="space-y-3 bg-background-card/50 p-3 rounded-notion border border-border-subtle">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">To:</label>
                      <Input
                        type="email"
                        value={reporterEmail}
                        disabled
                        className="h-7 text-sm opacity-60"
                        accent={typeof accent === 'boolean' ? accent : !!accent}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Subject:</label>
                      <Input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="h-7 text-sm"
                        placeholder="Email subject..."
                        accent={typeof accent === 'boolean' ? accent : !!accent}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Message:</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className={cn(
                          'w-full min-h-[120px] rounded-notion border border-border-subtle bg-background-card px-2.5 py-2',
                          'text-sm text-gray-100 placeholder:text-gray-500',
                          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background transition-all duration-notion',
                          accent
                            ? 'focus:ring-violet-500/40 focus:border-violet-500/30'
                            : 'focus:ring-gray-500/40 focus:border-border',
                          'resize-none'
                        )}
                        placeholder="Write your message here..."
                        rows={6}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {onGenerateEmail && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleGenerateEmail}
                          disabled={generatingEmail}
                          className="text-xs h-7 px-2"
                        >
                          {generatingEmail ? (
                            <>
                              <Wand2 className="w-3 h-3 mr-1 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-3 h-3 mr-1" />
                              Generate with AI
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                        accent={typeof accent === 'boolean' ? accent : !!accent}
                        className="text-xs h-7 px-2 ml-auto"
                      >
                        {sendingEmail ? (
                          <>
                            <Send className="w-3 h-3 mr-1 animate-pulse" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3 mr-1" />
                            Send Email
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {lastEmailSent && (
                  <div className="mt-2 text-xs text-gray-500">
                    Last sent: {format(new Date(lastEmailSent), 'MMM d, yyyy h:mm a')}
                    {lastEmailSubject && ` - "${lastEmailSubject}"`}
                  </div>
                )}
              </div>
            )}

            {/* Custom Content */}
            {customContent}

            {/* Metadata */}
            {metadata && (
              <div className="pt-4 border-t border-border-subtle">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Activity
                </h3>
                <div className="space-y-2 text-xs text-gray-500">
                  {metadata.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created {format(new Date(metadata.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {metadata.updatedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Updated {format(new Date(metadata.updatedAt), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {metadata.createdBy && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      <span>By {metadata.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {(onSave || onDelete || onUnconvert) && (
            <div className="flex items-center justify-between p-4 border-t border-border-subtle">
              <div className="flex items-center gap-2">
                {onUnconvert && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onUnconvert}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    Unconvert to Report
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </Button>
                )}
              </div>
              {onSave && (
                <Button
                  size="sm"
                  variant="primary"
                  accent={typeof accent === 'boolean' ? accent : !!accent}
                  onClick={onSave}
                  className="ml-auto"
                >
                  Save
                </Button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
