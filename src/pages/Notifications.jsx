import { useContext, useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [itemsForUser, setItemsForUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setItems([]);
    setItemsForUser(null);
    setError('');
    setLoading(Boolean(user));
    if (!user) return () => { active = false; };

    const load = async () => {
      try {
        const result = await apiRequest('/notifications');
        if (active) {
          setItems(result);
          setItemsForUser(user.id);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const markRead = async (id) => {
    if (itemsForUser !== user?.id) return;
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  const visibleItems = itemsForUser === user?.id ? items : [];
  const unread = visibleItems.filter((item) => !item.read).length;

  return (
    <>
      <header className="page-header mb-4"><div><h1 className="page-title">Notifications</h1><p className="text-secondary mb-0">{unread} unread · Recent account and academic updates</p></div></header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <section className="card">
        {loading ? <div className="card-body text-secondary">Loading notifications…</div> : visibleItems.length === 0 ? <div className="card-body text-secondary">There are no notifications yet.</div> : (
          <div className="list-group list-group-flush">
            {visibleItems.map((item) => (
              <article className={`list-group-item p-3 notification-row ${item.read ? '' : 'unread'}`} key={item.id}>
                <div className="d-flex align-items-start gap-3">
                  <span className="notification-icon"><i className={`bi bi-${item.kind === 'message' ? 'chat-dots' : item.kind === 'assignment' ? 'people' : item.kind === 'backlog' ? 'journal-x' : item.kind === 'feedback' ? 'chat-square-text' : 'bell'}`} /></span>
                  <div className="flex-grow-1"><div className="fw-semibold">{item.title}</div><div className="text-secondary">{item.body}</div><time className="small text-secondary">{new Date(item.created_at).toLocaleString()}</time></div>
                  {!item.read && <button className="btn btn-sm btn-outline-primary flex-shrink-0" type="button" onClick={() => markRead(item.id)}>Mark read</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
