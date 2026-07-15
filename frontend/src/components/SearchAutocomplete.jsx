/**
 * SearchAutocomplete — reusable autocomplete search bar
 *
 * Props:
 *   value          {string}   - current text input value (not used in topbar variant)
 *   onChange       {fn}       - called with new string on every keystroke
 *   onSelect       {fn}       - called with { id, title, slug } when user picks a suggestion
 *   onSubmit       {fn}       - called when user presses Enter or clears without picking
 *   placeholder    {string}
 *   className      {string}   - extra class on the root .sac-wrap
 *   variant        {string}   - 'default' | 'topbar'
 *                               'topbar' mode: self-contained, collapsed icon → expanded input,
 *                               shows course-only suggestions, navigates to /courses?q=...
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import './SearchAutocomplete.css';

export default function SearchAutocomplete({
  value = '',
  onChange,
  onSelect,
  onSubmit,
  placeholder = 'Search courses…',
  className = '',
  variant = 'default',
}) {
  const isTopbar = variant === 'topbar';
  const navigate = useNavigate();

  // ── Topbar-only state ───────────────────────────────────────────────────────
  const [expanded, setExpanded]       = useState(false);
  const [topbarQuery, setTopbarQuery] = useState('');

  // Shared state
  const [courses, setCourses]         = useState([]);
  const [mentors, setMentors]         = useState([]);
  const [isOpen, setIsOpen]           = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef    = useRef(null);
  const wrapRef     = useRef(null);
  const listRef     = useRef(null);
  const debounceRef = useRef(null);
  const ignoreBlur  = useRef(false);

  // In topbar mode, use internal query; otherwise use controlled value prop
  const activeQuery = isTopbar ? topbarQuery : value;

  // Total suggestion count for keyboard navigation
  const totalItems = isTopbar ? courses.length : courses.length + mentors.length;

  // ── Fetch suggestions ──────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) {
      setCourses([]);
      setMentors([]);
      setIsOpen(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.get(`/api/courses/autocomplete/?q=${encodeURIComponent(q)}`);
      const data = res.data;

      if (Array.isArray(data)) {
        setCourses(isTopbar ? data.slice(0, 6) : data);
        setMentors([]);
      } else {
        setCourses(isTopbar ? (data.courses || []).slice(0, 6) : (data.courses || []));
        setMentors(isTopbar ? [] : (data.mentors || []));
      }

      const total = Array.isArray(data)
        ? data.length
        : (data.courses?.length || 0) + (isTopbar ? 0 : (data.mentors?.length || 0));
      setIsOpen(total > 0 || q.length >= 2);
    } catch {
      setCourses([]);
      setMentors([]);
    } finally {
      setIsLoading(false);
    }
  }, [isTopbar]);

  // ── Debounce input ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!activeQuery.trim()) {
      setCourses([]);
      setMentors([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(activeQuery.trim()), 280);
    return () => clearTimeout(debounceRef.current);
  }, [activeQuery, fetchSuggestions]);

  // ── Outside-click handler (topbar only — default variant handles it via onBlur) ──
  useEffect(() => {
    if (!isTopbar) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
        setExpanded(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isTopbar]);

  // ── Resolve flat index to item ─────────────────────────────────────────────
  const getItemAtIndex = (idx) => {
    if (idx < courses.length) return { type: 'course', item: courses[idx] };
    const mentorIdx = idx - courses.length;
    if (mentorIdx < mentors.length) return { type: 'mentor', item: mentors[mentorIdx] };
    return null;
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          const resolved = isTopbar
            ? { type: 'course', item: courses[activeIndex] }
            : getItemAtIndex(activeIndex);
          if (resolved) handleSelect(resolved);
        } else {
          setIsOpen(false);
          if (isTopbar) goToSearch(topbarQuery);
          else onSubmit?.();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        if (isTopbar) setExpanded(false);
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
  const handleSelect = ({ type, item }) => {
    if (isTopbar) {
      goToSearch(item.title);
      return;
    }
    if (type === 'course') {
      onChange(item.title);
      onSelect?.(item);
    } else if (type === 'mentor') {
      onChange(item.name);
      onSubmit?.();
    }
    setCourses([]);
    setMentors([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  // ── Topbar: navigate to /courses?q=... ────────────────────────────────────
  const goToSearch = (q) => {
    if (!q?.trim()) return;
    setIsOpen(false);
    setExpanded(false);
    setTopbarQuery('');
    setCourses([]);
    navigate(`/courses?q=${encodeURIComponent(q.trim())}`);
  };

  // ── Highlight matching text ────────────────────────────────────────────────
  const highlight = (text, query) => {
    if (!query || !text) return text;
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

  const noResults = isOpen && courses.length === 0 && mentors.length === 0;

  // ── TOPBAR VARIANT ─────────────────────────────────────────────────────────
  if (isTopbar) {
    return (
      <div
        ref={wrapRef}
        className={`sac-wrap sac-wrap--topbar${expanded ? ' sac-topbar-expanded' : ''} ${className}`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Collapsed: icon-only button */}
        {!expanded && (
          <button
            className="sac-topbar-toggle"
            aria-label="Search courses"
            onClick={() => {
              setExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <i className="ti ti-search" />
          </button>
        )}

        {/* Expanded: inline search pill */}
        {expanded && (
          <>
            <i className="ti ti-search sac-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              id="topbar-course-search"
              type="text"
              className="sac-input"
              placeholder={placeholder}
              value={topbarQuery}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="sac-topbar-listbox"
              aria-activedescendant={activeIndex >= 0 ? `sac-topbar-item-${activeIndex}` : undefined}
              onChange={e => { setActiveIndex(-1); setTopbarQuery(e.target.value); }}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (courses.length > 0) setIsOpen(true); }}
              onBlur={() => {
                setTimeout(() => {
                  if (!ignoreBlur.current) {
                    setIsOpen(false);
                    if (!topbarQuery) setExpanded(false);
                  }
                  ignoreBlur.current = false;
                }, 150);
              }}
            />
            {isLoading && <span className="sac-spinner" aria-hidden="true" />}
            {topbarQuery && !isLoading && (
              <button
                className="sac-clear-btn"
                aria-label="Clear search"
                onClick={() => {
                  setTopbarQuery('');
                  setCourses([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </>
        )}

        {/* Dropdown */}
        {isOpen && expanded && (
          <ul
            ref={listRef}
            id="sac-topbar-listbox"
            className="sac-dropdown"
            role="listbox"
            aria-label="Course suggestions"
          >
            {noResults ? (
              <li className="sac-empty">No courses found</li>
            ) : (
              courses.map((s, idx) => (
                <li
                  key={s.id}
                  id={`sac-topbar-item-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`sac-item${idx === activeIndex ? ' sac-item--active' : ''}`}
                  onMouseDown={() => { ignoreBlur.current = true; }}
                  onClick={() => handleSelect({ type: 'course', item: s })}
                >
                  <i className="ti ti-book sac-item-icon" aria-hidden="true" />
                  <span className="sac-item-text">{highlight(s.title, topbarQuery)}</span>
                  <i className="ti ti-corner-down-left sac-item-arrow" aria-hidden="true" />
                </li>
              ))
            )}
            {/* "Search all" footer */}
            {topbarQuery && (
              <li
                className="sac-topbar-footer"
                role="option"
                onMouseDown={() => { ignoreBlur.current = true; }}
                onClick={() => goToSearch(topbarQuery)}
              >
                <i className="ti ti-search" aria-hidden="true" />
                <span>Search all courses for <strong>"{topbarQuery}"</strong></span>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  }

  // ── DEFAULT VARIANT ────────────────────────────────────────────────────────
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
          if (courses.length > 0 || mentors.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
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
            setCourses([]);
            setMentors([]);
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
          aria-label="Search suggestions"
        >
          {noResults ? (
            <li className="sac-empty">No results found</li>
          ) : (
            <>
              {/* Course suggestions */}
              {courses.length > 0 && (
                <>
                  <li className="sac-section-label" aria-hidden="true">
                    <i className="ti ti-book" /> Courses
                  </li>
                  {courses.map((s, idx) => (
                    <li
                      key={`c-${s.id}`}
                      id={`sac-item-${idx}`}
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={`sac-item ${idx === activeIndex ? 'sac-item--active' : ''}`}
                      onMouseDown={() => { ignoreBlur.current = true; }}
                      onClick={() => handleSelect({ type: 'course', item: s })}
                    >
                      <i className="ti ti-search sac-item-icon" aria-hidden="true" />
                      <span className="sac-item-text">
                        {highlight(s.title, value)}
                      </span>
                      <i className="ti ti-arrow-up-left sac-item-arrow" aria-hidden="true" />
                    </li>
                  ))}
                </>
              )}

              {/* Mentor suggestions */}
              {mentors.length > 0 && (
                <>
                  <li className="sac-section-label" aria-hidden="true">
                    <i className="ti ti-user" /> Mentors
                  </li>
                  {mentors.map((m, mIdx) => {
                    const flatIdx = courses.length + mIdx;
                    return (
                      <li
                        key={`m-${m.id}`}
                        id={`sac-item-${flatIdx}`}
                        role="option"
                        aria-selected={flatIdx === activeIndex}
                        className={`sac-item ${flatIdx === activeIndex ? 'sac-item--active' : ''}`}
                        onMouseDown={() => { ignoreBlur.current = true; }}
                        onClick={() => handleSelect({ type: 'mentor', item: m })}
                      >
                        <i className="ti ti-user sac-item-icon" aria-hidden="true" />
                        <span className="sac-item-text">
                          {highlight(m.name, value)}
                        </span>
                        <i className="ti ti-arrow-up-left sac-item-arrow" aria-hidden="true" />
                      </li>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
