import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { RoutineCheck, RoutineItem } from './types';
import './App.css';

type CheckMap = Record<string, boolean>;

type Notice = {
  type: 'success' | 'error' | 'info';
  message: string;
};

type AuthQuestionResponse = {
  ok?: boolean;
  question?: string;
  displayName?: string;
  error?: string;
};

type AuthLoginResponse = {
  ok?: boolean;
  error?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
  };
  user?: {
    id?: string;
    email?: string;
  };
  displayName?: string;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const AUTH_API_BASE_URL = (import.meta.env.VITE_AUTH_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';
const AUTH_APP_ID = (import.meta.env.VITE_AUTH_APP_ID as string | undefined)?.trim() || 'routinecheck';
const isAuthConfigured = Boolean(AUTH_API_BASE_URL);

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => new Date(year, month, index + 1));
}

function getCheckKey(itemId: string, dateKey: string) {
  return `${itemId}__${dateKey}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getDayClassName(date: Date) {
  const day = date.getDay();
  if (day === 0) return 'is-sunday';
  if (day === 6) return 'is-saturday';
  return '';
}

function makeAuthUrl(path: string) {
  const url = new URL(path, `${AUTH_API_BASE_URL}/`);
  url.searchParams.set('app', AUTH_APP_ID);
  return url.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [question, setQuestion] = useState('秘密の質問');
  const [displayName, setDisplayName] = useState('秘密の質問ログイン');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestion() {
      try {
        const response = await fetch(makeAuthUrl('/api/auth/question'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const payload = await readJson<AuthQuestionResponse>(response);
        if (cancelled) return;
        if (response.ok && payload.ok) {
          if (payload.question) setQuestion(payload.question);
          if (payload.displayName) setDisplayName(payload.displayName);
        }
      } catch {
        if (!cancelled) {
          setError('ログインAPIに接続できません。');
        }
      }
    }

    void loadQuestion();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const answer = input.trim();
    if (!answer) {
      setError('回答を入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(makeAuthUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ answer, app: AUTH_APP_ID }),
      });
      const payload = await readJson<AuthLoginResponse>(response);

      if (!response.ok || !payload.ok || !payload.session?.access_token || !payload.session.refresh_token) {
        setError(payload.error || 'ログインに失敗しました。');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (sessionError) {
        setError(`ログインセッションの保存に失敗しました: ${sessionError.message}`);
        return;
      }

      onUnlock();
    } catch {
      setError('ログインAPIに接続できません。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="auth-logo" src="/routinecheck-symbol.png" alt="RoutineCheck" />
        <h1>RoutineCheck</h1>
        <p className="login-display-name">{displayName}</p>
        <p>{question}</p>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="答えを入力"
          autoFocus
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? '確認中...' : 'ログイン'}
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const days = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const firstDayKey = toDateKey(days[0]);
  const lastDayKey = toDateKey(days[days.length - 1]);
  const todayKey = toDateKey(new Date());

  const [items, setItems] = useState<RoutineItem[]>([]);
  const [checkMap, setCheckMap] = useState<CheckMap>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const totalCells = items.length * days.length;
  const checkedCells = useMemo(() => Object.values(checkMap).filter(Boolean).length, [checkMap]);
  const monthRate = totalCells > 0 ? Math.round((checkedCells / totalCells) * 100) : 0;

  useEffect(() => {
    if (!isSupabaseConfigured || !isAuthConfigured || !supabase) {
      setAuthChecking(false);
      return;
    }

    let cancelled = false;

    async function verifySession() {
      setAuthChecking(true);
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        if (!cancelled) {
          setUnlocked(false);
          setAuthChecking(false);
        }
        return;
      }

      try {
        const response = await fetch(makeAuthUrl('/api/auth/verify'), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await readJson<{ ok?: boolean }>(response);

        if (cancelled) return;

        if (response.ok && payload.ok) {
          setUnlocked(true);
        } else {
          await supabase!.auth.signOut();
          setUnlocked(false);
        }
      } catch {
        if (!cancelled) {
          setUnlocked(false);
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setNotice(null);

    const [itemsResult, checksResult] = await Promise.all([
      supabase
        .from('routine_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('routine_checks')
        .select('id,routine_item_id,check_date,checked,checked_at')
        .gte('check_date', firstDayKey)
        .lte('check_date', lastDayKey),
    ]);

    if (itemsResult.error) {
      setNotice({ type: 'error', message: `項目取得に失敗しました: ${itemsResult.error.message}` });
      setLoading(false);
      return;
    }

    if (checksResult.error) {
      setNotice({ type: 'error', message: `チェック取得に失敗しました: ${checksResult.error.message}` });
      setLoading(false);
      return;
    }

    const nextItems = (itemsResult.data || []) as RoutineItem[];
    const nextChecks = (checksResult.data || []) as RoutineCheck[];
    const nextMap: CheckMap = {};
    nextChecks.forEach((check) => {
      nextMap[getCheckKey(check.routine_item_id, check.check_date)] = check.checked;
    });

    setItems(nextItems);
    setCheckMap(nextMap);
    setEditingValues(
      nextItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {}),
    );
    setLoading(false);
  }, [firstDayKey, lastDayKey]);

  useEffect(() => {
    if (unlocked && isSupabaseConfigured && isAuthConfigured) {
      void loadData();
    }
  }, [loadData, unlocked]);

  async function toggleCheck(itemId: string, dateKey: string) {
    if (!supabase) return;
    const key = getCheckKey(itemId, dateKey);
    const previous = Boolean(checkMap[key]);
    const next = !previous;

    setCheckMap((current) => ({ ...current, [key]: next }));
    setSavingKey(key);

    const { error } = await supabase.from('routine_checks').upsert(
      {
        routine_item_id: itemId,
        check_date: dateKey,
        checked: next,
        checked_at: next ? new Date().toISOString() : null,
      },
      { onConflict: 'routine_item_id,check_date' },
    );

    setSavingKey(null);

    if (error) {
      setCheckMap((current) => ({ ...current, [key]: previous }));
      setNotice({ type: 'error', message: `保存に失敗しました: ${error.message}` });
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = newItemName.trim();
    if (!name) return;

    const maxSort = items.reduce((max, item) => Math.max(max, item.sort_order || 0), 0);
    const { data, error } = await supabase
      .from('routine_items')
      .insert({
        name,
        category: newItemCategory.trim() || null,
        sort_order: maxSort + 10,
      })
      .select()
      .single();

    if (error) {
      setNotice({ type: 'error', message: `項目追加に失敗しました: ${error.message}` });
      return;
    }

    const addedItem = data as RoutineItem;
    setItems((current) => [...current, addedItem]);
    setEditingValues((current) => ({ ...current, [addedItem.id]: addedItem.name }));
    setNewItemName('');
    setNewItemCategory('');
    setNotice({ type: 'success', message: '項目を追加しました。' });
  }

  async function updateItemName(item: RoutineItem) {
    if (!supabase) return;
    const nextName = (editingValues[item.id] || '').trim();
    if (!nextName || nextName === item.name) return;

    const { error } = await supabase
      .from('routine_items')
      .update({ name: nextName })
      .eq('id', item.id);

    if (error) {
      setNotice({ type: 'error', message: `項目名の更新に失敗しました: ${error.message}` });
      return;
    }

    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, name: nextName } : row)));
    setNotice({ type: 'success', message: '項目名を更新しました。' });
  }

  async function archiveItem(itemId: string) {
    if (!supabase) return;
    const confirmed = window.confirm('この項目を非表示にしますか？過去のチェック履歴は残ります。');
    if (!confirmed) return;

    const { error } = await supabase.from('routine_items').update({ is_active: false }).eq('id', itemId);
    if (error) {
      setNotice({ type: 'error', message: `項目の非表示に失敗しました: ${error.message}` });
      return;
    }
    setItems((current) => current.filter((item) => item.id !== itemId));
    setNotice({ type: 'success', message: '項目を非表示にしました。' });
  }

  function moveMonth(offset: number) {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUnlocked(false);
    setItems([]);
    setCheckMap({});
  }

  if (!isSupabaseConfigured || !isAuthConfigured) {
    return (
      <main className="setup-page">
        <div className="setup-card">
          <img className="auth-logo" src="/routinecheck-symbol.png" alt="RoutineCheck" />
          <h1>RoutineCheck</h1>
          <p>環境変数が未設定です。</p>
          <pre>{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_API_BASE_URL=https://shohin-api-worker.example.workers.dev
VITE_AUTH_APP_ID=routinecheck`}</pre>
        </div>
      </main>
    );
  }

  if (authChecking) {
    return (
      <main className="setup-page">
        <div className="setup-card">
          <img className="auth-logo" src="/routinecheck-symbol.png" alt="RoutineCheck" />
          <h1>RoutineCheck</h1>
          <p>ログイン状態を確認しています...</p>
        </div>
      </main>
    );
  }

  if (!unlocked) {
    return <LoginGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div>
            <img className="brand-logo" src="/routinecheck-full.png" alt="RoutineCheck" />
            <h1 className="sr-only">RoutineCheck</h1>
            <p>日々の実施項目を、クリックだけで記録します。</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={() => setPanelOpen((value) => !value)}>
            項目管理
          </button>
          <button className="ghost-button" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div className="month-nav">
          <button onClick={() => moveMonth(-1)}>← 前月</button>
          <strong>{formatMonthLabel(currentMonth)}</strong>
          <button onClick={() => moveMonth(1)}>翌月 →</button>
          <button className="today-button" onClick={goToday}>今日</button>
        </div>
        <div className="summary-cards">
          <div className="summary-card">
            <span>項目数</span>
            <strong>{items.length}</strong>
          </div>
          <div className="summary-card">
            <span>チェック数</span>
            <strong>{checkedCells}</strong>
          </div>
          <div className="summary-card">
            <span>達成率</span>
            <strong>{monthRate}%</strong>
          </div>
        </div>
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.message}</div>}

      {panelOpen && (
        <section className="manage-panel">
          <form className="add-form" onSubmit={addItem}>
            <input
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              placeholder="新しい実施項目"
            />
            <input
              value={newItemCategory}
              onChange={(event) => setNewItemCategory(event.target.value)}
              placeholder="カテゴリ 任意"
            />
            <button type="submit">追加</button>
          </form>

          <div className="item-editor-list">
            {items.map((item) => (
              <div className="item-editor-row" key={item.id}>
                <input
                  value={editingValues[item.id] ?? item.name}
                  onChange={(event) =>
                    setEditingValues((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />
                <button onClick={() => updateItemName(item)}>保存</button>
                <button className="danger-button" onClick={() => archiveItem(item.id)}>非表示</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid-card">
        {loading ? (
          <div className="loading-state">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h2>まだ項目がありません</h2>
            <p>「項目管理」からルーティン項目を追加してください。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="routine-table">
              <thead>
                <tr>
                  <th className="sticky-item-col item-heading">実施項目</th>
                  {days.map((date) => {
                    const dateKey = toDateKey(date);
                    const dayClass = getDayClassName(date);
                    return (
                      <th
                        key={dateKey}
                        className={`${dayClass} ${dateKey === todayKey ? 'is-today' : ''}`}
                      >
                        <span className="date-number">{date.getDate()}</span>
                        <span className="weekday">{WEEKDAYS[date.getDay()]}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <th className="sticky-item-col routine-name">
                      <span>{item.name}</span>
                      {item.category && <em>{item.category}</em>}
                    </th>
                    {days.map((date) => {
                      const dateKey = toDateKey(date);
                      const key = getCheckKey(item.id, dateKey);
                      const checked = Boolean(checkMap[key]);
                      const isSaving = savingKey === key;
                      return (
                        <td
                          key={dateKey}
                          className={`${getDayClassName(date)} ${dateKey === todayKey ? 'is-today' : ''}`}
                        >
                          <button
                            className={`check-cell ${checked ? 'checked' : ''} ${isSaving ? 'saving' : ''}`}
                            onClick={() => toggleCheck(item.id, dateKey)}
                            aria-label={`${item.name} ${dateKey}`}
                          >
                            {checked ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="sticky-item-col routine-name">日別達成</th>
                  {days.map((date) => {
                    const dateKey = toDateKey(date);
                    const dayCount = items.reduce((count, item) => {
                      return count + (checkMap[getCheckKey(item.id, dateKey)] ? 1 : 0);
                    }, 0);
                    return (
                      <td key={dateKey} className={dateKey === todayKey ? 'is-today' : ''}>
                        <span className="daily-count">{dayCount}/{items.length}</span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
