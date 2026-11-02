import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  RotateCcw, 
  AlertCircle,
  ArrowRight,
  Mail,
  Calendar,
  CheckSquare,
  RefreshCw,
  ExternalLink,
  Clock,
  ChevronRight
} from 'lucide-react';
import { ChatMessage, Responsibility, EmailRecord, CalendarEventRecord } from '@lifesynch/shared';
import { apiClient, getFriendlyError } from '../../services/api';

interface AskAssistantProps {
  compact?: boolean;
  onNavigateToTab?: (tab: string) => void;
  tasks?: Responsibility[];
  emails?: EmailRecord[];
  calendarEvents?: CalendarEventRecord[];
  onSelectResponsibility?: (item: Responsibility) => void;
  onSelectEmail?: (emailId: string) => void;
  onSelectCalendarEvent?: (eventId: string) => void;
  initialQuestion?: string;
  onClearInitialQuestion?: () => void;
}

const STARTER_QUESTIONS = [
  'What should I focus on today?',
  'What is coming up?',
  'Any new internships or opportunities?',
  'When is my next meeting?',
  'Summarize my important emails',
  'What am I overdue on?'
];

interface ParsedBlock {
  type: 'heading' | 'item' | 'paragraph';
  headingText?: string;
  title?: string;
  explanation?: string;
  details?: string[];
  sourceType?: 'gmail' | 'calendar' | 'task';
  sourceLabel?: string;
  sourceId?: string;
  text?: string;
}

export const AskAssistant: React.FC<AskAssistantProps> = ({ 
  compact = false,
  onNavigateToTab,
  tasks = [],
  emails = [],
  calendarEvents = [],
  onSelectResponsibility,
  onSelectEmail,
  onSelectCalendarEvent,
  initialQuestion,
  onClearInitialQuestion
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll smoothly to newest messages
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && !isLoading) {
      const q = initialQuestion.trim();
      if (onClearInitialQuestion) {
        onClearInitialQuestion();
      }
      handleSend(q);
    }
  }, [initialQuestion]);

  const handleSend = async (questionToSend?: string) => {
    const q = (questionToSend || inputQuestion).trim();
    if (!q || isLoading) return;

    setError(null);
    setLastFailedQuestion(null);
    setInputQuestion('');

    const userMessage: ChatMessage = {
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const response = await apiClient.askAssistant(
        q,
        newHistory.slice(-10) // preserve context
      );

      if (!response.data || !response.data.answer) {
        throw new Error('Received an empty response from the LifeSynch intelligence engine.');
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: response.data.suggestedQuestions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const friendlyMsg = getFriendlyError(err, 'ai');
      setError(friendlyMsg);
      setLastFailedQuestion(q);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
    setLastFailedQuestion(null);
    setInputQuestion('');
  };

  const handleRetry = () => {
    if (lastFailedQuestion) {
      handleSend(lastFailedQuestion);
    }
  };

  // Dynamic context-aware suggested follow-ups
  const getFollowUpSuggestions = (userQuery: string): string[] => {
    const q = userQuery.toLowerCase();

    // Specific internship / opportunity queries
    if (q.includes('intern') || q.includes('opportunity') || q.includes('placement') || q.includes('job') || q.includes('career')) {
      return [
        'When is the deadline to apply?',
        'What requirements were mentioned?',
        'Summarize the selection process',
        'What else should I focus on today?'
      ];
    }

    // Specific meeting / calendar queries
    if (q.includes('meeting') || q.includes('calendar') || q.includes('schedule') || q.includes('call') || q.includes('event')) {
      return [
        'Who is attending this meeting?',
        'Do I have preparation tasks?',
        'What other commitments do I have today?',
        'What deadlines are coming up?'
      ];
    }

    // Specific academic queries
    if (q.includes('academic') || q.includes('assignment') || q.includes('exam') || q.includes('test') || q.includes('nptel') || q.includes('course')) {
      return [
        'When is the submission deadline?',
        'What topics are covered in the syllabus?',
        'Any other course announcements?',
        'What should I focus on today?'
      ];
    }

    // Specific overdue queries
    if (q.includes('overdue') || q.includes('missed') || q.includes('passed') || q.includes('late')) {
      return [
        'Which overdue item is most urgent?',
        'Can I still submit or reply?',
        'What should I focus on today?',
        'What deadlines are coming up?'
      ];
    }

    // Highest priority / First query
    if (q.includes('first') || q.includes('highest priority') || q.includes('top priority')) {
      return [
        'Why is this task high priority?',
        'What should I focus on today?',
        'What deadlines are coming up?',
        'Summarize my important emails'
      ];
    }

    // Focus queries
    if (q.includes('focus') || q.includes('today') || q.includes('do next')) {
      return [
        'Which task should I do first?',
        'What deadlines are coming up?',
        'What am I overdue on?',
        'Summarize my important emails'
      ];
    }

    return [
      'What should I focus on today?',
      'What deadlines are coming up?',
      'Summarize my important emails',
      'What am I overdue on?'
    ];
  };

  // Generic labels that must never be mistaken for distinct items or matched to calendar/tasks
  const GENERIC_METADATA_KEYS = new Set([
    'deadline', 'deadlines', 'due date', 'due', 'action', 'actions', 'priority', 'status', 
    'note', 'notes', 'time', 'date', 'why it matters', 'why', 'source', 'sources',
    'category', 'description', 'details', 'detail', 'event', 'events', 'task', 'tasks',
    'upcoming', 'passed', 'informative', 'today', 'tomorrow', 'meeting', 'meetings',
    'focus', 'item', 'items', 'summary', 'overview', 'context'
  ]);

  const isGenericMetadataLabel = (str?: string): boolean => {
    if (!str) return false;
    const normalized = str.trim().toLowerCase().replace(/[:\-–—]$/, '').trim();
    return GENERIC_METADATA_KEYS.has(normalized);
  };

  // Find underlying record by ID or title
  const findTaskRecord = (title?: string, id?: string): Responsibility | undefined => {
    if (id) {
      const byId = tasks.find(t => t.id === id);
      if (byId) return byId;
    }
    if (!title || isGenericMetadataLabel(title)) return undefined;
    const clean = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) return undefined;

    return tasks.find(t => {
      const tClean = t.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return tClean === clean || (tClean.length >= 6 && clean.length >= 6 && (tClean.includes(clean) || clean.includes(tClean)));
    });
  };

  const findEmailRecord = (senderOrSubject?: string, id?: string): EmailRecord | undefined => {
    if (id) {
      const byId = emails.find(e => e.id === id);
      if (byId) return byId;
    }
    if (!senderOrSubject || isGenericMetadataLabel(senderOrSubject)) return undefined;
    const clean = senderOrSubject.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) return undefined;

    return emails.find(e => {
      const sClean = (e.sender || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const subjClean = (e.subject || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return sClean.includes(clean) || clean.includes(sClean) || subjClean.includes(clean) || clean.includes(subjClean);
    });
  };

  const findCalendarRecord = (summary?: string, id?: string): CalendarEventRecord | undefined => {
    if (id) {
      const byId = calendarEvents.find(c => c.id === id);
      if (byId) return byId;
    }
    if (!summary || isGenericMetadataLabel(summary)) return undefined;
    const clean = summary.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) return undefined;

    return calendarEvents.find(c => {
      const cClean = (c.summary || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cClean === clean || (cClean.length >= 6 && clean.length >= 6 && (cClean.includes(clean) || clean.includes(cClean)));
    });
  };

  // Helper to format inline bold/italic
  const renderInlineFormatted = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|_.*?_)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return (
          <em key={pIdx} className="italic text-slate-600">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Priority indicator
  const renderPriorityDot = (priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'high') {
      return (
        <span 
          className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shrink-0 inline-block" 
          title="High Priority" 
        />
      );
    }
    if (p === 'medium') {
      return (
        <span 
          className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shrink-0 inline-block" 
          title="Medium Priority" 
        />
      );
    }
    return (
      <span 
        className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0 inline-block" 
        title="Low Priority" 
      />
    );
  };

  // Deadline badge formatter
  const formatDeadlineBadge = (task: Responsibility) => {
    if (!task.dueDate) return null;
    const d = new Date(task.dueDate);
    if (isNaN(d.getTime())) return task.dueDate;
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const dateStr = `${month} ${day}`;
    if (task.dueTime) {
      return `${dateStr} · ${task.dueTime}`;
    }
    return dateStr;
  };

  // Calendar Event time badge formatter
  const formatEventBadge = (event: CalendarEventRecord) => {
    if (!event.startTime) return null;
    const d = new Date(event.startTime);
    if (isNaN(d.getTime())) return event.startTime;
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const timeStr = event.startTime.includes('T') ? event.startTime.split('T')[1].substring(0, 5) : '';
    return timeStr ? `${month} ${day} · ${timeStr}` : `${month} ${day}`;
  };

  // Structured Block Parser for AI Answers
  const parseAssistantResponse = (content: string): ParsedBlock[] => {
    const lines = content.split('\n');
    const blocks: ParsedBlock[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Headings: ### Title or ## Title
      if (/^#{1,3}\s+/.test(line)) {
        const headingText = line.replace(/^#{1,3}\s+/, '').trim();
        blocks.push({
          type: 'heading',
          headingText
        });
        continue;
      }

      // 2. List item: * Item or - Item or • Item or 1. Item
      if (/^(\*|\-|•|\d+\.)\s+/.test(line)) {
        let itemContent = line.replace(/^(\*|\-|•|\d+\.)\s+/, '').trim();

        // Extract Source tag: [Source: ...] or (Source: ...)
        let sourceLabel: string | undefined;
        let sourceId: string | undefined;
        let sourceType: 'gmail' | 'calendar' | 'task' | undefined;

        const srcMatch = itemContent.match(/\[Source:\s*([^\]]+)\]|\(Source:\s*([^)]+)\)/i);
        if (srcMatch) {
          const rawSource = srcMatch[1] || srcMatch[2];
          itemContent = itemContent.replace(srcMatch[0], '').trim();

          // Extract ID if embedded
          const idMatch = rawSource.match(/\|\s*id:([a-zA-Z0-9_\-\.]+)/i);
          if (idMatch) {
            sourceId = idMatch[1];
          }

          sourceLabel = rawSource.replace(/\|\s*id:[a-zA-Z0-9_\-\.]+/i, '').trim();
          const lowerLabel = sourceLabel.toLowerCase();
          if (lowerLabel.includes('gmail')) {
            sourceType = 'gmail';
          } else if (lowerLabel.includes('calendar')) {
            sourceType = 'calendar';
          } else {
            sourceType = 'task';
          }
        }

        // Extract **Title** from the item
        let title: string | undefined;
        let explanation: string = itemContent;

        const titleMatch = itemContent.match(/^\*\*(.*?)\*\*\s*[:\-–—]?\s*(.*)$/);
        if (titleMatch) {
          const rawKey = titleMatch[1].trim();
          if (isGenericMetadataLabel(rawKey)) {
            // This is a sub-property or metadata line (e.g. "**Deadline:** Tomorrow", "**Action:** ...")
            // Attach it to the previous item block if one exists, rather than creating a fragmented fake card!
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.type === 'item') {
              lastBlock.details = lastBlock.details || [];
              lastBlock.details.push(itemContent);
              continue;
            } else {
              blocks.push({
                type: 'paragraph',
                text: itemContent,
                sourceType,
                sourceLabel,
                sourceId
              });
              continue;
            }
          }
          title = rawKey;
          explanation = titleMatch[2].trim();
        }

        blocks.push({
          type: 'item',
          title,
          explanation,
          sourceType,
          sourceLabel,
          sourceId
        });
        continue;
      }

      // 3. Regular Paragraph or Note
      blocks.push({
        type: 'paragraph',
        text: line
      });
    }

    return blocks;
  };

  // Section Heading Icon Helper
  const getSectionIcon = (heading: string) => {
    const h = heading.toLowerCase();
    if (h.includes('priority') || h.includes('task') || h.includes('action')) {
      return <CheckSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    }
    if (h.includes('ongoing') || h.includes('activity') || h.includes('program')) {
      return <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    }
    if (h.includes('event') || h.includes('calendar') || h.includes('upcoming')) {
      return <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
    }
    if (h.includes('email') || h.includes('mail')) {
      return <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
    }
    return <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  // Render clickable source badge
  const renderSourceBadge = (block: ParsedBlock) => {
    if (!block.sourceLabel && !block.sourceType) return null;

    const label = block.sourceLabel || (block.sourceType === 'gmail' ? 'Gmail' : block.sourceType === 'calendar' ? 'Calendar' : 'Task');
    const cleanLabel = label.replace(/^Source:\s*/i, '').replace(/^Gmail\s*-\s*/i, '').replace(/^Calendar\s*-\s*/i, '').trim();

    if (block.sourceType === 'gmail') {
      const matchedEmail = findEmailRecord(cleanLabel, block.sourceId);
      const isClickable = !!matchedEmail && !!onSelectEmail;

      if (isClickable) {
        return (
          <button
            onClick={() => onSelectEmail(matchedEmail.id)}
            title={`Open email: ${matchedEmail.subject || cleanLabel}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer group"
          >
            <Mail className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="truncate max-w-[200px]">{cleanLabel || 'Gmail'}</span>
            <ExternalLink className="w-2.5 h-2.5 text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        );
      }

      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
          <Mail className="w-3 h-3 text-rose-500 shrink-0" />
          <span className="truncate max-w-[200px]">{cleanLabel || 'Gmail'}</span>
        </span>
      );
    }

    if (block.sourceType === 'calendar') {
      const matchedEvent = findCalendarRecord(cleanLabel, block.sourceId);
      const isClickable = !!onSelectCalendarEvent;

      if (isClickable) {
        return (
          <button
            onClick={() => onSelectCalendarEvent(matchedEvent?.id || block.sourceId || '')}
            title="Open in Google Calendar view"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer group"
          >
            <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate max-w-[200px]">{cleanLabel || 'Calendar'}</span>
            <ExternalLink className="w-2.5 h-2.5 text-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        );
      }

      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
          <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
          <span className="truncate max-w-[200px]">{cleanLabel || 'Calendar'}</span>
        </span>
      );
    }

    // Task source
    const matchedTask = findTaskRecord(cleanLabel, block.sourceId);
    const isClickable = !!matchedTask && !!onSelectResponsibility;

    if (isClickable) {
      return (
        <button
          onClick={() => onSelectResponsibility(matchedTask)}
          title={`View responsibility: ${matchedTask.title}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold transition-colors cursor-pointer group"
        >
          <CheckSquare className="w-3 h-3 text-amber-600 shrink-0" />
          <span className="truncate max-w-[200px]">{cleanLabel || 'Responsibility'}</span>
          <ExternalLink className="w-2.5 h-2.5 text-amber-600 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
        <span>{cleanLabel || 'System'}</span>
      </span>
    );
  };

  // Structured response renderer for Assistant message
  const renderStructuredAssistantMessage = (content: string) => {
    const blocks = parseAssistantResponse(content);

    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          // 1. Heading
          if (block.type === 'heading' && block.headingText) {
            return (
              <div 
                key={idx} 
                className="flex items-center gap-2 pt-3 pb-1 border-b border-slate-100"
              >
                {getSectionIcon(block.headingText)}
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wide uppercase">
                  {block.headingText}
                </h3>
              </div>
            );
          }

          // 2. Structured Task or Event Item
          if (block.type === 'item') {
            const matchedTask = findTaskRecord(block.title, block.sourceId);
            const matchedEmail = findEmailRecord(block.title || block.sourceLabel, block.sourceId);
            const matchedEvent = findCalendarRecord(block.title, block.sourceId);

            const isTitleTaskClickable = !!matchedTask && !!onSelectResponsibility;
            const isTitleEmailClickable = !matchedTask && !!matchedEmail && !!onSelectEmail;
            const isTitleEventClickable = !matchedTask && !matchedEmail && !!matchedEvent && !!onSelectCalendarEvent;

            return (
              <div 
                key={idx} 
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition-all space-y-1.5 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {matchedTask && renderPriorityDot(matchedTask.priority)}
                    {block.title ? (
                      isTitleTaskClickable ? (
                        <button
                          onClick={() => onSelectResponsibility(matchedTask)}
                          className="text-xs sm:text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors text-left cursor-pointer truncate inline-flex items-center gap-1.5 group"
                          title="Click to view responsibility details"
                        >
                          <span className="truncate">{block.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity shrink-0" />
                        </button>
                      ) : isTitleEmailClickable ? (
                        <button
                          onClick={() => onSelectEmail(matchedEmail.id)}
                          className="text-xs sm:text-sm font-bold text-slate-900 hover:text-rose-600 transition-colors text-left cursor-pointer truncate inline-flex items-center gap-1.5 group"
                          title="Click to open in Gmail view"
                        >
                          <span className="truncate">{block.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-rose-500 transition-opacity shrink-0" />
                        </button>
                      ) : isTitleEventClickable ? (
                        <button
                          onClick={() => onSelectCalendarEvent(matchedEvent.id)}
                          className="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer truncate inline-flex items-center gap-1.5 group"
                          title="Click to open Calendar view"
                        >
                          <span className="truncate">{block.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity shrink-0" />
                        </button>
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {block.title}
                        </span>
                      )
                    ) : null}
                  </div>

                  {matchedTask?.dueDate ? (
                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1 shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>{formatDeadlineBadge(matchedTask)}</span>
                    </span>
                  ) : matchedEvent?.startTime ? (
                    <span className="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span>{formatEventBadge(matchedEvent)}</span>
                    </span>
                  ) : null}
                </div>

                {block.explanation && (
                  <p className="text-xs text-slate-700 leading-relaxed pl-0.5">
                    {renderInlineFormatted(block.explanation)}
                  </p>
                )}

                {block.details && block.details.length > 0 && (
                  <div className="space-y-1 pl-1 pt-0.5">
                    {block.details.map((detail, dIdx) => (
                      <p key={dIdx} className="text-xs text-slate-600 leading-relaxed">
                        {renderInlineFormatted(detail)}
                      </p>
                    ))}
                  </div>
                )}

                {(block.sourceLabel || block.sourceType) && (
                  <div className="pt-1 flex items-center gap-1.5">
                    {renderSourceBadge(block)}
                  </div>
                )}
              </div>
            );
          }

          // 3. Paragraph / Notes
          if (block.text) {
            let paragraphText = block.text;
            let pSourceLabel: string | undefined;
            let pSourceId: string | undefined;
            let pSourceType: 'gmail' | 'calendar' | 'task' | undefined;

            const srcMatch = paragraphText.match(/\[Source:\s*([^\]]+)\]|\(Source:\s*([^)]+)\)/i);
            if (srcMatch) {
              const rawSource = srcMatch[1] || srcMatch[2];
              paragraphText = paragraphText.replace(srcMatch[0], '').trim();
              const idMatch = rawSource.match(/\|\s*id:([a-zA-Z0-9_\-\.]+)/i);
              if (idMatch) pSourceId = idMatch[1];
              pSourceLabel = rawSource.replace(/\|\s*id:[a-zA-Z0-9_\-\.]+/i, '').trim();
              const lowerLabel = pSourceLabel.toLowerCase();
              if (lowerLabel.includes('gmail')) pSourceType = 'gmail';
              else if (lowerLabel.includes('calendar')) pSourceType = 'calendar';
              else pSourceType = 'task';
            }

            const isNote = paragraphText.toLowerCase().startsWith('note:');
            return (
              <div key={idx} className="space-y-1.5 py-0.5">
                <p 
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isNote 
                      ? 'text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-medium' 
                      : 'text-slate-700'
                  }`}
                >
                  {renderInlineFormatted(paragraphText)}
                </p>
                {pSourceLabel && (
                  <div className="pt-0.5 flex items-center gap-1.5">
                    {renderSourceBadge({
                      type: 'item',
                      sourceLabel: pSourceLabel,
                      sourceType: pSourceType,
                      sourceId: pSourceId
                    })}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  // Find previous user question for follow-ups
  const getLastUserQuestion = (msgIndex: number): string => {
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return '';
  };

  return (
    <div className={`rounded-3xl bg-white/95 border border-slate-200/90 shadow-xl backdrop-blur-xl overflow-hidden flex flex-col ${
      compact ? 'max-h-[480px]' : 'min-h-[620px] max-h-[820px]'
    }`}>
      {/* ── 1. Assistant Header ── */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#e2edf2] border border-[#d2e5ed] flex items-center justify-center shadow-xs text-[#34515e] shrink-0">
            <Sparkles className="w-5 h-5 text-[#34515e]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Ask LifeSynch
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2edf2] text-[#34515e] border border-[#d2e5ed]">
                AI Assistant
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Understand your day, deadlines, and responsibilities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              title="Start a new chat"
              className="px-3.5 py-1.5 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>New Chat</span>
            </button>
          )}
          {compact && onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('assistant')}
              title="Open full view"
              className="p-2 rounded-xl text-[#34515e] hover:text-[#283e48] hover:bg-[#e2edf2]/60 transition-colors text-xs flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span className="text-xs font-semibold">Full view</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Message History or Welcoming Empty State ── */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
        {messages.length === 0 ? (
          <div className="py-8 sm:py-12 px-4 text-center space-y-6 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#e2edf2] border border-[#d2e5ed] flex items-center justify-center mx-auto text-[#34515e] shadow-sm">
              <Bot className="w-6 h-6 text-[#34515e]" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                How can I assist you today?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                Ask about your daily schedule, upcoming deadlines, urgent responsibilities, or summarize recent emails from your connected accounts.
              </p>
            </div>

            {/* Clickable starter suggestions */}
            <div className="pt-2 space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Suggested Questions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    disabled={isLoading}
                    className="p-3.5 rounded-2xl bg-white hover:bg-[#e2edf2]/50 hover:border-[#34515e]/30 text-slate-700 hover:text-[#34515e] text-xs border border-slate-200/90 transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-xs active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="font-semibold group-hover:text-[#34515e] transition-colors">
                      {question}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#34515e] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isLatest = index === messages.length - 1;
            const lastUserQ = isUser ? msg.content : getLastUserQuestion(index);

            return (
              <div key={index} className="space-y-3">
                <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-2xs ${
                      isUser
                        ? 'bg-[#34515e] text-white font-bold'
                        : 'bg-[#e2edf2] border border-[#d2e5ed] text-[#34515e]'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed transition-all shadow-sm ${
                      isUser
                        ? 'bg-[#34515e] text-white rounded-tr-none shadow-[#34515e]/15'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    {isUser ? (
                      <div className="font-medium text-white">{msg.content}</div>
                    ) : (
                      renderStructuredAssistantMessage(msg.content)
                    )}

                    {msg.timestamp && (
                      <div
                        className={`text-xs mt-2.5 text-right ${
                          isUser ? 'text-slate-200 font-medium' : 'text-slate-400 font-medium'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Follow-up Suggestions after the latest completed response */}
                {!isUser && isLatest && !isLoading && (
                  <div className="pt-2 pl-10 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Sparkles className="w-3.5 h-3.5 text-[#34515e]" />
                      <span>Suggested follow-ups</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(msg.suggestedQuestions && msg.suggestedQuestions.length > 0
                        ? msg.suggestedQuestions
                        : getFollowUpSuggestions(lastUserQ)
                      ).map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSend(suggestion)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#e2edf2]/60 hover:border-[#34515e]/30 text-slate-700 hover:text-[#34515e] text-xs border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-[0.98] flex items-center gap-1.5 group disabled:opacity-50"
                        >
                          <span className="font-medium group-hover:text-[#34515e] transition-colors">
                            {suggestion}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-[#34515e] transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading state indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e2edf2] border border-[#d2e5ed] text-[#34515e] flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 text-xs text-slate-700 flex items-center gap-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34515e] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#34515e] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#34515e] animate-bounce" />
              </div>
              <span className="text-xs font-medium text-slate-600">
                LifeSynch is analyzing your schedule and messages...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 4. Bottom Input Row & Error Retry ── */}
      <div className="p-4 bg-white border-t border-slate-100 space-y-2">
        {error && (
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            {lastFailedQuestion && (
              <button
                onClick={handleRetry}
                className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold border border-rose-300 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about your responsibilities, schedule, or emails..."
            className="w-full pl-4 pr-12 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#34515e] focus:bg-white focus:ring-1 focus:ring-[#34515e]/30 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50 shadow-inner"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputQuestion.trim() || isLoading}
            aria-label="Send question"
            className="absolute right-1.5 p-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
