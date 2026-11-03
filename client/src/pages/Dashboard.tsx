import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Container, Row, Col, Badge, Spinner, Button, Form, 
  InputGroup, Modal, OverlayTrigger, Tooltip 
} from 'react-bootstrap';
import { 
  CheckCircle, PlusCircle, Clock, CalendarX, Sparkles, AlertCircle, 
  CalendarCheck, ArrowRight, RefreshCw, Send, Bell, Repeat as RepeatIcon
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { DashboardData, Settings } from '../types';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLE_PROMPTS = [
  "Pay electricity bill on 25th of every month at 10am",
  "Send gift to sister for Diwali remind 3 days before",
  "Car insurance due next Friday",
  "Annual health checkup on Dec 1st"
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nlReminderText, setNlReminderText] = useState('');
  const [nlReminderLoading, setNlReminderLoading] = useState(false);
  const [aiConversation, setAiConversation] = useState<ConversationTurn[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [remindersRes, settingsRes] = await Promise.all([
        axios.get('/api/reminders'),
        axios.get('/api/settings')
      ]);
      const settingsData = settingsRes.data;
      if (settingsData) {
        const invalid = ['gemini-3.5-pro', 'gemini-3.8-pro', 'gemini-3.5-flash-lite'];
        if (!settingsData.geminiModel || invalid.includes(settingsData.geminiModel)) {
          settingsData.geminiModel = 'gemini-3.8-flash';
        }
      }
      setData(remindersRes.data);
      setSettings(settingsData);
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/reminders');
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleMarkPaid = async (id: string, name: string) => {
    try {
      if (window.confirm(`Mark "${name}" as completed? This will remove it from active reminders.`)) {
        await axios.delete(`/api/reminders/${id}`);
        showToast(`Marked "${name}" as completed!`);
        fetchData();
      }
    } catch (err: any) {
      console.error('Error marking as done:', err);
      alert('Failed to mark reminder as completed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleNlReminderSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const promptToSubmit = (customText || nlReminderText).trim();
    if (!promptToSubmit) return;

    if (!settings?.geminiApiKey) {
      if (window.confirm('Gemini API Key is not configured yet. Would you like to go to Settings to add your key?')) {
        navigate('/settings');
      }
      return;
    }

    setNlReminderLoading(true);

    const userTurn: ConversationTurn = { role: 'user', content: promptToSubmit };
    const updatedConversation = [...aiConversation, userTurn];
    const textForAi = updatedConversation.map(turn => `${turn.role}: ${turn.content}`).join('\n');

    try {
      const res = await axios.post('/api/ai/create-reminder', {
        text: textForAi,
        model: settings.geminiModel || 'gemini-3.8-flash'
      });

      if (res.data.question) {
        setAiConversation([...updatedConversation, { role: 'assistant', content: res.data.question }]);
        setNlReminderText('');
      } else {
        const newReminder = res.data;
        showToast(`✨ Reminder "${newReminder.Name}" created successfully!`);
        setAiConversation([]);
        setNlReminderText('');
        fetchData();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      alert(`Gemini AI Reminder Error: ${errorMsg}`);
    } finally {
      setNlReminderLoading(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!settings?.geminiApiKey) {
      if (window.confirm('Gemini API Key is needed for insights. Go to Settings?')) {
        navigate('/settings');
      }
      return;
    }

    setAnalyzing(true);
    setShowAnalysisModal(true);
    try {
      const res = await axios.post('/api/ai/analyze');
      setAiAnalysis(res.data.analysis);
    } catch (err: any) {
      setAiAnalysis(`Error generating insights: ${err.response?.data?.error || err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted">Loading your reminders dashboard...</p>
      </Container>
    );
  }

  const allReminders = data?.reminders || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReminders = allReminders.filter(rem => rem.Active === 'Yes' && rem['Next Payment']);

  const upcomingReminders = activeReminders
    .filter(rem => {
      const dueDate = parseISO(rem['Next Payment']);
      return dueDate >= today;
    })
    .sort((a, b) => parseISO(a['Next Payment']).getTime() - parseISO(b['Next Payment']).getTime());

  const pastReminders = activeReminders
    .filter(rem => {
      const dueDate = parseISO(rem['Next Payment']);
      return dueDate < today;
    })
    .sort((a, b) => parseISO(b['Next Payment']).getTime() - parseISO(a['Next Payment']).getTime());

  // Calculations for stats
  const overdueCount = pastReminders.length;
  const dueTodayCount = upcomingReminders.filter(rem => {
    return differenceInDays(parseISO(rem['Next Payment']), today) === 0;
  }).length;
  const dueWeekCount = upcomingReminders.filter(rem => {
    const diff = differenceInDays(parseISO(rem['Next Payment']), today);
    return diff >= 0 && diff <= 7;
  }).length;

  return (
    <Container fluid="xl" className="py-4 px-3 px-sm-4">
      {/* Toast Alert */}
      {actionMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm border-0 d-flex align-items-center justify-content-between mb-4" role="alert">
          <div className="d-flex align-items-center gap-2">
            <CheckCircle size={18} className="text-success" />
            <span>{actionMessage}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setActionMessage(null)} aria-label="Close"></button>
        </div>
      )}

      {/* Top Welcome & Insights Action */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 tracking-tight">Reminders Overview</h2>
          <p className="text-muted mb-0 small">
            Stay on top of bill dates, annual festivals, and recurring obligations with automated notifications.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-primary"
            className="rounded-pill d-flex align-items-center gap-2 px-3 py-2 fw-medium shadow-sm hover-lift"
            onClick={handleRunAiAnalysis}
            disabled={analyzing}
          >
            <Sparkles size={16} className="text-primary" />
            <span>{analyzing ? 'Analyzing...' : 'AI Insights'}</span>
          </Button>

          <Button
            variant="primary"
            className="rounded-pill d-flex align-items-center gap-2 px-3 py-2 fw-medium shadow-sm hover-lift"
            onClick={() => navigate('/reminders', { state: { openModal: true } })}
          >
            <PlusCircle size={16} />
            <span>New Reminder</span>
          </Button>
        </div>
      </div>

      {/* Modern 4 Quick Stats Cards */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <div className="glass-panel p-3 h-100 d-flex align-items-center gap-3">
            <div className="stat-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
              <Bell size={22} />
            </div>
            <div>
              <div className="text-muted small fw-medium">Active Reminders</div>
              <div className="fs-4 fw-bold">{activeReminders.length}</div>
            </div>
          </div>
        </Col>

        <Col xs={6} md={3}>
          <div className={`glass-panel p-3 h-100 d-flex align-items-center gap-3 ${overdueCount > 0 ? 'pulse-overdue' : ''}`}>
            <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div className="text-muted small fw-medium">Overdue</div>
              <div className={`fs-4 fw-bold ${overdueCount > 0 ? 'text-danger' : ''}`}>
                {overdueCount}
              </div>
            </div>
          </div>
        </Col>

        <Col xs={6} md={3}>
          <div className="glass-panel p-3 h-100 d-flex align-items-center gap-3">
            <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <Clock size={22} />
            </div>
            <div>
              <div className="text-muted small fw-medium">Due Today</div>
              <div className={`fs-4 fw-bold ${dueTodayCount > 0 ? 'text-warning' : ''}`}>
                {dueTodayCount}
              </div>
            </div>
          </div>
        </Col>

        <Col xs={6} md={3}>
          <div className="glass-panel p-3 h-100 d-flex align-items-center gap-3">
            <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <CalendarCheck size={22} />
            </div>
            <div>
              <div className="text-muted small fw-medium">Next 7 Days</div>
              <div className="fs-4 fw-bold">{dueWeekCount}</div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Gemini AI Natural Language Command Box */}
      <div className="glass-panel p-4 mb-4" style={{
        background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))',
        border: '1px solid rgba(99, 102, 241, 0.25)'
      }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="p-1 rounded bg-primary text-white">
              <Sparkles size={16} />
            </div>
            <span className="fw-bold">Smart Natural Language Creation</span>
            <Badge bg="secondary" className="rounded-pill text-uppercase fw-normal" style={{ fontSize: '0.65rem' }}>
              {settings?.geminiModel || 'gemini-3.8-flash'}
            </Badge>
          </div>
          <span className="text-muted small">
            Type anything in plain English or Tamil holiday names
          </span>
        </div>

        {/* Conversation clarifications if any */}
        {aiConversation.length > 0 && (
          <div className="mb-3 p-3 bg-body rounded-3 border">
            {aiConversation.map((turn, index) => (
              <div key={index} className={`d-flex flex-column mb-2 ${turn.role === 'user' ? 'align-items-end' : 'align-items-start'}`}>
                <div className={`px-3 py-2 rounded-3 small ${
                  turn.role === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-body-secondary text-body border'
                }`}>
                  {turn.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <Form onSubmit={handleNlReminderSubmit}>
          <InputGroup className="shadow-sm">
            <Form.Control
              type="text"
              placeholder={aiConversation.length > 0 ? "Reply to Gemini's question..." : "e.g., 'Pay broadband bill on the 5th of every month at 9am'"}
              value={nlReminderText}
              onChange={(e) => setNlReminderText(e.target.value)}
              disabled={nlReminderLoading}
              className="py-2 px-3 border-end-0"
              style={{ fontSize: '0.95rem' }}
            />
            <Button 
              variant="primary" 
              type="submit" 
              disabled={nlReminderLoading}
              className="px-4 d-flex align-items-center gap-2"
            >
              {nlReminderLoading ? (
                <>
                  <Spinner size="sm" animation="border" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span className="d-none d-sm-inline">Create Reminder</span>
                </>
              )}
            </Button>
          </InputGroup>
        </Form>

        {/* Example Prompt Chips */}
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          <span className="text-muted small fw-medium">Try:</span>
          {EXAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              className="chip-btn border-0 shadow-none text-start text-truncate"
              style={{ maxWidth: '280px' }}
              onClick={() => {
                setNlReminderText(prompt);
              }}
            >
              💡 {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Reminder Sections */}
      <Row className="g-4">
        {/* Upcoming Reminders Column */}
        <Col lg={7}>
          <div className="glass-panel h-100 d-flex flex-column">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <Clock size={18} className="text-primary" />
                <h6 className="mb-0 fw-bold">Upcoming Reminders</h6>
                <Badge bg="primary" pill style={{ fontSize: '0.7rem' }}>
                  {upcomingReminders.length}
                </Badge>
              </div>
              <Link to="/reminders" className="small text-primary text-decoration-none fw-medium d-flex align-items-center gap-1">
                <span>View all</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="p-0 flex-grow-1 overflow-auto" style={{ maxHeight: '520px' }}>
              {upcomingReminders.length > 0 ? (
                <div className="list-group list-group-flush">
                  {upcomingReminders.map(rem => {
                    const daysLeft = differenceInDays(parseISO(rem['Next Payment']), today);
                    const isToday = daysLeft === 0;
                    const isTomorrow = daysLeft === 1;

                    return (
                      <div 
                        key={rem.id} 
                        className="list-group-item p-3 bg-transparent border-0 border-bottom d-flex align-items-center justify-content-between gap-3 hover-bg-theme transition-all"
                      >
                        <div className="d-flex flex-column gap-1 overflow-hidden">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-semibold text-body text-truncate">{rem.Name}</span>
                            {rem.HolidayType && (
                              <Badge bg="warning" text="dark" className="rounded-pill" style={{ fontSize: '0.65rem' }}>
                                🪔 {rem.HolidayType}
                              </Badge>
                            )}
                          </div>

                          <div className="d-flex flex-wrap align-items-center gap-2 small text-muted">
                            <span>{format(parseISO(rem['Next Payment']), 'MMM dd, yyyy')}</span>
                            {rem.Time && <span>• {rem.Time}</span>}
                            {rem.Category && (
                              <Badge bg="light" text="dark" className="border fw-normal" style={{ fontSize: '0.65rem' }}>
                                {rem.Category}
                              </Badge>
                            )}
                            {rem.Repeat && rem.Repeat !== 'One-Time' && (
                              <span className="d-flex align-items-center gap-1 text-primary" style={{ fontSize: '0.75rem' }}>
                                <RepeatIcon size={12} /> {rem.Repeat}
                              </span>
                            )}
                          </div>

                          {rem.Notes && (
                            <div className="text-muted small text-truncate" style={{ maxWidth: '420px', fontSize: '0.78rem' }}>
                              {rem.Notes}
                            </div>
                          )}
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <Badge 
                            bg={isToday ? 'warning' : isTomorrow ? 'info' : 'primary'} 
                            className="rounded-pill px-2.5 py-1.5"
                            style={{ fontSize: '0.75rem' }}
                          >
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `In ${daysLeft}d`}
                          </Badge>

                          <OverlayTrigger overlay={<Tooltip>Mark as Completed</Tooltip>}>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 32, height: 32 }}
                              onClick={() => handleMarkPaid(rem.id, rem.Name)}
                            >
                              <CheckCircle size={16} />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-muted">
                  <Clock size={36} className="text-muted mb-2 opacity-50" />
                  <p className="mb-0">No upcoming reminders scheduled.</p>
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Past / Overdue Reminders Column */}
        <Col lg={5}>
          <div className="glass-panel h-100 d-flex flex-column">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <CalendarX size={18} className="text-danger" />
                <h6 className="mb-0 fw-bold">Overdue / Past</h6>
                <Badge bg={overdueCount > 0 ? 'danger' : 'secondary'} pill style={{ fontSize: '0.7rem' }}>
                  {pastReminders.length}
                </Badge>
              </div>
              <span className="small text-muted">Needs attention</span>
            </div>

            <div className="p-0 flex-grow-1 overflow-auto" style={{ maxHeight: '520px' }}>
              {pastReminders.length > 0 ? (
                <div className="list-group list-group-flush">
                  {pastReminders.map(rem => {
                    const daysAgo = Math.abs(differenceInDays(parseISO(rem['Next Payment']), today));

                    return (
                      <div 
                        key={rem.id} 
                        className="list-group-item p-3 bg-transparent border-0 border-bottom d-flex align-items-center justify-content-between gap-3 hover-bg-theme"
                      >
                        <div className="d-flex flex-column gap-1 overflow-hidden">
                          <span className="fw-semibold text-body text-truncate">{rem.Name}</span>
                          <div className="d-flex align-items-center gap-2 small text-muted">
                            <span className="text-danger fw-medium">{format(parseISO(rem['Next Payment']), 'MMM dd, yyyy')}</span>
                            {rem.Category && (
                              <Badge bg="light" text="dark" className="border fw-normal" style={{ fontSize: '0.65rem' }}>
                                {rem.Category}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <Badge bg="danger" className="rounded-pill px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
                            {daysAgo === 0 ? 'Due' : `${daysAgo}d ago`}
                          </Badge>

                          <OverlayTrigger overlay={<Tooltip>Mark Done</Tooltip>}>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 30, height: 30 }}
                              onClick={() => handleMarkPaid(rem.id, rem.Name)}
                            >
                              <CheckCircle size={15} />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-muted">
                  <CheckCircle size={36} className="text-success mb-2 opacity-50" />
                  <p className="mb-0">All caught up! No overdue reminders.</p>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* AI Insights Modal */}
      <Modal show={showAnalysisModal} onHide={() => setShowAnalysisModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-5">
            <Sparkles size={20} className="text-primary" />
            <span>Gemini AI Reminders Analysis</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {analyzing ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <p className="text-muted">Gemini is analyzing your active reminders, recurrence schedules, and priorities...</p>
            </div>
          ) : (
            <div className="ai-report-content" style={{ whiteSpace: 'pre-line', lineHeight: '1.7' }}>
              {aiAnalysis || 'No insights available yet.'}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="outline-secondary" onClick={() => setShowAnalysisModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleRunAiAnalysis} disabled={analyzing}>
            <RefreshCw size={14} className={`me-1 ${analyzing ? 'spin' : ''}`} />
            Re-analyze
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
