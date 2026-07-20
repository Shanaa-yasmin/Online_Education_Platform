import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './LearningPlayer.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);
const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);
const QuizIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" x2="12.01" y1="17" y2="17" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
);
const FlagIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const ReplyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

function getYouTubeEmbedUrl(url, startSeconds = 0) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let videoId = null;
    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0];
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2];
      } else {
        videoId = parsed.searchParams.get('v');
      }
    }
    if (videoId) {
      let embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
      if (startSeconds > 0) {
        embedUrl += `&start=${startSeconds}`;
      }
      return embedUrl;
    }
  } catch (_) { }
  return url;
}

// ── Q&A Chat Panel Component ────────────────────────────────────────────────
export function QAPanel({ courseId, user }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);   // { id, username }
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | open | closed
  const [loadingHistory, setLH] = useState(true);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const isMod = user?.role === 'ADMIN' || user?.role === 'MENTOR';

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load message history from REST API
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLH(true);
        const res = await api.get(`/api/chat/messages/course/${courseId}/`);
        setMessages(res.data.results || res.data);
      } catch (err) {
        console.error('[Q&A] Failed to load message history:', err);
      } finally {
        setLH(false);
      }
    };
    loadHistory();
  }, [courseId]);

  // Open WebSocket connection
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsBase = apiUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/course/${courseId}/qa/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('open');
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'chat_message') {
          setMessages(prev => {
            // Avoid duplicate if the message ID already exists
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        } else if (data.type === 'flag_message') {
          setMessages(prev => prev.map(m =>
            m.id === data.message_id ? { ...m, is_flagged_abuse: true } : m
          ));
        } else if (data.type === 'hide_message') {
          if (data.is_hidden && user?.role === 'STUDENT') {
            setMessages(prev => prev.filter(m => m.id !== data.message_id));
          } else {
            setMessages(prev => prev.map(m =>
              m.id === data.message_id ? { ...m, is_hidden: data.is_hidden } : m
            ));
          }
        } else if (data.type === 'delete_message') {
          setMessages(prev => prev.filter(m => m.id !== data.message_id));
        }
      } catch (err) {
        console.error('[Q&A] ws.onmessage parse error:', err);
      }
    };

    ws.onerror = () => setWsStatus('closed');
    ws.onclose = () => setWsStatus('closed');

    return () => ws.close();
  }, [courseId, user, token]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      action: 'send_message',
      message_text: text,
      parent_id: replyTo?.id ?? null,
    }));
    setInputText('');
    setReplyTo(null);
  }, [inputText, replyTo]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const flagMessage = (id) => {
    wsRef.current?.send(JSON.stringify({ action: 'flag_message', message_id: id }));
  };

  const hideMessage = (id, hidden) => {
    wsRef.current?.send(JSON.stringify({ action: 'hide_message', message_id: id, is_hidden: hidden }));
  };

  const deleteMessage = (id) => {
    if (!window.confirm('Delete this message permanently?')) return;
    wsRef.current?.send(JSON.stringify({ action: 'delete_message', message_id: id }));
  };

  // Group messages: top-level + replies
  const topLevel = messages.filter(m => !m.parent_id);
  const repliesFor = (parentId) => messages.filter(m => m.parent_id === parentId);

  const avatarLetter = (username) => (username?.[0] ?? '?').toUpperCase();
  const avatarColor = (username) => {
    const colors = ['#309d8e', '#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];
    let code = 0;
    for (const ch of (username ?? '')) code += ch.charCodeAt(0);
    return colors[code % colors.length];
  };

  const renderMessage = (msg, isReply = false) => {
    const isOwn = msg.sender?.id === user?.id;
    const canMod = isMod || isOwn;
    const hidden = msg.is_hidden;

    return (
      <div key={msg.id} className={`qa-msg ${isReply ? 'qa-msg-reply' : ''} ${hidden ? 'qa-msg-hidden' : ''}`}>
        <div className="qa-msg-avatar" style={{ background: avatarColor(msg.sender?.username) }}>
          {avatarLetter(msg.sender?.username)}
        </div>
        <div className="qa-msg-body">
          <div className="qa-msg-meta">
            <span className="qa-sender">{msg.sender?.username}</span>
            {msg.sender?.role === 'MENTOR' && <span className="qa-badge-mentor">Mentor</span>}
            {msg.sender?.role === 'ADMIN' && <span className="qa-badge-admin">Admin</span>}
            <span className="qa-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {msg.is_flagged_abuse && <span className="qa-badge-flagged">🚩 Flagged</span>}
            {hidden && isMod && <span className="qa-badge-hidden">Hidden</span>}
          </div>
          <p className="qa-msg-text">{msg.message_text}</p>
          <div className="qa-msg-actions">
            {!isReply && (
              <button className="qa-action-btn" onClick={() => setReplyTo({ id: msg.id, username: msg.sender?.username })}>
                <ReplyIcon /> Reply
              </button>
            )}
            {!msg.is_flagged_abuse && !isOwn && (
              <button className="qa-action-btn warn" onClick={() => flagMessage(msg.id)}>
                <FlagIcon /> Flag
              </button>
            )}
            {isMod && (
              <button className="qa-action-btn warn" onClick={() => hideMessage(msg.id, !hidden)}>
                <EyeOffIcon /> {hidden ? 'Unhide' : 'Hide'}
              </button>
            )}
            {canMod && (
              <button className="qa-action-btn danger" onClick={() => deleteMessage(msg.id)}>
                <TrashIcon /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="qa-panel">
      {/* Status bar */}
      <div className={`qa-status-bar ${wsStatus}`}>
        <span className="ws-dot" />
        {wsStatus === 'open' ? 'Live • Connected' : wsStatus === 'connecting' ? 'Connecting...' : '⚠ Disconnected — refresh to reconnect'}
      </div>

      {/* Message List */}
      <div className="qa-messages-list">
        {loadingHistory ? (
          <div className="qa-loading"><div className="loading-spinner" /><p>Loading Q&A history…</p></div>
        ) : messages.length === 0 ? (
          <div className="qa-empty">
            <span>💬</span>
            <p>No questions yet. Be the first to ask!</p>
          </div>
        ) : (
          topLevel.map(msg => (
            <div key={msg.id} className="qa-thread">
              {renderMessage(msg)}
              {repliesFor(msg.id).map(reply => renderMessage(reply, true))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="qa-compose">
        {replyTo && (
          <div className="qa-reply-banner">
            Replying to <strong>@{replyTo.username}</strong>
            <button onClick={() => setReplyTo(null)} className="qa-reply-cancel">✕</button>
          </div>
        )}
        <div className="qa-compose-row">
          <textarea
            className="qa-input"
            rows={1}
            placeholder="Ask a question or post a reply…"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="qa-send-btn"
            onClick={sendMessage}
            disabled={!inputText.trim() || wsStatus !== 'open'}
          >
            <SendIcon />
          </button>
        </div>
        <p className="qa-hint">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function LearningPlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [completedLessons, setCompletedLessons] = useState({});
  const [activeLesson, setActiveLesson] = useState(null);

  // Read initial tab parameter
  const searchParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'lesson'); // 'lesson' | 'qa'

  // Update active tab when URL changes (deep linking)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'qa' || tab === 'lesson' || tab === 'curriculum') {
      setActiveTab(tab);
    }
  }, [location.search]);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [syllabusOpen, setSyllabusOpen] = useState(false);


  // ── Quiz attempt state (matches QuizAttemptViewSet: start / submit / history) ──
  const [quizAttempt, setQuizAttempt] = useState(null);   // { attempt_id, attempt_number, time_limit_minutes, started_at, questions }
  const [quizAnswers, setQuizAnswers] = useState({});     // { [question_id]: { selected_option_ids: [], text_answer: '' } }
  const [quizResult, setQuizResult] = useState(null);   // graded QuizAttemptSerializer payload
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizTimeLeft, setQuizTimeLeft] = useState(null);   // seconds remaining, or null if untimed

  const lastSavedPositionRef = useRef(0);

  useEffect(() => {
    const handleYTMessage = async (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.event === 'infoDelivery' && data.info && data.info.currentTime !== undefined && activeLesson?.content_type === 'VIDEO') {
          const currentTime = Math.round(data.info.currentTime);
          if (currentTime !== lastSavedPositionRef.current && currentTime % 5 === 0) {
            lastSavedPositionRef.current = currentTime;
            await api.patch('/api/progress/video-position/', {
              lesson_id: activeLesson.id,
              video_position_seconds: currentTime
            });
          }
        }
      } catch (err) { }
    };
    window.addEventListener('message', handleYTMessage);
    return () => window.removeEventListener('message', handleYTMessage);
  }, [activeLesson?.id, activeLesson?.content_type]);

  const loadLearningData = useCallback(async () => {
    if (!courseId || courseId === 'undefined') {
      setError('Invalid course ID.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const [courseResponse, enrollResponse, progressRes] = await Promise.all([
        api.get(`/api/courses/${courseId}/`),
        api.get(`/api/payments/enrollments/check/?course_id=${courseId}`),
        api.get(`/api/progress/course/${courseId}/`).catch(err => {
          console.error("Failed to load progress details:", err);
          return null;
        })
      ]);

      const courseData = courseResponse.data;
      setCourse(courseData);

      if (!enrollResponse.data.enrolled) { navigate(`/courses/${courseId}`); return; }
      setEnrollment(enrollResponse.data);

      const completedMap = {};
      if (enrollResponse.data.completed_lessons) {
        enrollResponse.data.completed_lessons.forEach(id => {
          completedMap[id] = true;
        });
      }

      let initialLesson = null;
      if (progressRes && progressRes.data) {
        const progData = progressRes.data;

        if (progData.completed_lessons) {
          progData.completed_lessons.forEach(id => {
            completedMap[id] = true;
          });
        }

        const resumeId = progData.resume_position?.lesson_id;
        if (resumeId) {
          const flatLessons = courseData.modules?.flatMap(m => m.lessons ?? []) ?? [];
          const found = flatLessons.find(l => l.id === resumeId);
          if (found) {
            initialLesson = found;
            initialLesson.start_seconds = progData.resume_position.video_position_seconds || 0;
          }
        }
      }
      setCompletedLessons(completedMap);

      const params = new URLSearchParams(window.location.search);
      const queryLessonId = params.get('lesson');
      const flatLessons = courseData.modules?.flatMap(m => m.lessons ?? []) ?? [];

      if (queryLessonId) {
        const foundQueryLesson = flatLessons.find(l => String(l.id) === queryLessonId);
        if (foundQueryLesson) {
          initialLesson = foundQueryLesson;
        }
      }

      if (!initialLesson && courseData.modules?.length > 0 && courseData.modules[0].lessons?.length > 0) {
        initialLesson = courseData.modules[0].lessons[0];
      }
      setActiveLesson(initialLesson);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load classroom content.');
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { if (user) loadLearningData(); }, [user?.id, loadLearningData]);

  // ── Start (or resume) a quiz attempt whenever a QUIZ lesson becomes active ──
  const startQuiz = async (lessonId) => {
    setQuizLoading(true);
    setQuizError('');
    setQuizResult(null);
    setQuizAnswers({});
    try {
      const res = await api.post(`/api/quiz-attempts/lessons/${lessonId}/start/`);
      setQuizAttempt(res.data);
      setQuizTimeLeft(res.data.time_limit_minutes ? res.data.time_limit_minutes * 60 : null);
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setQuizAttempt(null);
      setQuizTimeLeft(null);
      setQuizError(err.response?.data?.detail || 'Failed to load quiz.');
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    if (activeLesson?.content_type === 'QUIZ') {
      startQuiz(activeLesson.id);
    } else {
      setQuizAttempt(null);
      setQuizResult(null);
      setQuizAnswers({});
      setQuizError('');
      setQuizTimeLeft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id]);

  // ── Countdown timer — auto-submits when it hits zero ──
  useEffect(() => {
    if (quizTimeLeft === null || quizResult) return;
    if (quizTimeLeft <= 0) {
      submitQuiz();
      return;
    }
    const timer = setTimeout(() => setQuizTimeLeft(t => (t !== null ? t - 1 : t)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizTimeLeft, quizResult]);

  const setOptionAnswer = (questionId, optionId, questionType) => {
    setQuizAnswers(prev => {
      const current = prev[questionId]?.selected_option_ids || [];
      let next;
      if (questionType === 'MULTIPLE_CHOICE') {
        next = current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
      } else {
        next = [optionId];
      }
      return { ...prev, [questionId]: { selected_option_ids: next, text_answer: null } };
    });
  };

  const setTextAnswer = (questionId, text) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: { selected_option_ids: [], text_answer: text } }));
  };

  const submitQuiz = async () => {
    if (!quizAttempt || quizSubmitting) return;
    setQuizSubmitting(true);
    setQuizError('');
    try {
      const answers = quizAttempt.questions.map(q => ({
        question_id: q.id,
        selected_option_ids: quizAnswers[q.id]?.selected_option_ids || [],
        text_answer: quizAnswers[q.id]?.text_answer ?? '',
      }));
      const res = await api.post(`/api/quiz-attempts/${quizAttempt.attempt_id}/submit/`, { answers });
      setQuizResult(res.data);
      setQuizTimeLeft(null);
    } catch (err) {
      console.error('Quiz submission failed:', err);
      setQuizError(err.response?.data?.detail || 'Failed to submit quiz.');
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleLessonClick = async (lesson) => {
    setActiveLesson(lesson);
    setActiveTab('lesson');
    setSyllabusOpen(false);


    try {
      await api.post(`/api/progress/lesson/${lesson.id}/resume/`);
    } catch (err) {
      console.error("Failed to post resume:", err);
    }
  };

  const handleMarkComplete = async () => {
    if (!activeLesson || completing) return;
    setCompleting(true);
    try {
      const response = await api.post(`/api/progress/lesson/${activeLesson.id}/complete/`);
      setCompletedLessons(prev => ({ ...prev, [activeLesson.id]: true }));
      setEnrollment(prev => ({ ...prev, progress_percent: response.data.completion_percentage }));
      advanceNextLesson();
    } catch (err) {
      console.error(err);
      alert('Failed to update progress.');
    } finally {
      setCompleting(false);
    }
  };

  const advanceNextLesson = () => {
    if (!course || !activeLesson) return;
    const flatLessons = course.modules?.flatMap(m => m.lessons ?? []) ?? [];
    const idx = flatLessons.findIndex(l => l.id === activeLesson.id);
    if (idx !== -1 && idx < flatLessons.length - 1) {
      handleLessonClick(flatLessons[idx + 1]);
    } else {
      setShowCompletionModal(true);
    }
  };

  const getLessonTypeIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF': return <FileTextIcon />;
      case 'QUIZ': return <QuizIcon />;
      default: return <FileTextIcon />;
    }
  };

  if (loading) return (
    <div className="player-loading-page"><div className="loading-spinner" /><p>Entering the Classroom...</p></div>
  );

  if (error || !course || !enrollment) return (
    <div className="player-error-page">
      <h2>Access Denied</h2>
      <p className="alert alert-error">{error || 'Please make sure you are enrolled.'}</p>
      <Link to={`/courses/${courseId}`} className="btn btn-primary">Return to Course Syllabus</Link>
    </div>
  );

  return (
    <div className="learning-player-layout">
      {/* Sidebar Syllabus */}
      <aside className={`player-sidebar ${syllabusOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {/* Close button on mobile */}
          <button className="mobile-syllabus-close-btn" onClick={() => setSyllabusOpen(false)}>✕</button>

          <button onClick={() => navigate(`/courses/${courseId}`, { replace: true, state: { fromCheckout: location.state?.fromCheckout } })} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            <ArrowLeftIcon /> Back
          </button>
          <h2 className="sidebar-course-title">{course.title}</h2>
          <div className="progress-indicator">
            <div className="progress-header">
              <span>Overall Progress</span>
              <span>{enrollment.progress_percent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${enrollment.progress_percent}%` }} />
            </div>
          </div>
        </div>
        <nav className="sidebar-syllabus">
          {course.modules?.map((module, mIdx) => (
            <div key={module.id} className="syllabus-module">
              <h3 className="module-title-heading">M{mIdx + 1}: {module.title}</h3>
              <div className="module-lessons-menu">
                {module.lessons?.map(lesson => {
                  const isActive = activeLesson?.id === lesson.id;
                  const isDone = !!completedLessons[lesson.id];
                  return (
                    <button key={lesson.id}
                      className={`syllabus-lesson-btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                      onClick={() => handleLessonClick(lesson)}
                    >
                      <span className="completion-check">{isDone ? <CheckIcon /> : <CircleIcon />}</span>
                      <span className="lesson-type-tag">{getLessonTypeIcon(lesson.content_type)}</span>
                      <span className="lesson-name">{lesson.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {syllabusOpen && (
        <div className="syllabus-backdrop-overlay" onClick={() => setSyllabusOpen(false)} />
      )}

      {/* Main Content Area */}
      <main className="player-main-area">
        {/* Mobile Header (visible on mobile only) */}
        <div className="player-mobile-header">
          <button 
            className="mobile-syllabus-toggle-btn"
            onClick={() => setSyllabusOpen(true)}
          >
            <i className="ti ti-menu-2" style={{ marginRight: 6 }} />
            <span>Syllabus</span>
          </button>
          <button 
            onClick={() => navigate(`/courses/${courseId}`, { replace: true, state: { fromCheckout: location.state?.fromCheckout } })} 
            className="mobile-back-btn"
          >
            <ArrowLeftIcon /> Back
          </button>
        </div>

        {/* Tab Bar */}
        <div className="player-tab-bar">
          <button
            className={`player-tab-btn ${activeTab === 'lesson' ? 'active' : ''}`}
            onClick={() => setActiveTab('lesson')}
          >
            📖 Lesson
          </button>
          <button
            className={`player-tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
          >
            💬 Q&amp;A Discussion
          </button>
        </div>

        {/* ── Lesson Tab ─────────────────────────────────── */}
        {activeTab === 'lesson' && (
          activeLesson ? (
            <div className="active-lesson-container">
              <div className="lesson-header">
                <h1 className="active-lesson-title">{activeLesson.title}</h1>
                <span className="active-lesson-badge">{activeLesson.content_type} Lesson</span>
              </div>

              <div className="lesson-content-body">
                {/* VIDEO */}
                {activeLesson.content_type === 'VIDEO' && (
                  <div className="video-player-wrapper">
                    {activeLesson.file_attachment ? (
                      <div className="yt-embed-container">
                        <video
                          src={activeLesson.file_attachment}
                          controls
                          controlsList="nodownload"
                          playsInline
                          className="yt-iframe"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                        />
                      </div>
                    ) : activeLesson.video_url ? (
                      <div className="yt-embed-container">
                        <iframe
                          src={getYouTubeEmbedUrl(activeLesson.video_url, activeLesson.start_seconds || 0)}
                          title={activeLesson.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="yt-iframe"
                        />
                      </div>
                    ) : (
                      <div className="alert alert-warning">No video link or file attachment provided for this lesson.</div>
                    )}
                    {activeLesson.body_text && (
                      <div className="lesson-summary-box">
                        <h3>Lecture Notes</h3>
                        <p>{activeLesson.body_text}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF */}
                {activeLesson.content_type === 'PDF' && (
                  <div className="pdf-viewer-wrapper">
                    <div className="mock-pdf-screen">
                      <FileTextIcon />
                      <h3>PDF Reference Guide</h3>
                      <p>Click below to download or view the lecture attachment material.</p>
                      {activeLesson.file_attachment ? (
                        <a href={activeLesson.file_attachment} target="_blank" rel="noreferrer" className="btn btn-secondary">
                          <DownloadIcon /> Download File Attachment
                        </a>
                      ) : (
                        <span className="no-attachment-text">No reference attachment uploaded for this lesson.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* DOCUMENT */}
                {activeLesson.content_type === 'DOCUMENT' && (
                  <div className="document-viewer-wrapper">
                    <div className="rich-document-card">
                      <p className="document-paragraph">{activeLesson.body_text || 'No summary text content is available for this lesson.'}</p>
                    </div>
                  </div>
                )}

                {/* QUIZ */}
                {activeLesson.content_type === 'QUIZ' && (
                  <div className="quiz-player-wrapper">
                    {quizLoading ? (
                      <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
                        <div className="loading-spinner" />
                        <p>Loading quiz…</p>
                      </div>
                    ) : quizError && !quizAttempt ? (
                      <div className="alert alert-error">{quizError}</div>
                    ) : quizResult ? (
                      <div className="quiz-result-card animate-scaleIn">
                        <div className="trophy-icon">{quizResult.passed ? '🏆' : '📝'}</div>
                        <h2>{quizResult.passed ? 'Quiz Passed!' : 'Quiz Submitted'}</h2>
                        <p className="score-desc">
                          You scored <strong>{quizResult.score_points}</strong> out of <strong>{quizResult.total_points}</strong> points.
                        </p>
                        <div className="percentage-score">{quizResult.score_percent}%</div>
                        {!quizResult.passed && (
                          <p className="alert alert-warning">
                            You needed {activeLesson.passing_score_percent}% to pass this quiz.
                          </p>
                        )}
                        {quizResult.warning && <p className="alert alert-warning">{quizResult.warning}</p>}

                        <div style={{ textAlign: 'left', width: '100%', margin: '10px 0 4px' }}>
                          {quizResult.answers.map((ans, i) => (
                            <div
                              key={ans.question_id}
                              className="lesson-summary-box"
                              style={{
                                marginBottom: 10,
                                borderColor: ans.is_correct ? '#B2D9C2' : '#F5CCCC',
                                background: ans.is_correct ? '#F3FAF6' : '#FFF6F6',
                              }}
                            >
                              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{i + 1}. {ans.question_text}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: ans.is_correct ? '#1A6B3A' : '#8B0000' }}>
                                  {ans.is_correct ? '✓ Correct' : '✗ Incorrect'} · {ans.points_awarded} pt{ans.points_awarded === 1 ? '' : 's'}
                                </span>
                              </h3>
                              {ans.question_type === 'FILL_BLANK' && (
                                <p>Your answer: <em>{ans.text_answer || '(left blank)'}</em></p>
                              )}
                              {ans.explanation && <p>💡 {ans.explanation}</p>}
                            </div>
                          ))}
                        </div>

                        <div className="result-actions">
                          <button className="btn btn-secondary" onClick={() => startQuiz(activeLesson.id)}>Retry Quiz</button>
                          <button className="btn btn-primary" onClick={handleMarkComplete}>Mark Lesson Complete</button>
                        </div>
                      </div>
                    ) : quizAttempt ? (
                      <div className="quiz-question-card animate-fadeIn">
                        <div className="quiz-card-header">
                          <span>
                            Attempt #{quizAttempt.attempt_number}
                            {activeLesson.max_quiz_attempts ? ` of ${activeLesson.max_quiz_attempts}` : ''}
                          </span>
                          {quizTimeLeft !== null && (
                            <span className="score-track-tag">
                              ⏱ {Math.floor(quizTimeLeft / 60)}:{String(quizTimeLeft % 60).padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        {quizError && <div className="alert alert-error">{quizError}</div>}

                        {quizAttempt.questions.map((q, i) => (
                          <div
                            key={q.id}
                            style={{
                              paddingBottom: 20,
                              marginBottom: i < quizAttempt.questions.length - 1 ? 20 : 0,
                              borderBottom: i < quizAttempt.questions.length - 1 ? '1px solid var(--border-c)' : 'none',
                            }}
                          >
                            <h3 className="quiz-question-text" style={{ marginBottom: 14 }}>
                              {i + 1}. {q.question_text}{' '}
                              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-2)' }}>
                                ({q.points} pt{q.points === 1 ? '' : 's'})
                              </span>
                            </h3>

                            {q.question_type === 'FILL_BLANK' ? (
                              <input
                                type="text"
                                value={quizAnswers[q.id]?.text_answer || ''}
                                onChange={(e) => setTextAnswer(q.id, e.target.value)}
                                placeholder="Type your answer…"
                                style={{
                                  width: '100%',
                                  padding: '13px 18px',
                                  borderRadius: 12,
                                  border: '1.5px solid var(--border-c)',
                                  fontSize: '13.5px',
                                  fontFamily: 'Inter, sans-serif',
                                  outline: 'none',
                                }}
                              />
                            ) : (
                              <div className="quiz-options-list">
                                {q.options.map(opt => {
                                  const selected = (quizAnswers[q.id]?.selected_option_ids || []).includes(opt.id);
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      className={`quiz-option-btn${selected ? ' selected' : ''}`}
                                      onClick={() => setOptionAnswer(q.id, opt.id, q.question_type)}
                                    >
                                      <span className="opt-key">
                                        {q.question_type === 'MULTIPLE_CHOICE' ? (selected ? '☑' : '☐') : (selected ? '●' : '○')}
                                      </span>
                                      <span className="opt-val">{opt.text}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="quiz-card-footer">
                          <button className="btn btn-primary" onClick={submitQuiz} disabled={quizSubmitting}>
                            {quizSubmitting ? 'Submitting…' : 'Submit Quiz'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning">No quiz questions have been added to this lesson yet.</div>
                    )}
                  </div>
                )}
              </div>

              {activeLesson.content_type !== 'QUIZ' && (
                <footer className="player-control-footer" style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary btn-lg" onClick={handleMarkComplete} disabled={completing}>
                    {completing ? 'Updating...' : 'Mark as Complete & Next'}
                  </button>
                  <button className="btn btn-secondary btn-lg" onClick={advanceNextLesson}>
                    Next Lesson
                  </button>
                </footer>
              )}
            </div>
          ) : (
            <div className="no-active-lesson-state">
              <div className="icon">📂</div>
              <h3>Select a lesson to begin learning</h3>
              <p>Navigate the curriculum sidebar to select video lectures, PDFs, or quizzes.</p>
            </div>
          )
        )}

        {/* ── Q&A Tab ─────────────────────────────────────── */}
        {activeTab === 'qa' && (
          <QAPanel courseId={courseId} user={user} />
        )}

        {showCompletionModal && (
          <div className="completion-modal-overlay">
            <div className="completion-modal animate-scaleIn">
              <div className="completion-icon">🎓</div>
              <h2>Course Complete!</h2>
              <p>You've finished every lesson in <strong>{course.title}</strong>.</p>
              <p className="completion-cert-note">Your certificate will be emailed to you shortly.</p>
              <button className="btn btn-primary" onClick={() => setShowCompletionModal(false)}>
                Continue
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}