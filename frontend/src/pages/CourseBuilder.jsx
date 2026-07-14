import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import './CourseBuilder.css';

// SVG Icons
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" x2="5" y1="12" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);
const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);
const QuizIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" x2="12.01" y1="17" y2="17" />
  </svg>
);

const EMPTY_OPTIONS = () => ([
  { text: '', is_correct: true },
  { text: '', is_correct: false },
]);

const EMPTY_QUIZ = () => ({
  question_text: '',
  question_type: 'SINGLE_CHOICE',
  difficulty: 'MEDIUM',
  points: 1,
  explanation: '',
  options: EMPTY_OPTIONS(),
  correct_text_answer: '',
  case_sensitive: false,
});

const QUESTION_TYPE_LABELS = {
  SINGLE_CHOICE: 'Single Choice',
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in the Blank',
};

export default function CourseBuilder() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Accordion active modules
  const [expandedModules, setExpandedModules] = useState({});

  // Modal control states
  const [activeModal, setActiveModal] = useState(null); // 'module' | 'lesson' | 'quiz'
  const [editTarget, setEditTarget] = useState(null); // null (for create) or object (for update)

  // Input states
  const [moduleTitle, setModuleTitle] = useState('');
  const [lessonData, setLessonData] = useState({
    title: '',
    content_type: 'VIDEO',
    video_url: '',
    body_text: '',
    file: null,
    max_quiz_attempts: 0,
    passing_score_percent: 70,
    quiz_time_limit_minutes: 0,
  });
  const [quizData, setQuizData] = useState(EMPTY_QUIZ());

  // Edit Course Details modal
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editCourseForm, setEditCourseForm] = useState({
    title: '', description: '', level: 'BEGINNER', price: '0.00', language: 'English', duration_hours: 0
  });
  const [editThumbnailFile, setEditThumbnailFile] = useState(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState('');

  const [modalParentId, setModalParentId] = useState(null); // holds module_id for lesson, or lesson_id for quiz question
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/courses/${courseId}/`);
      setCourse(response.data);
      setError('');

      // Auto-expand all modules initially
      const expanded = {};
      response.data.modules?.forEach(m => {
        expanded[m.id] = true;
      });
      setExpandedModules(expanded);
    } catch (err) {
      console.error(err);
      setError('Failed to load course details. Ensure the course exists and you are the mentor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const toggleModule = (id) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // =========================================================
  // Delete Course
  // =========================================================
  const canDelete = user && course && (
    user.is_staff || user.role === 'ADMIN' ||
    (course.mentor && user.id === course.mentor.id)
  );

  const [deleting, setDeleting] = useState(false);

  const handleDeleteCourse = async () => {
    const confirmed = window.confirm(
      `Delete "${course.title}"? It will be removed from your dashboard and the public catalog. This can be restored by an administrator if needed.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.delete(`/api/courses/${courseId}/`);
      navigate('/mentor/dashboard');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to delete course.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!course) return;
    setPublishing(true);
    try {
      const action = course.is_published ? 'unpublish' : 'publish';
      const response = await api.post(`/api/courses/${courseId}/${action}/`);
      setCourse(prev => ({
        ...prev,
        is_published: response.data.is_published,
        is_approved: response.data.is_approved
      }));
    } catch (err) {
      console.error(err);
      alert('Failed to update publication status. Ensure curriculum is complete.');
    } finally {
      setPublishing(false);
    }
  };

  const [submittingReview, setSubmittingReview] = useState(false);

  const handleSubmitForReview = async () => {
    if (!course) return;
    setSubmittingReview(true);
    try {
      const response = await api.post(`/api/courses/${courseId}/submit_for_review/`);
      setCourse(prev => ({
        ...prev,
        is_submitted_for_review: true,
        is_rejected: false,
      }));
      alert(response.data.detail);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to submit course for review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // =========================================================
  // Edit Course Details
  // =========================================================
  const openEditCourseModal = () => {
    setEditCourseForm({
      title: course.title,
      description: course.description,
      level: course.level,
      price: course.price,
      language: course.language,
      duration_hours: course.duration_hours
    });
    setEditThumbnailFile(null);
    setEditThumbnailPreview(course.thumbnail || null);
    setEditSubmitError('');
    setShowEditCourseModal(true);
  };

  const closeEditCourseModal = () => {
    if (editThumbnailFile && editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
    setShowEditCourseModal(false);
  };

  const handleEditCourseInput = (e) => {
    setEditCourseForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setEditSubmitError('Please select a valid image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditSubmitError('Thumbnail image must be smaller than 5MB.');
      return;
    }
    setEditSubmitError('');
    setEditThumbnailFile(file);
    setEditThumbnailPreview(URL.createObjectURL(file));
  };

  const clearEditThumbnail = () => {
    if (editThumbnailFile && editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview);
    setEditThumbnailFile(null);
    setEditThumbnailPreview(null); // user is explicitly clearing the thumbnail
  };

  const handleEditCourseSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditSubmitError('');
    try {
      const fd = new FormData();
      fd.append('title', editCourseForm.title);
      fd.append('description', editCourseForm.description);
      fd.append('level', editCourseForm.level);
      fd.append('price', parseFloat(editCourseForm.price) || 0);
      fd.append('language', editCourseForm.language);
      fd.append('duration_hours', parseInt(editCourseForm.duration_hours) || 0);
      if (editThumbnailFile) {
        fd.append('thumbnail', editThumbnailFile);
      }

      const response = await api.patch(`/api/courses/${courseId}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Editing a course resets approval/publish status server-side (moderation
      // re-review), so we trust the fresh response rather than merging blindly.
      setCourse(prev => ({ ...prev, ...response.data }));
      setShowEditCourseModal(false);
    } catch (err) {
      console.error(err);
      setEditSubmitError(err.response?.data?.detail || 'Failed to update course details.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // =========================================================
  // Module Actions
  // =========================================================
  const openModuleModal = (moduleObj = null) => {
    setEditTarget(moduleObj);
    setModuleTitle(moduleObj ? moduleObj.title : '');
    setActionError('');
    setActiveModal('module');
  };

  const handleModuleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      if (editTarget) {
        await api.put(`/api/modules/${editTarget.id}/`, {
          course: courseId,
          title: moduleTitle,
          order: editTarget.order
        });
      } else {
        const nextOrder = (course.modules?.length || 0) + 1;
        await api.post('/api/modules/', {
          course: courseId,
          title: moduleTitle,
          order: nextOrder
        });
      }
      setActiveModal(null);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Failed to save module.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Are you sure you want to delete this module and all its lessons?')) return;
    try {
      await api.delete(`/api/modules/${moduleId}/`);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete module.');
    }
  };

  // =========================================================
  // Lesson Actions
  // =========================================================
  const openLessonModal = (moduleId, lessonObj = null) => {
    setModalParentId(moduleId);
    setEditTarget(lessonObj);
    setActionError('');
    if (lessonObj) {
      setLessonData({
        title: lessonObj.title,
        content_type: lessonObj.content_type,
        video_url: lessonObj.video_url || '',
        body_text: lessonObj.body_text || '',
        file: null,
        max_quiz_attempts: lessonObj.max_quiz_attempts ?? 0,
        passing_score_percent: lessonObj.passing_score_percent ?? 70,
        quiz_time_limit_minutes: lessonObj.quiz_time_limit_minutes ?? 0,
      });
    } else {
      setLessonData({
        title: '',
        content_type: 'VIDEO',
        video_url: '',
        body_text: '',
        file: null,
        max_quiz_attempts: 0,
        passing_score_percent: 70,
        quiz_time_limit_minutes: 0,
      });
    }
    setActiveModal('lesson');
  };

  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const formPayload = new FormData();
      formPayload.append('module', editTarget ? editTarget.module : modalParentId);
      formPayload.append('title', lessonData.title);
      formPayload.append('content_type', lessonData.content_type);

      if (lessonData.content_type === 'VIDEO') {
        formPayload.append('video_url', lessonData.video_url);
      } else if (lessonData.content_type === 'DOCUMENT') {
        formPayload.append('body_text', lessonData.body_text);
      } else if (lessonData.content_type === 'PDF' && lessonData.file) {
        formPayload.append('file_attachment', lessonData.file);
      } else if (lessonData.content_type === 'QUIZ') {
        formPayload.append('max_quiz_attempts', parseInt(lessonData.max_quiz_attempts) || 0);
        formPayload.append('passing_score_percent', parseInt(lessonData.passing_score_percent) || 70);
        formPayload.append('quiz_time_limit_minutes', parseInt(lessonData.quiz_time_limit_minutes) || 0);
      }

      if (editTarget) {
        formPayload.append('order', editTarget.order);
        await api.put(`/api/lessons/${editTarget.id}/`, formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        const parentModule = course.modules.find(m => m.id === modalParentId);
        const nextOrder = (parentModule?.lessons?.length || 0) + 1;
        formPayload.append('order', nextOrder);
        await api.post('/api/lessons/', formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setActiveModal(null);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      setActionError('Failed to save lesson. Check that all required inputs are present.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    try {
      await api.delete(`/api/lessons/${lessonId}/`);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete lesson.');
    }
  };

  // =========================================================
  // Quiz Question Actions
  // =========================================================
  const openQuizModal = (lessonId, questionObj = null) => {
    setModalParentId(lessonId);
    setEditTarget(questionObj);
    setActionError('');
    if (questionObj) {
      setQuizData({
        question_text: questionObj.question_text,
        question_type: questionObj.question_type,
        difficulty: questionObj.difficulty,
        points: questionObj.points,
        explanation: questionObj.explanation || '',
        options: questionObj.options?.length
          ? questionObj.options.map(o => ({ text: o.text, is_correct: !!o.is_correct }))
          : EMPTY_OPTIONS(),
        correct_text_answer: questionObj.correct_text_answer || '',
        case_sensitive: !!questionObj.case_sensitive,
      });
    } else {
      setQuizData(EMPTY_QUIZ());
    }
    setActiveModal('quiz');
  };

  const handleQuestionTypeChange = (type) => {
    setQuizData(prev => {
      if (type === 'TRUE_FALSE') {
        return { ...prev, question_type: type, options: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] };
      }
      if (type === 'FILL_BLANK') {
        return { ...prev, question_type: type };
      }
      // SINGLE_CHOICE / MULTIPLE_CHOICE
      const needsFreshOptions = prev.question_type === 'TRUE_FALSE' || prev.question_type === 'FILL_BLANK' || prev.options.length < 2;
      return { ...prev, question_type: type, options: needsFreshOptions ? EMPTY_OPTIONS() : prev.options };
    });
  };

  const updateOptionText = (idx, text) => {
    setQuizData(prev => {
      const options = [...prev.options];
      options[idx] = { ...options[idx], text };
      return { ...prev, options };
    });
  };

  const toggleOptionCorrect = (idx) => {
    setQuizData(prev => {
      let options;
      if (prev.question_type === 'MULTIPLE_CHOICE') {
        options = prev.options.map((o, i) => (i === idx ? { ...o, is_correct: !o.is_correct } : o));
      } else {
        // SINGLE_CHOICE / TRUE_FALSE — only one correct option at a time
        options = prev.options.map((o, i) => ({ ...o, is_correct: i === idx }));
      }
      return { ...prev, options };
    });
  };

  const addOption = () => {
    setQuizData(prev => ({ ...prev, options: [...prev.options, { text: '', is_correct: false }] }));
  };

  const removeOption = (idx) => {
    setQuizData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  };

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const payload = {
        lesson: editTarget ? editTarget.lesson : modalParentId,
        question_text: quizData.question_text,
        question_type: quizData.question_type,
        difficulty: quizData.difficulty,
        points: parseInt(quizData.points) || 1,
        explanation: quizData.explanation,
      };

      if (quizData.question_type === 'FILL_BLANK') {
        payload.correct_text_answer = quizData.correct_text_answer;
        payload.case_sensitive = quizData.case_sensitive;
      } else {
        payload.options = quizData.options.map((o, i) => ({ text: o.text, is_correct: o.is_correct, order: i }));
      }

      if (editTarget) {
        await api.put(`/api/quiz-questions/${editTarget.id}/`, payload);
      } else {
        await api.post('/api/quiz-questions/', payload);
      }
      setActiveModal(null);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      const message = data?.detail || (data && Object.values(data)[0]?.[0]) || 'Failed to save question.';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this quiz question?')) return;
    try {
      await api.delete(`/api/quiz-questions/${questionId}/`);
      await fetchCourseData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete quiz question.');
    }
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <PlayIcon />;
      case 'PDF': return <FileTextIcon />;
      case 'QUIZ': return <QuizIcon />;
      default: return <FileTextIcon />;
    }
  };

  if (loading) {
    return (
      <div className="builder-loading-page">
        <div className="loading-spinner"></div>
        <p>Loading Course Builder...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="builder-error-page">
        <h2>Error loading Course</h2>
        <p className="alert alert-error">{error || 'Course not found'}</p>
        <Link to="/mentor/dashboard" className="btn btn-primary">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="course-builder-page">
      {/* Top Header Row */}
      <header className="builder-header">
        <div className="header-left">
          <Link to="/mentor/dashboard" className="back-link">
            <ArrowLeftIcon /> Dashboard
          </Link>
          <div className="header-title-row">
            <h1 className="course-title">{course.title}</h1>
            <span className={`status-badge-inline ${course.is_published ? 'live' : 'draft'}`}>
              {course.is_published ? 'Published' : course.is_approved ? 'Approved' : 'Draft'}
            </span>
            {course.is_submitted_for_review && !course.is_approved && (
              <span className="moderation-notice">Pending Admin Review</span>
            )}
            {course.is_rejected && (
              <span className="moderation-notice moderation-rejected">Changes Requested</span>
            )}
          </div>
          <p className="course-summary">{course.description}</p>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary" onClick={openEditCourseModal}>
            <EditIcon /> Edit Course Details
          </button>

          {course.is_published ? (
            <button className="btn btn-secondary btn-publish" onClick={handlePublishToggle} disabled={publishing}>
              {publishing ? 'Updating...' : 'Unpublish Course'}
            </button>
          ) : course.is_approved ? (
            <button className="btn btn-primary btn-publish" onClick={handlePublishToggle} disabled={publishing}>
              {publishing ? 'Updating...' : 'Publish Course'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-publish"
              onClick={handleSubmitForReview}
              disabled={submittingReview || course.is_submitted_for_review}
              title={course.is_submitted_for_review ? 'Waiting on admin approval' : ''}
            >
              {submittingReview
                ? 'Submitting...'
                : course.is_submitted_for_review
                  ? 'Pending Admin Review'
                  : course.is_rejected
                    ? 'Resubmit for Review'
                    : 'Submit for Review'}
            </button>
          )}
          {canDelete && (
            <button className="btn btn-danger" onClick={handleDeleteCourse} disabled={deleting}>
              <TrashIcon /> {deleting ? 'Deleting...' : 'Delete Course'}
            </button>
          )}
        </div>
      </header>

      {/* Curriculum Manager Layout */}
      <main className="builder-content">
        <div className="section-title-row">
          <h2>Curriculum & Modules</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => openModuleModal(null)}>
            <PlusIcon /> Add Module
          </button>
        </div>

        {course.modules?.length === 0 ? (
          <div className="builder-empty-state">
            <div className="icon">🧱</div>
            <h3>No curriculum modules yet</h3>
            <p>Divide your course into logical sections/modules, then populate them with summaries, files, or quizzes.</p>
            <button className="btn btn-secondary" onClick={() => openModuleModal(null)}>
              Create First Module
            </button>
          </div>
        ) : (
          <div className="modules-list-accordion">
            {course.modules.map((module) => {
              const isExpanded = !!expandedModules[module.id];
              return (
                <div key={module.id} className={`module-accordion-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="module-header-bar" onClick={() => toggleModule(module.id)}>
                    <div className="module-title-side">
                      <span className="accordion-arrow">
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </span>
                      <h3>{module.title}</h3>
                      <span className="lesson-count-tag">{module.lessons?.length || 0} items</span>
                    </div>

                    <div className="module-actions-side" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon-link" onClick={() => openModuleModal(module)} title="Edit Module Title">
                        <EditIcon />
                      </button>
                      <button className="btn-icon-link delete" onClick={() => handleDeleteModule(module.id)} title="Delete Module">
                        <TrashIcon />
                      </button>
                      <button className="btn btn-secondary btn-xs" onClick={() => openLessonModal(module.id, null)}>
                        <PlusIcon /> Add Lesson
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="module-lessons-list">
                      {module.lessons?.length === 0 ? (
                        <div className="lessons-empty-text">No lessons in this module. Add text summaries, video links, or quizzes.</div>
                      ) : (
                        module.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="lesson-row-item"
                            onClick={() => openLessonModal(module.id, lesson)}
                          >
                            <div className="lesson-info-left">
                              <span className={`lesson-type-icon ${lesson.content_type.toLowerCase()}`}>
                                {getLessonIcon(lesson.content_type)}
                              </span>
                              <div>
                                <h4 className="lesson-title">{lesson.title}</h4>
                                <span className="lesson-meta-tag">{lesson.content_type}</span>
                                {lesson.content_type === 'VIDEO' && lesson.video_url && (
                                  <span className="meta-sub">URL: {lesson.video_url}</span>
                                )}
                                {lesson.content_type === 'QUIZ' && (
                                  <span className="meta-sub">
                                    Pass: {lesson.passing_score_percent}%
                                    {lesson.max_quiz_attempts ? ` · Max ${lesson.max_quiz_attempts} attempts` : ' · Unlimited attempts'}
                                    {lesson.quiz_time_limit_minutes ? ` · ${lesson.quiz_time_limit_minutes} min limit` : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="lesson-actions-right" onClick={(e) => e.stopPropagation()}>
                              <button className="btn-icon-link" onClick={() => openLessonModal(module.id, lesson)} title="Edit Lesson">
                                <EditIcon />
                              </button>
                              <button className="btn-icon-link delete" onClick={() => handleDeleteLesson(lesson.id)} title="Delete Lesson">
                                <TrashIcon />
                              </button>
                            </div>

                            {lesson.content_type === 'QUIZ' && (
                              <div className="quiz-questions-block" onClick={(e) => e.stopPropagation()}>
                                <div className="quiz-block-header">
                                  <h5>Quiz Questions</h5>
                                  <button className="btn btn-secondary btn-xs" onClick={() => openQuizModal(lesson.id, null)}>
                                    <PlusIcon /> Add Question
                                  </button>
                                </div>

                                {lesson.quiz_questions?.length === 0 ? (
                                  <p className="questions-empty">No quiz questions added yet. Students need at least one question to take a quiz.</p>
                                ) : (
                                  <div className="quiz-questions-list">
                                    {lesson.quiz_questions.map((q, idx) => (
                                      <div key={q.id} className="quiz-question-item">
                                        <div className="question-text-row">
                                          <span className="q-number">Q{idx + 1}.</span>
                                          <div style={{ flex: 1 }}>
                                            <p className="q-text">{q.question_text}</p>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                              <span className="badge badge-beginner">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
                                              <span className="badge">{q.difficulty}</span>
                                              <span className="badge">{q.points} pt{q.points === 1 ? '' : 's'}</span>
                                            </div>
                                          </div>
                                          <div className="q-actions">
                                            <button className="btn-icon-link" onClick={() => openQuizModal(lesson.id, q)}>
                                              <EditIcon />
                                            </button>
                                            <button className="btn-icon-link delete" onClick={() => handleDeleteQuestion(q.id)}>
                                              <TrashIcon />
                                            </button>
                                          </div>
                                        </div>

                                        {q.question_type === 'FILL_BLANK' ? (
                                          <div className="options-grid-display">
                                            <span className="opt correct"><strong>Answer:</strong> {q.correct_text_answer}</span>
                                          </div>
                                        ) : (
                                          <div className="options-grid-display">
                                            {q.options?.map(opt => (
                                              <span key={opt.id} className={`opt ${opt.is_correct ? 'correct' : ''}`}>{opt.text}</span>
                                            ))}
                                          </div>
                                        )}

                                        {q.explanation && (
                                          <p className="meta-sub" style={{ marginTop: 6 }}>💡 {q.explanation}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* =========================================================
         MODULE MODAL
         ========================================================= */}
      {activeModal === 'module' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Module' : 'Add Module'}</h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            <form onSubmit={handleModuleSubmit} className="modal-form">
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <div className="form-group">
                <label htmlFor="mod-title">Module Title</label>
                <input
                  type="text"
                  id="mod-title"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  placeholder="e.g. Module 1: Foundations & Architecture"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         LESSON MODAL
         ========================================================= */}
      {activeModal === 'lesson' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Lesson' : 'Add Lesson'}</h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            <form onSubmit={handleLessonSubmit} className="modal-form">
              {actionError && <div className="alert alert-error">{actionError}</div>}

              <div className="form-group">
                <label htmlFor="les-title">Lesson Title</label>
                <input
                  type="text"
                  id="les-title"
                  value={lessonData.title}
                  onChange={(e) => setLessonData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Lesson 1.2: System Flow & Protocols"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="les-type">Content Type</label>
                <select
                  id="les-type"
                  value={lessonData.content_type}
                  onChange={(e) => setLessonData(prev => ({ ...prev, content_type: e.target.value }))}
                >
                  <option value="VIDEO">Video</option>
                  <option value="PDF">PDF Document</option>
                  <option value="DOCUMENT">Rich Text Summary</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </div>

              {lessonData.content_type === 'VIDEO' && (
                <div className="form-group">
                  <label htmlFor="les-video">Video Streaming URL</label>
                  <input
                    type="url"
                    id="les-video"
                    value={lessonData.video_url}
                    onChange={(e) => setLessonData(prev => ({ ...prev, video_url: e.target.value }))}
                    placeholder="https://example.com/streaming-link"
                    required
                  />
                </div>
              )}

              {lessonData.content_type === 'DOCUMENT' && (
                <div className="form-group">
                  <label htmlFor="les-body">Rich Text Markdown Summary</label>
                  <textarea
                    id="les-body"
                    value={lessonData.body_text}
                    onChange={(e) => setLessonData(prev => ({ ...prev, body_text: e.target.value }))}
                    placeholder="Write summary description or markdown text for students..."
                    rows="8"
                    required
                  />
                </div>
              )}

              {lessonData.content_type === 'PDF' && (
                <div className="form-group">
                  <label htmlFor="les-file">PDF Attachment File Upload</label>
                  <input
                    type="file"
                    id="les-file"
                    accept=".pdf"
                    onChange={(e) => setLessonData(prev => ({ ...prev, file: e.target.files[0] }))}
                    required={!editTarget}
                  />
                  {editTarget && <small className="meta-sub">Leave blank to keep existing file.</small>}
                </div>
              )}

              {lessonData.content_type === 'QUIZ' && (
                <>
                  <div className="form-row-grid">
                    <div className="form-group">
                      <label htmlFor="les-max-attempts">Max Attempts</label>
                      <input
                        type="number" id="les-max-attempts" min="0"
                        value={lessonData.max_quiz_attempts}
                        onChange={(e) => setLessonData(prev => ({ ...prev, max_quiz_attempts: e.target.value }))}
                      />
                      <small className="meta-sub">0 = unlimited attempts</small>
                    </div>
                    <div className="form-group">
                      <label htmlFor="les-pass-score">Passing Score (%)</label>
                      <input
                        type="number" id="les-pass-score" min="0" max="100"
                        value={lessonData.passing_score_percent}
                        onChange={(e) => setLessonData(prev => ({ ...prev, passing_score_percent: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="les-time-limit">Time Limit (minutes)</label>
                    <input
                      type="number" id="les-time-limit" min="0"
                      value={lessonData.quiz_time_limit_minutes}
                      onChange={(e) => setLessonData(prev => ({ ...prev, quiz_time_limit_minutes: e.target.value }))}
                    />
                    <small className="meta-sub">0 = no time limit</small>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
   EDIT COURSE DETAILS MODAL
   ========================================================= */}
      {showEditCourseModal && (
        <div className="modal-overlay" onClick={closeEditCourseModal}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Course Details</h2>
              <button className="modal-close-btn" onClick={closeEditCourseModal}>&times;</button>
            </div>
            <form onSubmit={handleEditCourseSubmit} className="modal-form">
              {editSubmitError && <div className="alert alert-error">{editSubmitError}</div>}

              <div className="form-group">
                <label htmlFor="edit-title">Course Title</label>
                <input type="text" id="edit-title" name="title" value={editCourseForm.title} onChange={handleEditCourseInput} required />
              </div>

              <div className="form-group">
                <label htmlFor="edit-desc">Description</label>
                <textarea id="edit-desc" name="description" value={editCourseForm.description} onChange={handleEditCourseInput} rows="4" required />
              </div>

              <div className="form-group">
                <label>Course Thumbnail</label>
                {editThumbnailPreview ? (
                  <div className="thumbnail-preview-box">
                    <img src={editThumbnailPreview} alt="Thumbnail preview" />
                    <button type="button" className="thumbnail-remove-btn" onClick={clearEditThumbnail} title="Remove image">
                      &times;
                    </button>
                  </div>
                ) : (
                  <label className="thumbnail-dropzone">
                    <span>Click to upload an image</span>
                    <small>16:9 recommended — auto-cropped on upload</small>
                    <input type="file" accept="image/*" onChange={handleEditThumbnailChange} hidden />
                  </label>
                )}
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="edit-level">Difficulty Level</label>
                  <select id="edit-level" name="level" value={editCourseForm.level} onChange={handleEditCourseInput}>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-price">Price ($)</label>
                  <input type="number" id="edit-price" name="price" value={editCourseForm.price} onChange={handleEditCourseInput} step="0.01" min="0" required />
                </div>
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="edit-lang">Language</label>
                  <input type="text" id="edit-lang" name="language" value={editCourseForm.language} onChange={handleEditCourseInput} required />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-hours">Estimated Hours</label>
                  <input type="number" id="edit-hours" name="duration_hours" value={editCourseForm.duration_hours} onChange={handleEditCourseInput} min="0" required />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEditCourseModal} disabled={editSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         QUIZ QUESTION MODAL
         ========================================================= */}
      {activeModal === 'quiz' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Quiz Question' : 'Add Quiz Question'}</h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>&times;</button>
            </div>
            <form onSubmit={handleQuizSubmit} className="modal-form">
              {actionError && <div className="alert alert-error">{actionError}</div>}

              <div className="form-group">
                <label htmlFor="q-text">Question Prompt</label>
                <textarea
                  id="q-text"
                  value={quizData.question_text}
                  onChange={(e) => setQuizData(prev => ({ ...prev, question_text: e.target.value }))}
                  placeholder="e.g. Which algorithm provides O(N log N) worst-case time complexity?"
                  rows="3"
                  required
                />
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="q-type">Question Type</label>
                  <select id="q-type" value={quizData.question_type} onChange={(e) => handleQuestionTypeChange(e.target.value)}>
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="FILL_BLANK">Fill in the Blank</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="q-difficulty">Difficulty</label>
                  <select
                    id="q-difficulty"
                    value={quizData.difficulty}
                    onChange={(e) => setQuizData(prev => ({ ...prev, difficulty: e.target.value }))}
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="q-points">Points</label>
                <input
                  type="number" id="q-points" min="1"
                  value={quizData.points}
                  onChange={(e) => setQuizData(prev => ({ ...prev, points: e.target.value }))}
                  required
                />
              </div>

              {quizData.question_type === 'FILL_BLANK' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="q-answer">Correct Answer</label>
                    <input
                      type="text" id="q-answer"
                      value={quizData.correct_text_answer}
                      onChange={(e) => setQuizData(prev => ({ ...prev, correct_text_answer: e.target.value }))}
                      placeholder="e.g. Merge Sort"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox" id="q-case-sensitive"
                      checked={quizData.case_sensitive}
                      onChange={(e) => setQuizData(prev => ({ ...prev, case_sensitive: e.target.checked }))}
                    />
                    <label htmlFor="q-case-sensitive" style={{ margin: 0 }}>Case-sensitive match</label>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>
                    Answer Options
                    {quizData.question_type === 'MULTIPLE_CHOICE'
                      ? ' (check all correct answers)'
                      : ' (select the one correct answer)'}
                  </label>
                  {quizData.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type={quizData.question_type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                        name="correct-option"
                        checked={opt.is_correct}
                        onChange={() => toggleOptionCorrect(idx)}
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOptionText(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        disabled={quizData.question_type === 'TRUE_FALSE'}
                        style={{ flex: 1 }}
                        required
                      />
                      {quizData.question_type !== 'TRUE_FALSE' && quizData.options.length > 2 && (
                        <button type="button" className="btn-icon-link delete" onClick={() => removeOption(idx)} title="Remove option">
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                  {quizData.question_type !== 'TRUE_FALSE' && (
                    <button type="button" className="btn btn-secondary btn-xs" onClick={addOption}>
                      <PlusIcon /> Add Option
                    </button>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="q-explanation">Explanation (optional)</label>
                <textarea
                  id="q-explanation"
                  value={quizData.explanation}
                  onChange={(e) => setQuizData(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Shown to students after they answer, to reinforce the concept."
                  rows="2"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)} disabled={actionLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}