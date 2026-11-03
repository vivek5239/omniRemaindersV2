import { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge } from 'react-bootstrap';
import { Calendar, RefreshCw } from 'lucide-react';
import axios from 'axios';
import type { Reminder } from '../types';

interface ReminderModalProps {
  show: boolean;
  onHide: () => void;
  onSave: (rem: Partial<Reminder>) => void;
  reminder?: Reminder | null;
}

const CATEGORIES = [
  'General', 'Work', 'Personal', 'Health', 'Finance', 
  'Appointments', 'Study', 'Travel', 'Shopping', 'Culture', 'Other'
];

const TAMIL_MONTHS = [
  { name: 'Chithirai', days: 31 }, { name: 'Vaikasi', days: 31 },
  { name: 'Aani', days: 32 }, { name: 'Aadi', days: 31 },
  { name: 'Avani', days: 31 }, { name: 'Purattasi', days: 31 },
  { name: 'Aippasi', days: 30 }, { name: 'Karthigai', days: 29 },
  { name: 'Margazhi', days: 29 }, { name: 'Thai', days: 30 },
  { name: 'Maasi', days: 30 }, { name: 'Panguni', days: 30 }
];

export default function ReminderModal({ show, onHide, onSave, reminder }: ReminderModalProps) {
  const [formData, setFormData] = useState<Partial<Reminder>>({
    Name: '',
    'Next Payment': new Date().toISOString().split('T')[0],
    Time: '09:00',
    Category: 'General',
    Active: 'Yes',
    Notes: '',
    remindBefore: 3,
    Repeat: 'One-Time',
    Source: 'Manual'
  });
  const [useTamilDate, setUseTamilDate] = useState(false);
  const [tamilMonth, setTamilMonth] = useState(0);
  const [tamilDay, setTamilDay] = useState(1);
  const [fetchingHoliday, setFetchingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  useEffect(() => {
    if (reminder) {
      setFormData({
        ...reminder,
        remindBefore: typeof reminder.remindBefore === 'number' ? reminder.remindBefore : 3,
        Repeat: reminder.Repeat || 'One-Time',
        Time: reminder.Time || '09:00',
        Source: reminder.Source || 'Manual'
      });
      if (reminder.tamilMonthIndex !== undefined && reminder.tamilDay !== undefined) {
        setUseTamilDate(true);
        setTamilMonth(reminder.tamilMonthIndex);
        setTamilDay(reminder.tamilDay);
      } else {
        setUseTamilDate(false);
      }
    } else {
      setFormData({
        Name: '',
        'Next Payment': new Date().toISOString().split('T')[0],
        Time: '09:00',
        Category: 'General',
        Active: 'Yes',
        Notes: '',
        remindBefore: 3,
        Repeat: 'One-Time',
        Source: 'Manual'
      });
      setUseTamilDate(false);
      setTamilMonth(0);
      setTamilDay(1);
    }
    setHolidayError(null);
  }, [reminder, show]);

  const handleConvertTamil = async (mIndex: number, day: number) => {
    try {
      const res = await axios.post('/api/convert-tamil-date', {
        tamilMonthIndex: mIndex,
        tamilDay: day
      });
      setFormData(prev => ({
        ...prev,
        'Next Payment': res.data.gregorianDate,
        tamilMonthIndex: mIndex,
        tamilDay: day
      }));
    } catch (err: any) {
      console.error('Failed to convert Tamil date:', err);
    }
  };

  const handleFetchHolidayDate = async () => {
    if (!formData.HolidayType) return;
    setFetchingHoliday(true);
    setHolidayError(null);
    try {
      const currentYear = formData['Next Payment']
        ? new Date(formData['Next Payment']).getFullYear()
        : new Date().getFullYear();

      // Fetch next year
      const targetYear = currentYear + 1;
      const res = await axios.get('/api/holiday-date', {
        params: { holidayName: formData.HolidayType, year: targetYear }
      });

      if (res.data.date) {
        setFormData(prev => ({
          ...prev,
          'Next Payment': res.data.date,
          Notes: res.data.details?.description 
            ? `${prev.Notes ? prev.Notes + '\n' : ''}[Holiday Details] ${res.data.details.description}`
            : prev.Notes
        }));
      }
    } catch (err: any) {
      setHolidayError(err.response?.data?.error || 'Could not fetch holiday date');
    } finally {
      setFetchingHoliday(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Name?.trim()) {
      alert('Reminder name is required.');
      return;
    }
    if (!formData['Next Payment']) {
      alert('Due date is required.');
      return;
    }
    onSave(formData);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2 fs-5">
          <Calendar size={20} className="text-primary" />
          <span>{formData.id ? 'Edit Reminder' : 'Create New Reminder'}</span>
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body className="p-4">
          <Row className="g-3">
            {/* Reminder Name */}
            <Col xs={12}>
              <Form.Group>
                <Form.Label className="fw-medium small">Reminder Name / Title *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., Pay electricity bill"
                  value={formData.Name || ''}
                  onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                  required
                />
              </Form.Group>
            </Col>

            {/* Date & Time */}
            <Col md={7}>
              <Form.Group>
                <Form.Label className="fw-medium small">Due Date *</Form.Label>
                <Form.Control
                  type="date"
                  value={formData['Next Payment'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'Next Payment': e.target.value })}
                  required
                />
              </Form.Group>
            </Col>

            <Col md={5}>
              <Form.Group>
                <Form.Label className="fw-medium small">Time</Form.Label>
                <Form.Control
                  type="time"
                  value={formData.Time || '09:00'}
                  onChange={(e) => setFormData({ ...formData, Time: e.target.value })}
                />
              </Form.Group>
            </Col>

            {/* Recurrence & Category */}
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-medium small">Recurrence</Form.Label>
                <Form.Select
                  value={formData.Repeat || 'One-Time'}
                  onChange={(e) => setFormData({ ...formData, Repeat: e.target.value as any })}
                >
                  <option value="One-Time">One-Time</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-medium small">Category</Form.Label>
                <Form.Select
                  value={formData.Category || 'General'}
                  onChange={(e) => setFormData({ ...formData, Category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-medium small">Remind Before (Days)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max="30"
                  value={formData.remindBefore ?? 3}
                  onChange={(e) => setFormData({ ...formData, remindBefore: parseInt(e.target.value, 10) || 0 })}
                />
              </Form.Group>
            </Col>

            {/* Tamil Date Converter Switch */}
            <Col xs={12}>
              <div className="p-3 rounded-3 border bg-body-tertiary">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <Form.Check
                    type="switch"
                    id="tamil-date-switch"
                    label={<span className="fw-medium small">Use Tamil Calendar Date</span>}
                    checked={useTamilDate}
                    onChange={(e) => {
                      setUseTamilDate(e.target.checked);
                      if (e.target.checked) {
                        handleConvertTamil(tamilMonth, tamilDay);
                      }
                    }}
                  />
                  {useTamilDate && (
                    <Badge bg="info" className="fw-normal">
                      Calculates next Gregorian match
                    </Badge>
                  )}
                </div>

                {useTamilDate && (
                  <Row className="g-2 pt-2">
                    <Col sm={6}>
                      <Form.Select
                        value={tamilMonth}
                        onChange={(e) => {
                          const m = parseInt(e.target.value, 10);
                          setTamilMonth(m);
                          handleConvertTamil(m, tamilDay);
                        }}
                      >
                        {TAMIL_MONTHS.map((tm, idx) => (
                          <option key={tm.name} value={idx}>{tm.name}</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col sm={6}>
                      <Form.Control
                        type="number"
                        min="1"
                        max={TAMIL_MONTHS[tamilMonth]?.days || 31}
                        value={tamilDay}
                        onChange={(e) => {
                          const d = parseInt(e.target.value, 10) || 1;
                          setTamilDay(d);
                          handleConvertTamil(tamilMonth, d);
                        }}
                      />
                    </Col>
                  </Row>
                )}
              </div>
            </Col>

            {/* Holiday Type & Calendarific Auto-Sync */}
            <Col xs={12}>
              <Form.Group>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <Form.Label className="fw-medium small mb-0">Holiday Sync (e.g., Diwali, Pongal, Christmas)</Form.Label>
                  {formData.HolidayType && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none d-flex align-items-center gap-1 small"
                      onClick={handleFetchHolidayDate}
                      disabled={fetchingHoliday}
                    >
                      <RefreshCw size={12} className={fetchingHoliday ? 'spin' : ''} />
                      <span>{fetchingHoliday ? 'Fetching...' : 'Fetch Next Year Date'}</span>
                    </Button>
                  )}
                </div>
                <Form.Control
                  type="text"
                  placeholder="e.g., Diwali or Pongal"
                  value={formData.HolidayType || ''}
                  onChange={(e) => setFormData({ ...formData, HolidayType: e.target.value })}
                />
                {holidayError && (
                  <div className="text-danger small mt-1">{holidayError}</div>
                )}
              </Form.Group>
            </Col>

            {/* Notes */}
            <Col xs={12}>
              <Form.Group>
                <Form.Label className="fw-medium small">Notes / Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Add any additional details or instructions..."
                  value={formData.Notes || ''}
                  onChange={(e) => setFormData({ ...formData, Notes: e.target.value })}
                />
              </Form.Group>
            </Col>

            {/* Active Toggle & Source */}
            <Col sm={6}>
              <Form.Group>
                <Form.Label className="fw-medium small">Status</Form.Label>
                <Form.Select
                  value={formData.Active || 'Yes'}
                  onChange={(e) => setFormData({ ...formData, Active: e.target.value as any })}
                >
                  <option value="Yes">Active (Receive reminders)</option>
                  <option value="No">Inactive / Completed</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col sm={6}>
              <Form.Group>
                <Form.Label className="fw-medium small">Source Tag</Form.Label>
                <Form.Select
                  value={formData.Source || 'Manual'}
                  onChange={(e) => setFormData({ ...formData, Source: e.target.value as any })}
                >
                  <option value="Manual">Manual</option>
                  <option value="AI">AI Created</option>
                  <option value="API">API Sync</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="border-top">
          <Button variant="outline-secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save Reminder
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
