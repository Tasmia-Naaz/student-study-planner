import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

export default function Messages() {
  const { user } = useContext(AuthContext);
  const [contacts, setContacts] = useState([]);
  const [contactsForUser, setContactsForUser] = useState(null);
  const [contactId, setContactId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messagesForConversation, setMessagesForConversation] = useState(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messageRequestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    setContacts([]);
    setContactsForUser(null);
    setContactId('');
    setMessages([]);
    setMessagesForConversation(null);
    setLoading(true);
    const loadContacts = async () => {
      try {
        const users = user.role === 'mentor'
          ? await apiRequest('/mentor/students')
          : [(await apiRequest('/students/me/mentor')).mentor].filter(Boolean);
        if (!active) return;
        const sorted = users.map((person) => ({ id: person.id, full_name: person.full_name, student_id: person.student_id }));
        setContacts(sorted);
        setContactsForUser(user.id);
        setContactId(String(sorted[0]?.id || ''));
        setError('');
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadContacts();
    return () => { active = false; };
  }, [user.id, user.role]);

  const loadMessages = useCallback(async () => {
    const requestVersion = ++messageRequestVersion.current;
    if (!contactId) {
      setMessages([]);
      setMessagesForConversation(null);
      return;
    }
    const conversationKey = `${user.id}:${contactId}`;
    try {
      const result = await apiRequest(`/messages?with_user=${encodeURIComponent(contactId)}`);
      if (requestVersion === messageRequestVersion.current) {
        setMessages(result);
        setMessagesForConversation(conversationKey);
        setError('');
      }
    } catch (requestError) {
      if (requestVersion === messageRequestVersion.current) {
        setMessages([]);
        setMessagesForConversation(null);
        setError(requestError.message);
      }
    }
  }, [contactId, user.id]);

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  const send = async (event) => {
    event.preventDefault();
    if (!contactId || !content.trim()) return;
    setSending(true);
    setError('');
    try {
      await apiRequest('/messages', { method: 'POST', body: JSON.stringify({ receiver_id: Number(contactId), content: content.trim() }) });
      setContent('');
      await loadMessages();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  const visibleContacts = contactsForUser === user.id ? contacts : [];
  const conversationKey = `${user.id}:${contactId}`;
  const visibleMessages = messagesForConversation === conversationKey ? messages : [];
  const contact = visibleContacts.find((person) => String(person.id) === contactId);
  return (
    <>
      <header className="page-header mb-4"><div><h1 className="page-title">Messages</h1><p className="text-secondary mb-0">Private conversations with your currently assigned {user.role === 'mentor' ? 'mentees' : 'mentor'}.</p></div></header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <section className="card message-panel">
        <div className="card-header bg-transparent d-flex align-items-center gap-3 flex-wrap">
          <label className="small fw-semibold" htmlFor="message-contact">Conversation</label>
          <select id="message-contact" className="form-select form-select-sm message-contact" value={contact ? contactId : ''} onChange={(event) => setContactId(event.target.value)} disabled={visibleContacts.length === 0}>
            {visibleContacts.length === 0 && <option value="">No current {user.role === 'mentor' ? 'mentees' : 'mentor'}</option>}
            {visibleContacts.map((person) => <option value={person.id} key={person.id}>{person.full_name}{person.student_id ? ` · ${person.student_id}` : ''}</option>)}
          </select>
        </div>
        <div className="message-history" aria-live="polite">
          {loading ? <p className="text-secondary text-center m-auto">Loading conversations…</p> : !contact ? <p className="text-secondary text-center m-auto">A current mentor assignment is required to message.</p> : visibleMessages.length === 0 ? <p className="text-secondary text-center m-auto">Start a conversation with {contact.full_name}.</p> : visibleMessages.map((message) => {
            const own = message.sender_id === user.id;
            return <div key={message.id} className={`message-bubble ${own ? 'outgoing' : 'incoming'}`}><div>{message.content}</div><time className="message-time">{new Date(message.sent_at).toLocaleString()}</time></div>;
          })}
        </div>
        {contact && <form className="card-footer bg-transparent" onSubmit={send}><label className="visually-hidden" htmlFor="message-content">Write a message</label><div className="d-flex gap-2"><textarea id="message-content" className="form-control" rows="2" maxLength={4000} placeholder="Write a message…" value={content} onChange={(event) => setContent(event.target.value)} required /><button className="btn btn-primary align-self-end" type="submit" disabled={sending || !content.trim()}><i className="bi bi-send me-1" />{sending ? 'Sending…' : 'Send'}</button></div></form>}
      </section>
    </>
  );
}
