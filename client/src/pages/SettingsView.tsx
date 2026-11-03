import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Container, Row, Col, Form, Button, Alert, 
  Spinner, Badge, Nav, Tab, InputGroup 
} from 'react-bootstrap';
import { 
  Save, Bell, Mail, Sparkles, Calendar, Palette, 
  Activity, CheckCircle, AlertCircle, Copy, RefreshCw, Eye, EyeOff, Send
} from 'lucide-react';
import axios from 'axios';
import type { Settings, GeminiModelInfo, PulseSummary } from '../types';
import { useTheme, type ThemeColor } from '../context/ThemeContext';

export default function SettingsView() {
  const [config, setConfig] = useState<Settings>({
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-pro',
    calendarificApiKey: '',
    gotifyUrl: '',
    gotifyToken: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    testRecipient: '',
    notificationsEnabled: true,
    dailyCheckTime: '09:00',
    lastDailyCheck: null,
  });

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>(
    location.state?.activeTab || 'gemini'
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'gotify' | 'email' | 'scheduler' | 'gemini' | null;
    state: 'loading' | 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, state: null, message: null });

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showGotifyToken, setShowGotifyToken] = useState(false);

  const [geminiModels, setGeminiModels] = useState<GeminiModelInfo[]>([]);

  const [pulseData, setPulseData] = useState<PulseSummary | null>(null);
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const { color, setColor, mode, toggleMode } = useTheme();

  const colors: { id: ThemeColor; value: string; label: string }[] = [
    { id: 'purple', value: '#6366f1', label: 'Indigo' },
    { id: 'blue', value: '#3b82f6', label: 'Blue' },
    { id: 'green', value: '#10b981', label: 'Green' },
    { id: 'orange', value: '#f97316', label: 'Orange' },
    { id: 'red', value: '#ef4444', label: 'Red' },
    { id: 'slate', value: '#64748b', label: 'Slate' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchGeminiModels();
  }, []);

  useEffect(() => {
    if (activeTab === 'pulse') {
      fetchPulseSummary();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data) {
        setConfig(prev => ({
          ...prev,
          ...res.data,
          geminiModel: res.data.geminiModel || 'gemini-2.5-pro'
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchGeminiModels = async () => {
    try {
      const res = await axios.get('/api/gemini/models');
      if (res.data?.models) {
        setGeminiModels(res.data.models);
      }
    } catch (err) {
      console.error('Failed to load Gemini models:', err);
      // Fallback
      setGeminiModels([
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Recommended)', description: 'Most capable model' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and responsive' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Lightweight' }
      ]);
    }
  };

  const fetchPulseSummary = async () => {
    setLoadingPulse(true);
    try {
      const res = await axios.get('/api/pulse/reminders?days=7');
      setPulseData(res.data);
    } catch (err) {
      console.error('Failed to load Pulse data:', err);
    } finally {
      setLoadingPulse(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await axios.post('/api/settings', config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert('Error saving settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const testGotify = async () => {
    setTestStatus({ type: 'gotify', state: 'loading', message: null });
    try {
      const res = await axios.post('/api/test/gotify', config);
      setTestStatus({
        type: 'gotify',
        state: 'success',
        message: res.data.message || 'Test notification sent to Gotify successfully!'
      });
    } catch (err: any) {
      setTestStatus({
        type: 'gotify',
        state: 'error',
        message: err.response?.data?.error || err.message || 'Failed to send Gotify notification'
      });
    }
  };

  const testEmail = async () => {
    setTestStatus({ type: 'email', state: 'loading', message: null });
    try {
      const res = await axios.post('/api/test/email', config);
      setTestStatus({
        type: 'email',
        state: 'success',
        message: res.data.message || 'Test email sent successfully!'
      });
    } catch (err: any) {
      setTestStatus({
        type: 'email',
        state: 'error',
        message: err.response?.data?.error || err.message || 'Failed to send test email'
      });
    }
  };

  const triggerDailyCheck = async () => {
    setTestStatus({ type: 'scheduler', state: 'loading', message: null });
    try {
      const res = await axios.post('/api/test/reminders');
      setTestStatus({
        type: 'scheduler',
        state: 'success',
        message: res.data.message
      });
      fetchSettings();
    } catch (err: any) {
      setTestStatus({
        type: 'scheduler',
        state: 'error',
        message: err.response?.data?.error || err.message || 'Daily check failed'
      });
    }
  };

  const copyPulseCurl = () => {
    const host = window.location.origin;
    const curlCommand = `curl -s "${host}/api/pulse/reminders?days=7"`;
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2500);
  };

  return (
    <Container fluid="xl" className="py-4 px-3 px-sm-4">
      {/* Header and Global Save */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 tracking-tight">Settings & Integrations</h2>
          <p className="text-muted mb-0 small">
            Configure Gemini AI, Gotify notifications, SMTP email, daily scheduler, and HomeServer Pulse API.
          </p>
        </div>

        <Button
          variant="primary"
          className="rounded-pill d-flex align-items-center gap-2 px-4 py-2 fw-medium shadow-sm hover-lift"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Spinner size="sm" animation="border" /> : <Save size={16} />}
          <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
        </Button>
      </div>

      {saveSuccess && (
        <Alert variant="success" className="d-flex align-items-center gap-2 shadow-sm border-0 mb-4">
          <CheckCircle size={18} className="text-success" />
          <span>Settings saved successfully and scheduler updated!</span>
        </Alert>
      )}

      {/* Tabs Container */}
      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'gemini')}>
        <Row className="g-4">
          {/* Navigation Sidebar */}
          <Col lg={3}>
            <div className="glass-panel p-2">
              <Nav variant="pills" className="flex-column gap-1">
                <Nav.Item>
                  <Nav.Link 
                    eventKey="gemini" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Sparkles size={18} className="text-primary" />
                    <span>Gemini AI</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="notifications" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Bell size={18} className="text-warning" />
                    <span>Gotify Push</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="email" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Mail size={18} className="text-info" />
                    <span>Email (SMTP)</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="scheduler" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Calendar size={18} className="text-success" />
                    <span>Daily Scheduler</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="pulse" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Activity size={18} className="text-danger" />
                    <span>HomeServer Pulse API</span>
                    <Badge bg="danger" className="ms-auto" style={{ fontSize: '0.65rem' }}>API</Badge>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="holiday" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Sparkles size={18} className="text-secondary" />
                    <span>Holiday API</span>
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link 
                    eventKey="appearance" 
                    className="d-flex align-items-center gap-2.5 rounded-3 py-2.5 px-3 fw-medium cursor-pointer"
                  >
                    <Palette size={18} className="text-purple" />
                    <span>Appearance</span>
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </div>
          </Col>

          {/* Content Pane */}
          <Col lg={9}>
            <Tab.Content>
              {/* TAB 1: Gemini AI */}
              <Tab.Pane eventKey="gemini">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-3 bg-primary text-white">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">Google Gemini AI Configuration</h5>
                        <div className="text-muted small">Powers natural language reminder creation and intelligent insights.</div>
                      </div>
                    </div>
                    {config.geminiApiKey ? (
                      <Badge bg="success" className="rounded-pill px-3 py-1.5 fw-normal">Configured</Badge>
                    ) : (
                      <Badge bg="secondary" className="rounded-pill px-3 py-1.5 fw-normal">Key Needed</Badge>
                    )}
                  </div>

                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Gemini API Key *</Form.Label>
                        <InputGroup>
                          <Form.Control
                            type={showGeminiKey ? 'text' : 'password'}
                            placeholder="Enter your Google Gemini API Key (e.g. AIzaSy...)"
                            value={config.geminiApiKey || ''}
                            onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                          />
                          <Button 
                            variant="outline-secondary" 
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                          >
                            {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </InputGroup>
                        <Form.Text className="text-muted">
                          Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Gemini Model</Form.Label>
                        <Form.Select
                          value={config.geminiModel || 'gemini-2.5-pro'}
                          onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                        >
                          {geminiModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name || m.id} {m.description ? `— ${m.description}` : ''}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Recommended: <strong>gemini-2.5-pro</strong> for optimal reasoning with recurring schedules and holiday inference.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* TAB 2: Gotify Push Notifications */}
              <Tab.Pane eventKey="notifications">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-3 bg-warning text-dark">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">Gotify Push Notifications</h5>
                        <div className="text-muted small">Deliver push alerts directly to your phone, desktop, or Gotify client.</div>
                      </div>
                    </div>

                    <Button
                      variant="outline-warning"
                      size="sm"
                      className="rounded-pill d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                      onClick={testGotify}
                      disabled={testStatus.type === 'gotify' && testStatus.state === 'loading'}
                    >
                      {testStatus.type === 'gotify' && testStatus.state === 'loading' ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Test Gotify</span>
                    </Button>
                  </div>

                  {/* Test feedback banner */}
                  {testStatus.type === 'gotify' && testStatus.message && (
                    <Alert 
                      variant={testStatus.state === 'success' ? 'success' : 'danger'} 
                      className="d-flex align-items-center gap-2 py-2 mb-4 shadow-sm"
                    >
                      {testStatus.state === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                      <span>{testStatus.message}</span>
                    </Alert>
                  )}

                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Gotify Server URL *</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="e.g., https://gotify.example.com or http://gotify:80"
                          value={config.gotifyUrl || ''}
                          onChange={(e) => setConfig({ ...config, gotifyUrl: e.target.value })}
                        />
                        <Form.Text className="text-muted">
                          If running in Docker on the same homelab network, you can use <code>http://gotify:80</code> or your public domain <code>https://gotify.rvitservices.uk</code>.
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Gotify Application Token *</Form.Label>
                        <InputGroup>
                          <Form.Control
                            type={showGotifyToken ? 'text' : 'password'}
                            placeholder="e.g., AlQEx4NFqRSl7SO"
                            value={config.gotifyToken || ''}
                            onChange={(e) => setConfig({ ...config, gotifyToken: e.target.value })}
                          />
                          <Button 
                            variant="outline-secondary" 
                            onClick={() => setShowGotifyToken(!showGotifyToken)}
                          >
                            {showGotifyToken ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </InputGroup>
                        <Form.Text className="text-muted">
                          Create an Application in your Gotify Web UI (under Apps) and paste the token here.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* TAB 3: Email (SMTP) */}
              <Tab.Pane eventKey="email">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-3 bg-info text-white">
                        <Mail size={20} />
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">Email Notifications (SMTP)</h5>
                        <div className="text-muted small">Receive formatted summary emails for due and upcoming obligations.</div>
                      </div>
                    </div>

                    <Button
                      variant="outline-info"
                      size="sm"
                      className="rounded-pill d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                      onClick={testEmail}
                      disabled={testStatus.type === 'email' && testStatus.state === 'loading'}
                    >
                      {testStatus.type === 'email' && testStatus.state === 'loading' ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Test Email</span>
                    </Button>
                  </div>

                  {/* Test feedback banner */}
                  {testStatus.type === 'email' && testStatus.message && (
                    <Alert 
                      variant={testStatus.state === 'success' ? 'success' : 'danger'} 
                      className="d-flex align-items-center gap-2 py-2 mb-4 shadow-sm"
                    >
                      {testStatus.state === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                      <span>{testStatus.message}</span>
                    </Alert>
                  )}

                  <Row className="g-3">
                    <Col md={8}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">SMTP Host *</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={config.smtpHost || ''}
                          onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Port *</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="587"
                          value={config.smtpPort || '587'}
                          onChange={(e) => setConfig({ ...config, smtpPort: e.target.value })}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Username / Email *</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="user@gmail.com"
                          value={config.smtpUser || ''}
                          onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Password / App Password *</Form.Label>
                        <InputGroup>
                          <Form.Control
                            type={showSmtpPass ? 'text' : 'password'}
                            placeholder="16-character App Password"
                            value={config.smtpPass || ''}
                            onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                          />
                          <Button 
                            variant="outline-secondary" 
                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                          >
                            {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </InputGroup>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">From Address (Optional)</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="no-reply@example.com"
                          value={config.smtpFrom || ''}
                          onChange={(e) => setConfig({ ...config, smtpFrom: e.target.value })}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Test Recipient Email</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="your-personal@email.com"
                          value={config.testRecipient || ''}
                          onChange={(e) => setConfig({ ...config, testRecipient: e.target.value })}
                        />
                        <Form.Text className="text-muted">Test emails will be delivered here.</Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* TAB 4: Daily Scheduler */}
              <Tab.Pane eventKey="scheduler">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-3 bg-success text-white">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">Daily Reminders Scheduler</h5>
                        <div className="text-muted small">Runs automated background checks to dispatch notifications.</div>
                      </div>
                    </div>

                    <Button
                      variant="outline-success"
                      size="sm"
                      className="rounded-pill d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                      onClick={triggerDailyCheck}
                      disabled={testStatus.type === 'scheduler' && testStatus.state === 'loading'}
                    >
                      {testStatus.type === 'scheduler' && testStatus.state === 'loading' ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      <span>Run Daily Check Now</span>
                    </Button>
                  </div>

                  {/* Scheduler feedback banner */}
                  {testStatus.type === 'scheduler' && testStatus.message && (
                    <Alert 
                      variant={testStatus.state === 'success' ? 'success' : 'danger'} 
                      className="d-flex align-items-center gap-2 py-2 mb-4 shadow-sm"
                    >
                      {testStatus.state === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                      <span>{testStatus.message}</span>
                    </Alert>
                  )}

                  <Row className="g-3">
                    <Col xs={12}>
                      <div className="p-3 rounded-3 border bg-body-tertiary d-flex align-items-center justify-content-between">
                        <div>
                          <div className="fw-medium">Enable Daily Reminders</div>
                          <div className="text-muted small">Sends Gotify push and email notifications for items due within their reminder window.</div>
                        </div>
                        <Form.Check
                          type="switch"
                          id="notif-enabled-switch"
                          checked={config.notificationsEnabled}
                          onChange={(e) => setConfig({ ...config, notificationsEnabled: e.target.checked })}
                          style={{ fontSize: '1.25rem' }}
                        />
                      </div>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Daily Check Time (Asia/Kolkata)</Form.Label>
                        <Form.Control
                          type="time"
                          value={config.dailyCheckTime || '09:00'}
                          onChange={(e) => setConfig({ ...config, dailyCheckTime: e.target.value })}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Last Scheduled Check</Form.Label>
                        <Form.Control
                          type="text"
                          readOnly
                          disabled
                          value={config.lastDailyCheck ? new Date(config.lastDailyCheck).toLocaleString() : 'Never run'}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* TAB 5: HomeServer Pulse API Integration */}
              <Tab.Pane eventKey="pulse">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-3 bg-danger text-white">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">HomeServer Pulse App API</h5>
                        <div className="text-muted small">
                          REST endpoints designed specifically for homelab widgets, dashboard monitors, and Pulse integrations.
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="rounded-pill d-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                      onClick={fetchPulseSummary}
                      disabled={loadingPulse}
                    >
                      <RefreshCw size={14} className={loadingPulse ? 'spin' : ''} />
                      <span>Refresh Live API</span>
                    </Button>
                  </div>

                  {/* Endpoints Documentation */}
                  <div className="mb-4">
                    <h6 className="fw-bold mb-2">Available Endpoints:</h6>
                    
                    <div className="d-flex flex-column gap-2">
                      <div className="p-3 rounded-3 border bg-body-tertiary">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <Badge bg="success" className="px-2 py-1">GET</Badge>
                          <code className="fw-bold">/api/pulse/reminders?days=7&status=active</code>
                        </div>
                        <p className="text-muted small mb-0">
                          Returns categorized reminders summary: <code>counts</code>, <code>nextUpcoming</code>, <code>dueToday</code>, <code>dueTomorrow</code>, <code>overdue</code>, and <code>upcoming</code> items.
                        </p>
                      </div>

                      <div className="p-3 rounded-3 border bg-body-tertiary">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <Badge bg="success" className="px-2 py-1">GET</Badge>
                          <code className="fw-bold">/api/pulse/health</code>
                        </div>
                        <p className="text-muted small mb-0">
                          Health check endpoint returning uptime, active reminder counts, and notification configuration statuses.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* cURL Snippet */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold small">Sample cURL Command:</span>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 text-decoration-none d-flex align-items-center gap-1"
                        onClick={copyPulseCurl}
                      >
                        <Copy size={13} />
                        <span>{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
                      </Button>
                    </div>
                    <pre className="p-3 rounded-3 bg-dark text-light small mb-0 overflow-auto">
                      {`curl -X GET "${window.location.origin}/api/pulse/reminders?days=7"`}
                    </pre>
                  </div>

                  {/* Live JSON Preview */}
                  <div>
                    <h6 className="fw-bold mb-2">Live API Response Preview:</h6>
                    {loadingPulse ? (
                      <div className="text-center py-4 text-muted">
                        <Spinner size="sm" animation="border" className="me-2" />
                        Fetching live data from /api/pulse/reminders...
                      </div>
                    ) : pulseData ? (
                      <pre className="p-3 rounded-3 bg-body-tertiary border small mb-0 overflow-auto" style={{ maxHeight: '280px' }}>
                        {JSON.stringify(pulseData, null, 2)}
                      </pre>
                    ) : (
                      <div className="p-3 rounded-3 border text-center text-muted small">
                        Click 'Refresh Live API' to preview.
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Pane>

              {/* TAB 6: Holiday API */}
              <Tab.Pane eventKey="holiday">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center gap-2 pb-3 mb-4 border-bottom">
                    <div className="p-2 rounded-3 bg-secondary text-white">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h5 className="mb-0 fw-bold">Holiday API (Calendarific)</h5>
                      <div className="text-muted small">Accurately determine dates for variable Indian festivals like Diwali and Pongal.</div>
                    </div>
                  </div>

                  <Row className="g-3">
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium small">Calendarific API Key</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter Calendarific API Key"
                          value={config.calendarificApiKey || ''}
                          onChange={(e) => setConfig({ ...config, calendarificApiKey: e.target.value })}
                        />
                        <Form.Text className="text-muted">
                          Obtain a free API key at <a href="https://calendarific.com" target="_blank" rel="noreferrer">calendarific.com</a>.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* TAB 7: Appearance */}
              <Tab.Pane eventKey="appearance">
                <div className="glass-panel p-4">
                  <div className="d-flex align-items-center gap-2 pb-3 mb-4 border-bottom">
                    <div className="p-2 rounded-3 bg-purple text-white" style={{ background: '#6366f1' }}>
                      <Palette size={20} />
                    </div>
                    <div>
                      <h5 className="mb-0 fw-bold">Appearance & Themes</h5>
                      <div className="text-muted small">Personalize your color scheme and interface mode.</div>
                    </div>
                  </div>

                  <Row className="g-4">
                    <Col sm={6}>
                      <div className="p-3 rounded-3 border bg-body-tertiary">
                        <div className="fw-medium mb-1">Theme Mode</div>
                        <p className="text-muted small mb-3">Switch between clean light mode and immersive dark mode.</p>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="rounded-pill px-3"
                          onClick={toggleMode}
                        >
                          Switch to {mode === 'light' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
                        </Button>
                      </div>
                    </Col>

                    <Col sm={6}>
                      <div className="p-3 rounded-3 border bg-body-tertiary">
                        <div className="fw-medium mb-1">Accent Color</div>
                        <p className="text-muted small mb-3">Choose the primary accent palette for badges and buttons.</p>
                        <div className="d-flex flex-wrap gap-2">
                          {colors.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`btn btn-sm rounded-pill px-3 py-1 text-white border-0 ${color === c.id ? 'ring-2' : ''}`}
                              style={{ 
                                backgroundColor: c.value,
                                outline: color === c.id ? '2px solid var(--bs-body-color)' : 'none',
                                outlineOffset: '2px'
                              }}
                              onClick={() => setColor(c.id)}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </Container>
  );
}
