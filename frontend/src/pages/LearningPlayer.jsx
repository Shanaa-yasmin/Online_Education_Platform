import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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

function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let videoId = null;
    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0];
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return url;
      videoId = parsed.searchParams.get('v');
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  } catch (_) {}
  return url;
}

// ── Q&A Chat Panel Component ────────────────────────────────────────────────
export function QAPanel({ courseId, user }) {
  const [messages, setMessages]       = useState([]);
  const [inputText, setInputText]     = useState('');
  const [replyTo, setReplyTo]         = useState(null);   // { id, username }
  const [wsStatus, setWsStatus]       = useState('connecting'); // connecting | open | closed
  const [loadingHistory, setLH]       = useState(true);
  const wsRef   = useRef(null);
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
        setMessages(res.data);
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
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/course/${courseId}/qa/?token=${token}`);
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
  }, [courseId]);

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
  const avatarColor  = (username) => {
    const colors = ['#309d8e','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6'];
    let code = 0;
    for (const ch of (username ?? '')) code += ch.charCodeAt(0);
    return colors[code % colors.length];
  };

  const renderMessage = (msg, isReply = false) => {
    const isOwn   = msg.sender?.id === user?.id;
    const canMod  = isMod || isOwn;
    const hidden  = msg.is_hidden;

    return (
      <div key={msg.id} className={`qa-msg ${isReply ? 'qa-msg-reply' : ''} ${hidden ? 'qa-msg-hidden' : ''}`}>
        <div className="qa-msg-avatar" style={{ background: avatarColor(msg.sender?.username) }}>
          {avatarLetter(msg.sender?.username)}
        </div>
        <div className="qa-msg-body">
          <div className="qa-msg-meta">
            <span className="qa-sender">{msg.sender?.username}</span>
            {msg.sender?.role === 'MENTOR' && <span className="qa-badge-mentor">Mentor</span>}
            {msg.sender?.role === 'ADMIN'  && <span className="qa-badge-admin">Admin</span>}
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

  const [course, setCourse]               = useState(null);
  const [enrollment, setEnrollment]       = useState(null);
  const [completedLessons, setCompletedLessons] = useState({});
  const [activeLesson, setActiveLesson]   = useState(null);
  const [activeTab, setActiveTab]         = useState('lesson'); // 'lesson' | 'qa'

  const [loading, setLoading]     = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError]         = useState('');

  // Quiz states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer]         = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted]   = useState(false);
  const [quizScore, setQuizScore]                   = useState(0);
  const [quizFinished, setQuizFinished]             = useState(false);

  const loadLearningData = async () => {
    try {
      setLoading(true);
      const courseResponse = await api.get(`/api/courses/${courseId}/`);
      const courseData = courseResponse.data;
      setCourse(courseData);

      const enrollResponse = await api.get(`/api/payments/enrollments/check/?course_id=${courseId}`);
      if (!enrollResponse.data.enrolled) { navigate(`/courses/${courseId}`); return; }
      setEnrollment(enrollResponse.data);

      if (courseData.modules?.length > 0 && courseData.modules[0].lessons?.length > 0) {
        setActiveLesson(courseData.modules[0].lessons[0]);
      }
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load classroom content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadLearningData(); }, [courseId, user]);

  const handleLessonClick = (lesson) => {
    setActiveLesson(lesson);
    setActiveTab('lesson');
    setCurrentQuestionIdx(0); setSelectedAnswer(null);
    setIsAnswerSubmitted(false); setQuizScore(0); setQuizFinished(false);
  };

  const handleMarkComplete = async () => {
    if (!activeLesson || completing) return;
    setCompleting(true);
    try {
      const response = await api.post(`/api/payments/progress/lessons/${activeLesson.id}/complete/`);
      setCompletedLessons(prev => ({ ...prev, [activeLesson.id]: true }));
      setEnrollment(prev => ({ ...prev, progress_percent: response.data.progress_percent }));
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
      alert('🎉 Congratulations! You have completed the entire course!');
    }
  };

  // Quiz handlers
  const handleQuizAnswerSelect  = (key) => { if (!isAnswerSubmitted) setSelectedAnswer(key); };
  const handleQuizSubmitAnswer  = () => {
    if (!selectedAnswer || isAnswerSubmitted) return;
    const q = activeLesson.quiz_questions[currentQuestionIdx];
    if (selectedAnswer === q.correct_option) setQuizScore(p => p + 1);
    setIsAnswerSubmitted(true);
  };
  const handleQuizNextQuestion  = () => {
    setSelectedAnswer(null); setIsAnswerSubmitted(false);
    if (currentQuestionIdx < activeLesson.quiz_questions.length - 1) setCurrentQuestionIdx(p => p + 1);
    else setQuizFinished(true);
  };
  const handleQuizRetry = () => {
    setCurrentQuestionIdx(0); setSelectedAnswer(null);
    setIsAnswerSubmitted(false); setQuizScore(0); setQuizFinished(false);
  };

  const getLessonTypeIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF':   return <FileTextIcon />;
      case 'QUIZ':  return <QuizIcon />;
      default:      return <FileTextIcon />;
    }
  };

  if (loading) return (
    <div className="player-loading-page"><div className="loading-spinner"/><p>Entering the Classroom...</p></div>
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
      <aside className="player-sidebar">
        <div className="sidebar-header">
          <Link to={`/courses/${courseId}`} className="back-link"><ArrowLeftIcon /> Back to Syllabus</Link>
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
                  const isDone   = !!completedLessons[lesson.id];
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

      {/* Main Content Area */}
      <main className="player-main-area">
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
                    {activeLesson.video_url ? (
                      <div className="yt-embed-container">
                        <iframe
                          src={getYouTubeEmbedUrl(activeLesson.video_url)}
                          title={activeLesson.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="yt-iframe"
                        />
                      </div>
                    ) : (
                      <div className="alert alert-warning">No video link provided for this lesson.</div>
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
                    {!activeLesson.quiz_questions || activeLesson.quiz_questions.length === 0 ? (
                      <div className="alert alert-warning">No quiz questions have been added to this lesson yet.</div>
                    ) : quizFinished ? (
                      <div className="quiz-result-card animate-scaleIn">
                        <div className="trophy-icon">🏆</div>
                        <h2>Quiz Completed!</h2>
                        <p className="score-desc">You scored <strong>{quizScore}</strong> out of <strong>{activeLesson.quiz_questions.length}</strong> questions correct.</p>
                        <div className="percentage-score">{Math.round((quizScore / activeLesson.quiz_questions.length) * 100)}%</div>
                        <div className="result-actions">
                          <button className="btn btn-secondary" onClick={handleQuizRetry}>Retry Quiz</button>
                          <button className="btn btn-primary" onClick={handleMarkComplete}>Mark Lesson Complete</button>
                        </div>
                      </div>
                    ) : (
                      <div className="quiz-question-card animate-fadeIn">
                        <div className="quiz-card-header">
                          <span>Question {currentQuestionIdx + 1} of {activeLesson.quiz_questions.length}</span>
                          <span className="score-track-tag">Score: {quizScore}</span>
                        </div>
                        <h3 className="quiz-question-text">{activeLesson.quiz_questions[currentQuestionIdx].question_text}</h3>
                        <div className="quiz-options-list">
                          {['A', 'B', 'C', 'D'].map(key => {
                            const optVal   = activeLesson.quiz_questions[currentQuestionIdx][`option_${key.toLowerCase()}`];
                            const isSelected = selectedAnswer === key;
                            const isCorrect  = key === activeLesson.quiz_questions[currentQuestionIdx].correct_option;
                            let optClass = '';
                            if (isSelected) optClass += ' selected';
                            if (isAnswerSubmitted) { if (isCorrect) optClass += ' correct'; else if (isSelected) optClass += ' incorrect'; }
                            return (
                              <button key={key} className={`quiz-option-btn${optClass}`}
                                onClick={() => handleQuizAnswerSelect(key)} disabled={isAnswerSubmitted}>
                                <span className="opt-key">{key}</span>
                                <span className="opt-val">{optVal}</span>
                              </button>
                            );
                          })}
                        </div>
                        {isAnswerSubmitted && (
                          <div className={`quiz-feedback-banner ${selectedAnswer === activeLesson.quiz_questions[currentQuestionIdx].correct_option ? 'correct' : 'incorrect'}`}>
                            {selectedAnswer === activeLesson.quiz_questions[currentQuestionIdx].correct_option ? (
                              <span>✓ Correct! Well done.</span>
                            ) : (
                              <span>✗ Incorrect. Correct answer was <strong>Option {activeLesson.quiz_questions[currentQuestionIdx].correct_option}</strong>.</span>
                            )}
                          </div>
                        )}
                        <div className="quiz-card-footer">
                          {!isAnswerSubmitted ? (
                            <button className="btn btn-primary" onClick={handleQuizSubmitAnswer} disabled={!selectedAnswer}>Submit Answer</button>
                          ) : (
                            <button className="btn btn-primary" onClick={handleQuizNextQuestion}>
                              {currentQuestionIdx === activeLesson.quiz_questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {activeLesson.content_type !== 'QUIZ' && (
                <footer className="player-control-footer">
                  <button className="btn btn-primary btn-lg" onClick={handleMarkComplete} disabled={completing}>
                    {completing ? 'Updating...' : 'Mark as Complete & Next'}
                  </button>
                </footer>
              )}
            </div>
          ) : (
            <div className="no-active-lesson-state">
              <div className="icon">📂</div>
              <h3>Select a lesson to begin learning</h3>
              <p>Navigate the curriculum sidebar to select video lectures, PDFs, or MCQ quizzes.</p>
            </div>
          )
        )}

        {/* ── Q&A Tab ─────────────────────────────────────── */}
        {activeTab === 'qa' && (
          <QAPanel courseId={courseId} user={user} />
        )}
      </main>
    </div>
  );
}
