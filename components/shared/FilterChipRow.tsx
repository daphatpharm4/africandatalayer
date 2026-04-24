import React from 'react';

export interface FilterChip<T extends string = string> {
  id: T;
  label: string;
}

interface Props<T extends string = string> {
  chips: ReadonlyArray<FilterChip<T>>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

function FilterChipRow<T extends string = string>({ chips, active, onChange, className = '' }: Props<T>) {
  return (
    <div className={`no-scrollbar flex gap-2 overflow-x-auto ${className}`}>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`chip shrink-0 motion-pressable px-3 ${active === c.id ? 'chip-active' : 'chip-idle'}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default FilterChipRow;
