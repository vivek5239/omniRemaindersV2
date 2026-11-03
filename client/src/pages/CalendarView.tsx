import { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Badge, Spinner, Button } from 'react-bootstrap';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, parseISO, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle, Edit2, AlertCircle } from 'lucide-react';
import type { Reminder } from '../types';
import ReminderModal from '../components/ReminderModal';

export default function CalendarView() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [modalReminder, setModalReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/reminders');
      setReminders(res.data.reminders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (val: any) => {
    if (val instanceof Date) {
      setSelectedDate(val);
    }
  };

  const handleAddForDate = () => {
    const formatted = format(selectedDate, 'yyyy-MM-dd');
    setModalReminder({
      id: '',
      Name: '',
      'Next Payment': formatted,
      Time: '09:00',
      Category: 'General',
      Active: 'Yes',
      Repeat: 'One-Time'
    });
    setShowModal(true);
  };

  const handleEdit = (rem: Reminder) => {
    setModalReminder(rem);
    setShowModal(true);
  };

  const handleSaveModal = async (remData: Partial<Reminder>) => {
    try {
      await axios.post('/api/reminders', remData);
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert('Error saving reminder: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Mark "${name}" as completed?`)) return;
    try {
      await axios.delete(`/api/reminders/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const getTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayReminders = reminders.filter(rem => {
        if (!rem['Next Payment'] || rem.Active !== 'Yes') return false;
        try {
          return isSameDay(parseISO(rem['Next Payment']), date);
        } catch {
          return false;
        }
      });

      if (dayReminders.length > 0) {
        return (
          <div className="calendar-tile-content">
            {dayReminders.slice(0, 2).map(rem => (
              <div key={rem.id} className="tile-reminder-pill">
                {rem.Name}
              </div>
            ))}
            {dayReminders.length > 2 && (
              <span className="text-muted" style={{ fontSize: '0.6rem' }}>
                +{dayReminders.length - 2} more
              </span>
            )}
          </div>
        );
      }
    }
    return null;
  };

  const selectedDayReminders = reminders.filter(rem => {
    if (!rem['Next Payment']) return false;
    try {
      return isSameDay(parseISO(rem['Next Payment']), selectedDate);
    } catch {
      return false;
    }
  });

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Loading calendar...</p>
      </Container>
    );
  }

  return (
    <Container fluid="xl" className="py-4 px-3 px-sm-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 tracking-tight">Reminder Calendar</h2>
          <p className="text-muted mb-0 small">
            View scheduled tasks by month and day. Click any date to view or schedule reminders.
          </p>
        </div>

        <Button
          variant="primary"
          className="rounded-pill d-flex align-items-center gap-2 px-3 py-2 fw-medium shadow-sm hover-lift"
          onClick={handleAddForDate}
        >
          <Plus size={16} />
          <span>Add Reminder for {format(selectedDate, 'MMM d')}</span>
        </Button>
      </div>

      <Row className="g-4">
        {/* Calendar Grid Container */}
        <Col lg={8}>
          <div className="glass-panel p-4 overflow-hidden">
            <Calendar
              onChange={handleDateChange}
              value={selectedDate}
              tileContent={getTileContent}
              className="w-100 border-0"
            />
          </div>
        </Col>

        {/* Selected Day Reminders Sidebar */}
        <Col lg={4}>
          <div className="glass-panel h-100 d-flex flex-column">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <CalendarIcon size={18} className="text-primary" />
                <h6 className="mb-0 fw-bold">{format(selectedDate, 'MMMM dd, yyyy')}</h6>
              </div>
              <Badge bg="primary" pill>
                {selectedDayReminders.length}
              </Badge>
            </div>

            <div className="p-3 flex-grow-1 overflow-auto" style={{ maxHeight: '500px' }}>
              {selectedDayReminders.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {selectedDayReminders.map(rem => (
                    <div 
                      key={rem.id} 
                      className="p-3 rounded-3 border bg-body-tertiary d-flex flex-column gap-2 shadow-sm"
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div>
                          <div className="fw-semibold text-body">{rem.Name}</div>
                          {rem.Time && (
                            <div className="small text-muted d-flex align-items-center gap-1 mt-0.5">
                              <Clock size={12} />
                              <span>{rem.Time}</span>
                            </div>
                          )}
                        </div>

                        <Badge bg="secondary" className="rounded-pill fw-normal" style={{ fontSize: '0.65rem' }}>
                          {rem.Category || 'General'}
                        </Badge>
                      </div>

                      {rem.Notes && (
                        <div className="small text-muted" style={{ fontSize: '0.78rem' }}>
                          {rem.Notes}
                        </div>
                      )}

                      <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-1">
                        <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                          Repeat: {rem.Repeat || 'One-Time'}
                        </span>

                        <div className="d-flex align-items-center gap-1">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 26, height: 26 }}
                            onClick={() => handleEdit(rem)}
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </Button>

                          <Button
                            variant="outline-success"
                            size="sm"
                            className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 26, height: 26 }}
                            onClick={() => handleDelete(rem.id, rem.Name)}
                            title="Mark Done"
                          >
                            <CheckCircle size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted">
                  <AlertCircle size={32} className="opacity-40 mb-2" />
                  <p className="mb-2 small">No reminders for this date.</p>
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="rounded-pill px-3"
                    onClick={handleAddForDate}
                  >
                    Schedule One
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <ReminderModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onSave={handleSaveModal}
        reminder={modalReminder}
      />
    </Container>
  );
}
