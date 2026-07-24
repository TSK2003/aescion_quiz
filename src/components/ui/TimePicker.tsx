import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface TimePickerProps {
  hour: string;
  minute: string;
  amPm: string;
  onHourChange: (val: string) => void;
  onMinuteChange: (val: string) => void;
  onAmPmChange: (val: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

export const TimePicker: React.FC<TimePickerProps> = ({
  hour, minute, amPm,
  onHourChange, onMinuteChange, onAmPmChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to selected values when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const hourIdx = HOURS.indexOf(hour);
        const minuteIdx = MINUTES.indexOf(minute);
        if (hourListRef.current && hourIdx >= 0) {
          hourListRef.current.scrollTop = hourIdx * 36;
        }
        if (minuteListRef.current && minuteIdx >= 0) {
          minuteListRef.current.scrollTop = minuteIdx * 36;
        }
      }, 0);
    }
  }, [isOpen, hour, minute]);

  const displayValue = `${hour}:${minute} ${amPm}`;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:border-primary transition-colors cursor-pointer"
      >
        <span className="font-medium">{displayValue}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-full min-w-[220px] bg-background border border-input rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header row showing selected values */}
          <div className="flex border-b border-border">
            <div className="flex-1 text-center py-2 font-bold text-sm text-white bg-blue-600 rounded-tl-lg">{hour}</div>
            <div className="flex-1 text-center py-2 font-bold text-sm text-white bg-blue-600">{minute}</div>
            <div className="flex-1 text-center py-2 font-bold text-sm text-white bg-blue-600 rounded-tr-lg">{amPm}</div>
          </div>

          {/* Scrollable columns */}
          <div className="flex h-[220px]">
            {/* Hours column */}
            <div ref={hourListRef} className="flex-1 overflow-y-auto border-r border-border scrollbar-thin">
              {HOURS.map(h => (
                <button
                  type="button"
                  key={h}
                  onClick={() => onHourChange(h)}
                  className={`w-full py-2 text-center text-sm transition-colors cursor-pointer
                    ${h === hour 
                      ? 'bg-blue-600 text-white font-semibold' 
                      : 'text-foreground hover:bg-muted'}`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Minutes column */}
            <div ref={minuteListRef} className="flex-1 overflow-y-auto border-r border-border scrollbar-thin">
              {MINUTES.map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => onMinuteChange(m)}
                  className={`w-full py-2 text-center text-sm transition-colors cursor-pointer
                    ${m === minute 
                      ? 'bg-blue-600 text-white font-semibold' 
                      : 'text-foreground hover:bg-muted'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* AM/PM column */}
            <div className="flex-1 flex flex-col">
              {PERIODS.map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => onAmPmChange(p)}
                  className={`w-full py-2 text-center text-sm transition-colors cursor-pointer
                    ${p === amPm 
                      ? 'bg-blue-600 text-white font-semibold' 
                      : 'text-foreground hover:bg-muted'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
