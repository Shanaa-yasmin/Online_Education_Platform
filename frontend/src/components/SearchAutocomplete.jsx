/**
 * SearchAutocomplete — reusable autocomplete search bar
 *
 * Props:
 *   value          {string}   - current text input value
 *   onChange       {fn}       - called with new string on every keystroke
 *   onSelect       {fn}       - called with { id, title, slug } when user picks a suggestion
 *   onSubmit       {fn}       - called when user presses Enter or clears without picking
 *   placeholder    {string}
 *   className      {string}   - extra class on the root .sac-wrap
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api.js';
import './SearchAutocomplete.css';

export default function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  onSubmit,
  placeholder = 'Search courses…',
  className = '',
}) {
  const [suggestions, setSuggestions]       = useState([]);
  const [isOpen, setIsOpen]                 = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [activeIndex, setActiveIndex]       = useState(-1);

  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const debounceRef = useRef(null);
  const ignoreBlur  = useRef(false);       // prevents dropdown closing on item click

  // ── Fetch suggestions ──────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.get(`/api/courses/autocomplete/?q=${encodeURIComponent(q)}`);
      setSuggestions(res.data || []);
      setIsOpen((res.data || []).length > 0 || q.length >= 2);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Debounce input ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelect(suggestions[activeIndex]);
        } else {
          setIsOpen(false);
          onSubmit?.();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // ── Scroll active item into view ───────────────────────────────────────────
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.sac-item');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // ── Select a suggestion ────────────────────────────────────────────────────
  const handleSelect = (suggestion) => {
    onChange(suggestion.title);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect?.(suggestion);
  };

  // ── Highlight matching text ────────────────────────────────────────────────
  const highlight = (text, query) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="sac-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className={`sac-wrap ${className}`} role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
      {/* Search icon */}
      <i className="ti ti-search sac-icon" aria-hidden="true" />

      {/* Input */}
      <input
        ref={inputRef}
        id="course-search-input"
        type="text"
        className="sac-input"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="sac-listbox"
        aria-activedescendant={activeIndex >= 0 ? `sac-item-${activeIndex}` : undefined}
        onChange={e => {
          setActiveIndex(-1);
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          // slight delay so mousedown on a suggestion fires first
          setTimeout(() => {
            if (!ignoreBlur.current) setIsOpen(false);
            ignoreBlur.current = false;
          }, 150);
        }}
      />

      {/* Loading spinner */}
      {isLoading && <span className="sac-spinner" aria-hidden="true" />}

      {/* Clear button */}
      {value && !isLoading && (
        <button
          className="sac-clear-btn"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            setSuggestions([]);
            setIsOpen(false);
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          id="sac-listbox"
          className="sac-dropdown"
          role="listbox"
          aria-label="Course suggestions"
        >
          {suggestions.length === 0 ? (
            <li className="sac-empty">No courses found</li>
          ) : (
            suggestions.map((s, idx) => (
              <li
                key={s.id}
                id={`sac-item-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                className={`sac-item ${idx === activeIndex ? 'sac-item--active' : ''}`}
                onMouseDown={() => { ignoreBlur.current = true; }}
                onClick={() => handleSelect(s)}
              >
                <i className="ti ti-search sac-item-icon" aria-hidden="true" />
                <span className="sac-item-text">
                  {highlight(s.title, value)}
                </span>
                <i className="ti ti-arrow-up-left sac-item-arrow" aria-hidden="true" />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
