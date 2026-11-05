import { cleanEmailDescription } from '../../utils/textUtils';
import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, ExternalLink, X } from 'lucide-react';
import { CalendarEventRecord } from '@lifesynch/shared';

interface CalendarEventModalProps {
  event: CalendarEventRecord | null;
  onClose: () => void;
  onOpenCalendarTab?: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  event,
  onClose,
  onOpenCalendarTab
}) => {
  if (!event) return null;

  const formatDateTime = (startStr: string, endStr?: string) => {
    try {
      const start = new Date(startStr);
      const dateText = start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const timeText = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      if (endStr) {
        const end = new Date(endStr);
        const endTime = end.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        return { date: dateText, time: `${timeText} – ${endTime}` };
      }
      return { date: dateText, time: timeText };
    } catch {
      return { date: startStr, time: '' };
    }
  };

  const { date, time } = formatDateTime(event.startTime, event.endTime);

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-slate-800 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#34515e] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar Event Details
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {event.summary || '(Untitled Event)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-lg leading-none"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {/* Date and Time Info */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{date}</span>
          </div>
          {time && (
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{time}</span>
            </div>
          )}
        </div>

        {/* Location if present */}
        {event.location && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 block">Location:</span>
              <p className="text-slate-600 mt-0.5">{event.location}</p>
            </div>
          </div>
        )}

        {/* Description if present */}
        {event.description && (
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Description</span>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap p-3 rounded-2xl bg-slate-50 border border-slate-100">
              {cleanEmailDescription(event.description)}
            </p>
          </div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Attendees ({event.attendees.length})
            </span>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {event.attendees.map((attendee, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-800 font-medium truncate">
                    {attendee.displayName || attendee.email}
                  </span>
                  {attendee.responseStatus && (
                    <span className="text-[10px] uppercase font-semibold text-slate-500 ml-2 shrink-0">
                      {attendee.responseStatus}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          {onOpenCalendarTab && (
            <button
              onClick={() => {
                onClose();
                onOpenCalendarTab();
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition-colors"
            >
              View in Calendar Tab →
            </button>
          )}

          {event.htmlLink ? (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto px-4 py-2 rounded-xl bg-[#34515e] hover:bg-[#283e48] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <span>Google Calendar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

