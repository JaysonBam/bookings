import { useEffect, useRef, useState } from 'react';

/** Keep unfinished input visible, but never leave an old valid value ready to save. */
export function useEntryDraft(value: string, display: (value: string) => string, parse: (draft: string) => string, onChange: (value: string) => void) {
  const [draft, setDraft] = useState(() => display(value));
  const lastPublished = useRef(value);
  useEffect(() => {
    if (value !== lastPublished.current) {
      setDraft(display(value));
      lastPublished.current = value;
    }
  }, [value, display]);
  const change = (text: string) => {
    setDraft(text);
    const parsed = parse(text);
    lastPublished.current = parsed;
    onChange(parsed);
  };
  return { draft, change };
}
