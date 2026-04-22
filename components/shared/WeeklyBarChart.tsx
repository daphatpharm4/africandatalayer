import React from 'react';

interface Props {
  values: number[]; // length 7, Sun..Sat
  highlightIndex?: number;
  dayLabels?: string[]; // default ['S','M','T','W','T','F','S']
  showValues?: boolean;
}

const DEFAULT_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WeeklyBarChart: React.FC<Props> = ({
  values,
  highlightIndex,
  dayLabels = DEFAULT_LABELS,
  showValues = false,
}) => {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-[90px] items-end gap-2">
      {values.map((v, i) => {
        const height = Math.max(2, (v / max) * 70);
        const active = i === highlightIndex;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            {showValues && (
              <span className="text-[9px] font-semibold text-gray-400">{v}</span>
            )}
            <div
              className={`w-full rounded-t-md transition-[height] duration-500 ${active ? 'bg-navy' : 'bg-navy-light'}`}
              style={{ height }}
            />
            <span className="text-[9px] text-gray-400">{dayLabels[i] ?? DEFAULT_LABELS[i] ?? ''}</span>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(WeeklyBarChart);
