import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Container, Row, Col, Table, Badge, Spinner, Button, 
  Form, InputGroup, OverlayTrigger, Tooltip 
} from 'react-bootstrap';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, Copy, 
  Search, CheckCircle, LayoutGrid, List, AlertCircle,
  Clock, Repeat as RepeatIcon
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Reminder } from '../types';
import ReminderModal from '../components/ReminderModal';

const CATEGORIES = [
  'All', 'General', 'Work', 'Personal', 'Health', 'Finance', 
  'Appointments', 'Study', 'Travel', 'Shopping', 'Culture', 'Other'
];

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterRecurrence, setFilterRecurrence] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Overdue' | 'Inactive'>('All');
  const [sortBy, setSortBy] = useState<keyof Reminder>('Next Payment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const location = useLocation();
  const highlightedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    fetchData();
    if (location.state?.openModal) {
      handleAddNew();
    }
    if (location.state?.newReminderId) {
      setHighlightedId(location.state.newReminderId);
      setTimeout(() => setHighlightedId(null), 3000);
    }
  }, [location.state]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reminders');
      setReminders(res.data.reminders || []);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedReminder(null);
    setShowModal(true);
  };

  const handleEdit = (rem: Reminder) => {
    setSelectedReminder(rem);
    setShowModal(true);
  };

  const handleClone = (rem: Reminder) => {
    const cloned: Reminder = {
      ...rem,
      id: '', // Will be assigned on save
      Name: `${rem.Name} (Copy)`,
      Source: 'Manual'
    };
    setSelectedReminder(cloned);
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await axios.delete(`/api/reminders/${id}`);
      showToast(`Deleted "${name}"`);
      setSelectedIds(prev => prev.filter(item => item !== id));
      fetchData();
    } catch (err: any) {
      alert('Failed to delete reminder: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected reminders?`)) return;
    try {
      await Promise.all(selectedIds.map(id => axios.delete(`/api/reminders/${id}`)));
      showToast(`Deleted ${selectedIds.length} reminders.`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error('Error bulk deleting:', err);
    }
  };

  const handleSaveModal = async (remData: Partial<Reminder>) => {
    try {
      await axios.post('/api/reminders', remData);
      setShowModal(false);
      showToast('Reminder saved successfully!');
      fetchData();
    } catch (err: any) {
      alert('Error saving reminder: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredReminders.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSort = (field: keyof Reminder) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter & Search Logic
  const filteredReminders = useMemo(() => {
    return reminders.filter(rem => {
      // Search
      const matchesSearch = 
        !searchQuery || 
        rem.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rem.Notes && rem.Notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rem.HolidayType && rem.HolidayType.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Category filter
      if (filterCategory !== 'All' && rem.Category !== filterCategory) return false;

      // Recurrence filter
      if (filterRecurrence !== 'All' && rem.Repeat !== filterRecurrence) return false;

      // Status filter
      if (filterStatus === 'Active' && rem.Active !== 'Yes') return false;
      if (filterStatus === 'Inactive' && rem.Active !== 'No') return false;
      if (filterStatus === 'Overdue') {
        if (rem.Active !== 'Yes' || !rem['Next Payment']) return false;
        const dueDate = parseISO(rem['Next Payment']);
        if (dueDate >= today) return false;
      }

      return true;
    }).sort((a, b) => {
      let aVal = a[sortBy] ?? '';
      let bVal = b[sortBy] ?? '';

      if (sortBy === 'Next Payment') {
        const aDate = a['Next Payment'] ? new Date(a['Next Payment']).getTime() : 0;
        const bDate = b['Next Payment'] ? new Date(b['Next Payment']).getTime() : 0;
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [reminders, searchQuery, filterCategory, filterRecurrence, filterStatus, sortBy, sortOrder]);

  return (
    <Container fluid="xl" className="py-4 px-3 px-sm-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm border-0 d-flex align-items-center justify-content-between mb-4" role="alert">
          <div className="d-flex align-items-center gap-2">
            <CheckCircle size={18} className="text-success" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMessage(null)} aria-label="Close"></button>
        </div>
      )}

      {/* Header & New Reminder Action */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1 tracking-tight">All Reminders</h2>
          <p className="text-muted mb-0 small">
            Manage your schedule, filter by categories, duplicate items, or trigger automatic updates.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* View mode toggle */}
          <div className="btn-group border rounded-pill p-1 bg-body-tertiary">
            <button 
              type="button" 
              className={`btn btn-sm rounded-pill px-2.5 py-1 ${viewMode === 'table' ? 'btn-primary text-white shadow-sm' : 'btn-link text-body'}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button 
              type="button" 
              className={`btn btn-sm rounded-pill px-2.5 py-1 ${viewMode === 'grid' ? 'btn-primary text-white shadow-sm' : 'btn-link text-body'}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <Button
            variant="primary"
            className="rounded-pill d-flex align-items-center gap-2 px-3 py-2 fw-medium shadow-sm hover-lift"
            onClick={handleAddNew}
          >
            <Plus size={18} />
            <span>Add Reminder</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-3 mb-4">
        <Row className="g-3 align-items-center">
          {/* Search Input */}
          <Col lg={4} md={6}>
            <InputGroup>
              <InputGroup.Text className="bg-body border-end-0 text-muted">
                <Search size={16} />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search by name, notes, or holiday..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-start-0 ps-0"
              />
            </InputGroup>
          </Col>

          {/* Category Filter */}
          <Col lg={3} sm={6}>
            <Form.Select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="form-select"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Form.Select>
          </Col>

          {/* Recurrence Filter */}
          <Col lg={3} sm={6}>
            <Form.Select 
              value={filterRecurrence} 
              onChange={(e) => setFilterRecurrence(e.target.value)}
              className="form-select"
            >
              <option value="All">All Recurrences</option>
              <option value="One-Time">One-Time</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </Form.Select>
          </Col>

          {/* Status Filter */}
          <Col lg={2} sm={6}>
            <Form.Select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="form-select"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Overdue">Overdue</option>
              <option value="Inactive">Inactive</option>
            </Form.Select>
          </Col>
        </Row>

        {/* Bulk Action Bar when items selected */}
        {selectedIds.length > 0 && (
          <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between">
            <span className="small fw-semibold text-primary">
              {selectedIds.length} reminder{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <Button 
              variant="outline-danger" 
              size="sm" 
              className="rounded-pill d-flex align-items-center gap-1.5 px-3"
              onClick={handleBulkDelete}
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main Content: Table or Grid */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading reminders...</p>
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="glass-panel p-5 text-center text-muted">
          <AlertCircle size={40} className="text-muted opacity-50 mb-3" />
          <h5>No Reminders Found</h5>
          <p className="small mb-3">Try adjusting your search criteria or create a new reminder.</p>
          <Button variant="outline-primary" size="sm" onClick={handleAddNew}>
            Create Reminder
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* Modern Table View */
        <div className="glass-panel p-0 overflow-hidden">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0 modern-table">
              <thead>
                <tr className="border-bottom">
                  <th style={{ width: '40px' }} className="ps-3">
                    <Form.Check 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={selectedIds.length > 0 && selectedIds.length === filteredReminders.length}
                    />
                  </th>
                  <th 
                    className="cursor-pointer user-select-none" 
                    onClick={() => handleSort('Name')}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <span>Reminder Subject</span>
                      {sortBy === 'Name' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer user-select-none" 
                    onClick={() => handleSort('Next Payment')}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <span>Due Date & Time</span>
                      {sortBy === 'Next Payment' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                    </div>
                  </th>
                  <th>Category</th>
                  <th>Recurrence</th>
                  <th>Source</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReminders.map(rem => {
                  const daysLeft = rem['Next Payment'] 
                    ? differenceInDays(parseISO(rem['Next Payment']), today) 
                    : null;
                  const isOverdue = daysLeft !== null && daysLeft < 0;
                  const isToday = daysLeft === 0;

                  return (
                    <tr 
                      key={rem.id}
                      className={highlightedId === rem.id ? 'table-warning' : ''}
                      ref={highlightedId === rem.id ? highlightedRef : null}
                    >
                      <td className="ps-3">
                        <Form.Check 
                          type="checkbox"
                          checked={selectedIds.includes(rem.id)}
                          onChange={() => handleToggleSelect(rem.id)}
                        />
                      </td>

                      <td>
                        <div className="d-flex flex-column">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-semibold text-body">{rem.Name}</span>
                            {rem.HolidayType && (
                              <Badge bg="warning" text="dark" className="rounded-pill" style={{ fontSize: '0.65rem' }}>
                                🪔 {rem.HolidayType}
                              </Badge>
                            )}
                          </div>
                          {rem.Notes && (
                            <span className="text-muted small text-truncate" style={{ maxWidth: '320px', fontSize: '0.78rem' }}>
                              {rem.Notes}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="d-flex flex-column">
                          <span className="small fw-medium">
                            {rem['Next Payment'] ? format(parseISO(rem['Next Payment']), 'MMM dd, yyyy') : 'No Date'}
                            {rem.Time && ` at ${rem.Time}`}
                          </span>
                          {daysLeft !== null && (
                            <span style={{ fontSize: '0.75rem' }} className={isOverdue ? 'text-danger fw-semibold' : isToday ? 'text-warning fw-semibold' : 'text-muted'}>
                              {isOverdue ? `Overdue by ${Math.abs(daysLeft)}d` : isToday ? 'Due Today' : `In ${daysLeft} days`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <Badge bg="secondary" className="rounded-pill fw-normal" style={{ fontSize: '0.72rem' }}>
                          {rem.Category || 'General'}
                        </Badge>
                      </td>

                      <td>
                        <span className="small text-body d-flex align-items-center gap-1">
                          <RepeatIcon size={12} className="text-muted" />
                          <span>{rem.Repeat || 'One-Time'}</span>
                        </span>
                      </td>

                      <td>
                        <Badge 
                          bg={rem.Source === 'AI' ? 'primary' : rem.Source === 'API' ? 'info' : 'light'} 
                          text={rem.Source === 'Manual' ? 'dark' : undefined}
                          className="rounded-pill fw-normal" 
                          style={{ fontSize: '0.68rem' }}
                        >
                          {rem.Source || 'Manual'}
                        </Badge>
                      </td>

                      <td className="text-end pe-3">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          <OverlayTrigger overlay={<Tooltip>Mark as Done</Tooltip>}>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 28, height: 28 }}
                              onClick={() => handleDelete(rem.id, rem.Name)}
                            >
                              <CheckCircle size={14} />
                            </Button>
                          </OverlayTrigger>

                          <OverlayTrigger overlay={<Tooltip>Clone</Tooltip>}>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 28, height: 28 }}
                              onClick={() => handleClone(rem)}
                            >
                              <Copy size={13} />
                            </Button>
                          </OverlayTrigger>

                          <OverlayTrigger overlay={<Tooltip>Edit</Tooltip>}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 28, height: 28 }}
                              onClick={() => handleEdit(rem)}
                            >
                              <Edit2 size={13} />
                            </Button>
                          </OverlayTrigger>

                          <OverlayTrigger overlay={<Tooltip>Delete</Tooltip>}>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: 28, height: 28 }}
                              onClick={() => handleDelete(rem.id, rem.Name)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>
      ) : (
        /* Modern Card Grid View */
        <Row className="g-3">
          {filteredReminders.map(rem => {
            const daysLeft = rem['Next Payment'] 
              ? differenceInDays(parseISO(rem['Next Payment']), today) 
              : null;
            const isOverdue = daysLeft !== null && daysLeft < 0;
            const isToday = daysLeft === 0;

            return (
              <Col key={rem.id} xs={12} md={6} lg={4}>
                <div className="glass-panel p-3.5 h-100 d-flex flex-column justify-content-between hover-lift">
                  <div>
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div className="d-flex flex-wrap gap-1">
                        <Badge bg="secondary" className="rounded-pill" style={{ fontSize: '0.68rem' }}>
                          {rem.Category || 'General'}
                        </Badge>
                        {rem.HolidayType && (
                          <Badge bg="warning" text="dark" className="rounded-pill" style={{ fontSize: '0.68rem' }}>
                            🪔 {rem.HolidayType}
                          </Badge>
                        )}
                      </div>

                      <Badge 
                        bg={isOverdue ? 'danger' : isToday ? 'warning' : 'primary'}
                        className="rounded-pill"
                        style={{ fontSize: '0.7rem' }}
                      >
                        {isOverdue ? `Overdue ${Math.abs(daysLeft!)}d` : isToday ? 'Today' : `In ${daysLeft}d`}
                      </Badge>
                    </div>

                    <h6 className="fw-bold mb-1 text-truncate">{rem.Name}</h6>
                    
                    <div className="text-muted small mb-2 d-flex align-items-center gap-2">
                      <Clock size={13} />
                      <span>{rem['Next Payment'] ? format(parseISO(rem['Next Payment']), 'MMM dd, yyyy') : 'No Date'}</span>
                      {rem.Time && <span>• {rem.Time}</span>}
                    </div>

                    {rem.Notes && (
                      <p className="text-muted small mb-3 text-truncate-2" style={{ fontSize: '0.8rem' }}>
                        {rem.Notes}
                      </p>
                    )}
                  </div>

                  <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                    <span className="small text-muted d-flex align-items-center gap-1">
                      <RepeatIcon size={12} /> {rem.Repeat || 'One-Time'}
                    </span>

                    <div className="d-flex align-items-center gap-1">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 28, height: 28 }}
                        onClick={() => handleClone(rem)}
                        title="Clone"
                      >
                        <Copy size={13} />
                      </Button>

                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 28, height: 28 }}
                        onClick={() => handleEdit(rem)}
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </Button>

                      <Button
                        variant="outline-success"
                        size="sm"
                        className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 28, height: 28 }}
                        onClick={() => handleDelete(rem.id, rem.Name)}
                        title="Mark Done"
                      >
                        <CheckCircle size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Reminder Create/Edit Modal */}
      <ReminderModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onSave={handleSaveModal}
        reminder={selectedReminder}
      />
    </Container>
  );
}
