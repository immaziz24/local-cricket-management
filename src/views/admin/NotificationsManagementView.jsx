import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  Bell,
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  Radio,
  CheckCircle,
  Clock
} from 'lucide-react';

export function NotificationsManagementView() {
  const [channels, setChannels] = useState({
    sms_enabled: true,
    email_enabled: true,
    push_enabled: true,
    in_app_banner: true
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Compose form state
  const [targetGroup, setTargetGroup] = useState('All Registered Captains');
  const [selectedChannel, setSelectedChannel] = useState('In-App + Email');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchNotificationSettings();
      if (data) {
        setChannels(data.channels || channels);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChannel = async (channelKey) => {
    const updated = { ...channels, [channelKey]: !channels[channelKey] };
    setChannels(updated);
    try {
      await dataService.updateNotificationChannels(updated);
      setFeedback(`Channel ${channelKey} updated.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to update channel:', err);
    }
  };

  const handleSendNotification = async (e) => {
    e?.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSending(true);
    try {
      const res = await dataService.dispatchCustomNotification({
        channel: selectedChannel,
        targetGroup,
        title: title.trim(),
        message: message.trim()
      });
      setHistory((prev) => [res, ...prev]);
      setFeedback(`Notification dispatched to ${targetGroup} via ${selectedChannel}.`);
      setTitle('');
      setMessage('');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to dispatch notification:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="primary">FEATURE #270</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Multi-Channel Broadcast Hub
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Notifications Management
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Configure SMS, Email, and Push gateways, and dispatch announcements across player groups.
          </p>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          color: '#166534',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={16} />
          {feedback}
        </div>
      )}

      {/* 2-Column: Channels + Dispatcher */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Gateway Channels Toggle */}
        <Card title="Active Delivery Channels">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { key: 'sms_enabled', label: 'SMS Notifications (Transactional)', icon: Smartphone, desc: 'Deliver instant OTP codes and late arrival alerts' },
              { key: 'email_enabled', label: 'Email Dispatch (SMTP / API)', icon: Mail, desc: 'Send tournament sanctions and official scorecard summaries' },
              { key: 'push_enabled', label: 'Mobile Push Notifications', icon: Bell, desc: 'Deliver live ball-by-ball milestones and toss notifications' },
              { key: 'in_app_banner', label: 'In-App Alert Banners', icon: Radio, desc: 'Display global system warnings across dashboard views' }
            ].map((c) => {
              const Icon = c.icon;
              const isEnabled = channels[c.key];
              return (
                <div key={c.key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Icon size={18} style={{ color: isEnabled ? '#0284c7' : '#94a3b8' }} />
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{c.label}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.desc}</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleChannel(c.key)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Dispatch Notification Form */}
        <Card title="Dispatch Group Notification">
          <form onSubmit={handleSendNotification}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Recipient Persona Group
              </label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem'
                }}
              >
                <option value="All Registered Captains">All Registered Captains</option>
                <option value="Official Scorers">Official Scorers</option>
                <option value="Certified Umpires">Certified Umpires</option>
                <option value="Tournament Organisers">Tournament Organisers</option>
                <option value="All Platform Users">All Platform Users (Broadcast)</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Delivery Gateway
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem'
                }}
              >
                <option value="In-App + Email">In-App + Email</option>
                <option value="SMS">SMS Gateway</option>
                <option value="Push Notification">Mobile Push</option>
                <option value="Multi-Channel (All)">Multi-Channel (SMS + Email + In-App)</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Announcement Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mandatory Pre-Match Captains Briefing"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Message Body
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose the full notice here..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={sending}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Send size={15} />
              {sending ? 'Dispatching...' : 'Dispatch Notification'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Dispatch History Archive */}
      <Card title={`Dispatched Notification Logs (${history.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {history.map((h) => (
            <div key={h.id} style={{
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.825rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ color: '#0f172a' }}>{h.title}</strong>
                  <Badge variant="success">{h.status}</Badge>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ({h.channel} • {h.delivery_count} Delivered)
                  </span>
                </div>
                <div style={{ fontSize: '0.775rem', color: '#475569', marginTop: '0.2rem' }}>
                  Target: <strong>{h.target}</strong> — {h.message}
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={13} />
                {new Date(h.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

