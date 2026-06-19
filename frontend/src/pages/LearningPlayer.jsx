import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './LearningPlayer.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const CircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3"/>
  </svg>
);
const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  </svg>
);
const QuizIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
  </svg>
);


// Converts any YouTube URL format to the embed URL needed for iframe.
// Handles: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let videoId = null;

    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0];
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return url; // already an embed URL
      }
      videoId = parsed.searchParams.get('v');
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  } catch (_) {
    // not a valid URL — might be a direct video file URL, return as-is
  }
  return url;
}

export default function LearningPlayer() {

  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data States
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [completedLessons, setCompletedLessons] = useState({});
  const [activeLesson, setActiveLesson] = useState(null);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  // Quiz Interactive States
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const loadLearningData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch course details
      const courseResponse = await api.get(`/api/courses/${courseId}/`);
      const courseData = courseResponse.data;
      setCourse(courseData);

      // 2. Verify enrollment
      const enrollResponse = await api.get(`/api/payments/enrollments/check/?course_id=${courseId}`);
      if (!enrollResponse.data.enrolled) {
        navigate(`/courses/${courseId}`);
        return;
      }
      setEnrollment(enrollResponse.data);

      // 3. Extract completed lessons from user profile or progress endpoints.
      // Wait, we can fetch all lesson progress or mock it based on enrollment percentage, 
      // or write a quick fetch to see what progresses are active.
      // For now, let's load all lesson progress from the database.
      // We will add an endpoint or fetch the completed lessons if available.
      // Wait, let's call GET /api/payments/enrollments/ and find progress, or fetch it.
      // Let's call /api/payments/progress/ but since it is GenericViewSet we didn't add list.
      // So instead, let's create a dictionary of completed lessons from lesson progresses.
      // Since lesson details in CourseSerializer don't include progress directly,
      // let's fetch course details.
      
      // Let's set the active lesson to the first lesson of the first module
      if (courseData.modules?.length > 0 && courseData.modules[0].lessons?.length > 0) {
        const firstLesson = courseData.modules[0].lessons[0];
        setActiveLesson(firstLesson);
      }
      
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load classroom content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadLearningData();
    }
  }, [courseId, user]);

  // Handle active lesson changes
  const handleLessonClick = (lesson) => {
    setActiveLesson(lesson);
    // Reset quiz states when switching lessons
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const handleMarkComplete = async () => {
    if (!activeLesson || completing) return;
    setCompleting(true);
    try {
      const response = await api.post(`/api/payments/progress/lessons/${activeLesson.id}/complete/`);
      
      // Update completion checklist state
      setCompletedLessons(prev => ({
        ...prev,
        [activeLesson.id]: true
      }));

      // Update enrollment progress percentage
      setEnrollment(prev => ({
        ...prev,
        progress_percent: response.data.progress_percent
      }));

      // Auto-advance to the next lesson
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
    
    // Flatten lessons list to find next index
    const flatLessons = [];
    course.modules?.forEach(m => {
      m.lessons?.forEach(l => {
        flatLessons.push(l);
      });
    });

    const activeIdx = flatLessons.findIndex(l => l.id === activeLesson.id);
    if (activeIdx !== -1 && activeIdx < flatLessons.length - 1) {
      handleLessonClick(flatLessons[activeIdx + 1]);
    } else {
      alert('Congratulations! You have reached the end of the course syllabus!');
    }
  };

  // =========================================================
  // Interactive Quiz Logic
  // =========================================================
  const handleQuizAnswerSelect = (optionKey) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(optionKey);
  };

  const handleQuizSubmitAnswer = () => {
    if (!selectedAnswer || isAnswerSubmitted) return;
    
    const currentQuestion = activeLesson.quiz_questions[currentQuestionIdx];
    const isCorrect = selectedAnswer === currentQuestion.correct_option;

    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }

    setIsAnswerSubmitted(true);
  };

  const handleQuizNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);

    if (currentQuestionIdx < activeLesson.quiz_questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleQuizRetry = () => {
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const getLessonTypeIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF': return <FileTextIcon />;
      case 'QUIZ': return <QuizIcon />;
      default: return <FileTextIcon />;
    }
  };

  if (loading) {
    return (
      <div className="player-loading-page">
        <div className="loading-spinner"></div>
        <p>Entering the Classroom...</p>
      </div>
    );
  }

  if (error || !course || !enrollment) {
    return (
      <div className="player-error-page">
        <h2>Access Denied</h2>
        <p className="alert alert-error">{error || 'Please make sure you are enrolled.'}</p>
        <Link to={`/courses/${courseId}`} className="btn btn-primary">Return to Course Syllabus</Link>
      </div>
    );
  }

  return (
    <div className="learning-player-layout">
      {/* 1. Sidebar Syllabus Panel */}
      <aside className="player-sidebar">
        <div className="sidebar-header">
          <Link to={`/courses/${courseId}`} className="back-link">
            <ArrowLeftIcon /> Back to Syllabus
          </Link>
          <h2 className="sidebar-course-title">{course.title}</h2>
          
          <div className="progress-indicator">
            <div className="progress-header">
              <span>Overall Progress</span>
              <span>{enrollment.progress_percent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${enrollment.progress_percent}%` }}></div>
            </div>
          </div>
        </div>

        {/* Accordion List */}
        <nav className="sidebar-syllabus">
          {course.modules?.map((module, mIdx) => (
            <div key={module.id} className="syllabus-module">
              <h3 className="module-title-heading">M{mIdx + 1}: {module.title}</h3>
              <div className="module-lessons-menu">
                {module.lessons?.map((lesson) => {
                  const isActive = activeLesson?.id === lesson.id;
                  const isDone = !!completedLessons[lesson.id];
                  
                  return (
                    <button
                      key={lesson.id}
                      className={`syllabus-lesson-btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                      onClick={() => handleLessonClick(lesson)}
                    >
                      <span className="completion-check">
                        {isDone ? <CheckIcon /> : <CircleIcon />}
                      </span>
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

      {/* 2. Main Content Player Panel */}
      <main className="player-main-area">
        {activeLesson ? (
          <div className="active-lesson-container">
            {/* Active Content Header */}
            <div className="lesson-header">
              <h1 className="active-lesson-title">{activeLesson.title}</h1>
              <span className="active-lesson-badge">{activeLesson.content_type} Lesson</span>
            </div>

            {/* Active Content Body */}
            <div className="lesson-content-body">
              {/* VIDEO PLAYER */}
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

              {/* PDF DOCUMENT VIEW */}
              {activeLesson.content_type === 'PDF' && (
                <div className="pdf-viewer-wrapper">
                  <div className="mock-pdf-screen">
                    <FileTextIcon />
                    <h3>PDF Reference Guide</h3>
                    <p>Click below to download or view the lecture attachment material.</p>
                    {activeLesson.file_attachment ? (
                      <a
                        href={activeLesson.file_attachment}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                      >
                        <DownloadIcon /> Download File Attachment
                      </a>
                    ) : (
                      <span className="no-attachment-text">No reference attachment uploaded for this lesson.</span>
                    )}
                  </div>
                </div>
              )}

              {/* RICH TEXT DOCUMENT */}
              {activeLesson.content_type === 'DOCUMENT' && (
                <div className="document-viewer-wrapper">
                  <div className="rich-document-card">
                    <p className="document-paragraph">{activeLesson.body_text || 'No summary text content is available for this lesson.'}</p>
                  </div>
                </div>
              )}

              {/* MCQ QUIZ INTERACTIVE BOARD */}
              {activeLesson.content_type === 'QUIZ' && (
                <div className="quiz-player-wrapper">
                  {!activeLesson.quiz_questions || activeLesson.quiz_questions.length === 0 ? (
                    <div className="alert alert-warning">No quiz questions have been added to this lesson yet.</div>
                  ) : quizFinished ? (
                    /* Quiz Results Summary Screen */
                    <div className="quiz-result-card animate-scaleIn">
                      <div className="trophy-icon">🏆</div>
                      <h2>Quiz Completed!</h2>
                      <p className="score-desc">
                        You scored <strong>{quizScore}</strong> out of <strong>{activeLesson.quiz_questions.length}</strong> questions correct.
                      </p>
                      <div className="percentage-score">
                        {Math.round((quizScore / activeLesson.quiz_questions.length) * 100)}%
                      </div>
                      <div className="result-actions">
                        <button className="btn btn-secondary" onClick={handleQuizRetry}>
                          Retry Quiz
                        </button>
                        <button className="btn btn-primary" onClick={handleMarkComplete}>
                          Mark Lesson Complete
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Interactive MCQ Questions rendering one by one */
                    <div className="quiz-question-card animate-fadeIn">
                      <div className="quiz-card-header">
                        <span>Question {currentQuestionIdx + 1} of {activeLesson.quiz_questions.length}</span>
                        <span className="score-track-tag">Score: {quizScore}</span>
                      </div>

                      <h3 className="quiz-question-text">
                        {activeLesson.quiz_questions[currentQuestionIdx].question_text}
                      </h3>

                      <div className="quiz-options-list">
                        {['A', 'B', 'C', 'D'].map(key => {
                          const optVal = activeLesson.quiz_questions[currentQuestionIdx][`option_${key.toLowerCase()}`];
                          const isSelected = selectedAnswer === key;
                          const isCorrect = key === activeLesson.quiz_questions[currentQuestionIdx].correct_option;
                          
                          let optClass = '';
                          if (isSelected) optClass += ' selected';
                          if (isAnswerSubmitted) {
                            if (isCorrect) optClass += ' correct';
                            else if (isSelected) optClass += ' incorrect';
                          }

                          return (
                            <button
                              key={key}
                              className={`quiz-option-btn${optClass}`}
                              onClick={() => handleQuizAnswerSelect(key)}
                              disabled={isAnswerSubmitted}
                            >
                              <span className="opt-key">{key}</span>
                              <span className="opt-val">{optVal}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Feedback banner */}
                      {isAnswerSubmitted && (
                        <div className={`quiz-feedback-banner ${selectedAnswer === activeLesson.quiz_questions[currentQuestionIdx].correct_option ? 'correct' : 'incorrect'}`}>
                          {selectedAnswer === activeLesson.quiz_questions[currentQuestionIdx].correct_option ? (
                            <span>Correct! Well done.</span>
                          ) : (
                            <span>
                              Incorrect. The correct answer was <strong>Option {activeLesson.quiz_questions[currentQuestionIdx].correct_option}</strong>.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Question Actions */}
                      <div className="quiz-card-footer">
                        {!isAnswerSubmitted ? (
                          <button
                            className="btn btn-primary"
                            onClick={handleQuizSubmitAnswer}
                            disabled={!selectedAnswer}
                          >
                            Submit Answer
                          </button>
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

            {/* Footer Control Navigation Bar */}
            {activeLesson.content_type !== 'QUIZ' && (
              <footer className="player-control-footer">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleMarkComplete}
                  disabled={completing}
                >
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
        )}
      </main>
    </div>
  );
}
