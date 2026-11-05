import React, { useState, useMemo } from 'react';
import { 
  Mail, 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  MapPin
} from 'lucide-react';
import { Responsibility } from '@lifesynch/shared';
import { IntelligentDiscovery } from '../../services/intelligentDiscoveryService';
import { LIFE_CATEGORIES } from '../../services/lifeCategoryService';
import { extractWorthKnowingDetails } from '../../utils/worthKnowingHelper';

export interface WorthKnowingDetailModalProps {
  discovery: IntelligentDiscovery | null;
  tasks?: Responsibility[];
  onClose: () => void;
  onOpenEmail?: (emailId: string) => void;
  onOpenCalendar?: (eventId: string) => void;
}

export const WorthKnowingDetailModal: React.FC<WorthKnowingDetailModalProps> = ({
  discovery,
  tasks = [],
  onClose,
  onOpenEmail,
  onOpenCalendar
}) => {
  const [showOriginalEmail, setShowOriginalEmail] = useState<boolean>(false);

  const details = useMemo(() => {
    if (!discovery) return null;
    return extractWorthKnowingDetails(discovery, tasks);
  }, [discovery, tasks]);

  if (!discovery || !details) return null;

  const categoryMeta = LIFE_CATEGORIES[details.category] || LIFE_CATEGORIES.general;

  const renderSourceCell = () => {
    if (details.sourceType === 'cross_source') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          <Mail className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>Gmail</span>
          <span className="text-slate-300">/</span>
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Calendar</span>
        </span>
      );
    }
    if (details.sourceType === 'calendar') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Calendar</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium">
        <Mail className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span>Gmail</span>
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-slate-800 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= Modal Header ================= */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider">
                Worth Knowing Details
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg border border-[#c2dde6] bg-[#e2edf2] text-[#34515e] uppercase tracking-wider">
                {categoryMeta.name.split(' ')[0]}
              </span>
              {details.badgeLabel && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider">
                  {details.badgeLabel}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 leading-snug">
              {details.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-lg leading-none shrink-0"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ================= Scrollable Modal Body ================= */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
          {/* 1. Action Required */}
          {details.action.isRequired ? (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                  Action Required
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  Action Needed
                </span>
              </div>
              <div className="pt-0.5 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed pr-1 text-xs sm:text-sm font-semibold text-slate-900">
                <p>{details.action.text}</p>
              </div>
              {details.action.subtext && (
                <p className="text-xs text-amber-800/80 font-normal">
                  {details.action.subtext}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#e2edf2]/50 border border-[#d2e5ed] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider block">
                  Action Required
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/80 text-[#34515e] border border-[#c2dde6]">
                  Informational
                </span>
              </div>
              <div className="pt-0.5 text-xs sm:text-sm font-medium text-slate-800">
                <p>{details.action.text}</p>
              </div>
              {details.action.subtext && (
                <p className="text-xs text-slate-600 font-normal">
                  {details.action.subtext}
                </p>
              )}
            </div>
          )}

          {/* 2. What Should I Know? (Key takeaway) */}
          <div className="p-3.5 rounded-2xl bg-[#e2edf2]/60 border border-[#d2e5ed] space-y-1.5">
            <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider block">
              What Should I Know?
            </span>
            <div className="max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed pr-1 text-xs sm:text-sm font-medium text-slate-800">
              <p>{details.whatShouldIKnow}</p>
            </div>
          </div>

          {/* 3. What Is This About? (Clear explanation) */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider block">
              What Is This About?
            </span>
            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200 pr-2 text-xs sm:text-sm text-slate-800 font-sans">
              <p>{details.about}</p>
            </div>
          </div>

          {/* 4. Important Details */}
          {(details.importantDetails.windowDates || 
            details.importantDetails.datesAndSchedule || 
            details.importantDetails.location ||
            details.importantDetails.connectedSources ||
            (details.importantDetails.announcementsOrInstructions && details.importantDetails.announcementsOrInstructions.length > 0)) && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider block">
                Important Details
              </span>

              {/* Application Window */}
              {details.importantDetails.windowDates && (
                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                  <span className="text-purple-700 font-semibold">Application Window:</span>
                  <span className="font-bold">
                    {details.importantDetails.windowDates.start || 'Opens'} → {details.importantDetails.windowDates.end || 'Closing date'}
                  </span>
                </div>
              )}

              {/* Scheduled timing */}
              {details.importantDetails.datesAndSchedule && (
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between">
                  <span className="text-indigo-700 font-semibold">Event Schedule:</span>
                  <span className="font-bold">{details.importantDetails.datesAndSchedule}</span>
                </div>
              )}

              {/* Location */}
              {details.importantDetails.location && (
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span><strong className="text-slate-800">Location:</strong> {details.importantDetails.location}</span>
                </div>
              )}

              {/* Key Instructions & Announcements */}
              {details.importantDetails.announcementsOrInstructions && details.importantDetails.announcementsOrInstructions.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Key Highlights & Instructions
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {details.importantDetails.announcementsOrInstructions.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Connected Thread Sources */}
              {details.importantDetails.connectedSources && details.importantDetails.connectedSources.length > 1 && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Connected Thread Updates ({details.importantDetails.connectedSources.length})
                  </span>
                  <div className="space-y-1 text-xs">
                    {details.importantDetails.connectedSources.map((cs, i) => (
                      <div key={i} className="flex items-center justify-between text-slate-600">
                        <span className="truncate max-w-[280px] font-medium">• {cs.title}</span>
                        {cs.date && <span className="text-slate-400 text-[11px] shrink-0">{cs.date}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Metadata Grid (Deadline, Category/Type, Source) */}
          <div className={`grid grid-cols-1 ${details.deadline ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5 text-xs pt-1`}>
            {/* Show Deadline ONLY if an actual deadline exists */}
            {details.deadline && (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">Deadline</span>
                <span className="text-rose-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>{details.deadline.formatted}</span>
                </span>
              </div>
            )}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block mb-1">Category & Type</span>
              <span className="capitalize text-slate-800 font-semibold">
                {categoryMeta.name.split(' ')[0]} • {details.badgeLabel}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block mb-1">Source</span>
              <div className="pt-0.5 flex items-center justify-center">
                {renderSourceCell()}
              </div>
            </div>
          </div>

          {/* Source Metadata */}
          {(details.source.sender || details.source.receivedAt) && (
            <div className="space-y-1 text-xs pt-1">
              {details.source.sender && (
                <p className="text-slate-600">
                  <span className="text-slate-400 font-medium">From:</span> {details.source.sender}
                </p>
              )}
              {details.source.receivedAt && (
                <p className="text-slate-600">
                  <span className="text-slate-400 font-medium">Received:</span> {new Date(details.source.receivedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* 6. Source: Original Email Details (available separately) */}
          {details.source.rawBody && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowOriginalEmail(prev => !prev)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Original Email Details</span>
                </div>
                <span className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
                  {showOriginalEmail ? 'Hide email body' : 'View email body'}
                  {showOriginalEmail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>
              {showOriginalEmail && (
                <div className="p-3.5 border-t border-slate-200 bg-white text-xs text-slate-700 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                  {details.source.rawBody}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= Modal Footer ================= */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {(details.sourceType === 'gmail' || details.sourceType === 'cross_source' || Boolean(details.source.sender)) && details.source.sourceId && onOpenEmail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEmail(details.source.sourceId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-800 border border-rose-200/80 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Mail className="w-3.5 h-3.5 text-rose-500" />
                <span>View Mail</span>
              </button>
            )}

            {(details.sourceType === 'calendar' || details.sourceType === 'cross_source' || Boolean(details.source.eventId)) && onOpenCalendar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (details.source.eventId) onOpenCalendar(details.source.eventId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200/80 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>View in Calendar</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

