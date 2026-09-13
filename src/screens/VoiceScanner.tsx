import { useEffect, useRef, useState } from 'react';
import { IconMicrophone } from '../components/icons';
import { Empty, Spinner, Stepper, toast, useOnline } from '../components/ui';
import { saveItems } from '../data/repo';
import type { InventoryItem } from '../data/types';
import { AiRequestError, OfflineError, recognize } from '../lib/ai';
import { makeItem, toReviewDraft } from '../lib/convert';
import { parseProductsText } from '../lib/parseText';
import { createSpeechRecognizer, isSpeechSupported, type SpeechController } from '../lib/speech';
import { todayISO } from '../shared/dates';
import { getProduct, LOCATION_LABELS, type Location } from '../shared/products';
import { formatQty, type BaseUnit } from '../shared/units';

interface ParsedVoiceItem {
  name: string;
  productKey: string | null;
  qty: number;
  unit: BaseUnit;
  location: Location;
  include: boolean;
}

export function VoiceScanner() {
  const online = useOnline();
  const [supported] = useState(() => isSpeechSupported());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [items, setItems] = useState<ParsedVoiceItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechController | null>(null);

  useEffect(() => {
    recognizerRef.current = createSpeechRecognizer({
      onStart: () => setListening(true),
      onResult: (text) => setTranscript(text),
      onError: (err) => {
        toast(err);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });

    return () => {
      recognizerRef.current?.abort();
    };
  }, []);

  function toggleListen() {
    if (listening) {
      recognizerRef.current?.stop();
    } else {
      setTranscript('');
      setItems(null);
      setNote(null);
      recognizerRef.current?.start();
    }
  }

  async function handleParse(textToParse: string) {
    const raw = textToParse.trim();
    if (!raw) {
      toast('Сначала надиктуйте или введите список продуктов');
      return;
    }

    // Если всё ещё слушаем — останавливаем
    if (listening) {
      recognizerRef.current?.stop();
    }

    setBusy(true);
    setNote(null);

    try {
      if (online) {
        const result = await recognize({ task: 'text', today: todayISO(), text: raw });
        const list: ParsedVoiceItem[] = result.items.map((it, i) => {
          const d = toReviewDraft(it, i);
          return {
            name: d.name,
            productKey: d.productKey,
            qty: d.qty,
            unit: d.unit as BaseUnit,
            location: d.location,
            include: true,
          };
        });
        setItems(list);
        return;
      }
      throw new OfflineError();
    } catch (e) {
      if (!(e instanceof OfflineError)) {
        setNote(e instanceof AiRequestError ? `${e.message} Разобрано без нейросети.` : 'Разобрано встроенным парсером.');
      } else {
        setNote('Офлайн-режим: продукты распознаны без интернета.');
      }
      const fallback = parseProductsText(raw).map((l) => ({
        ...l,
        location: getProduct(l.productKey)?.location ?? 'fridge',
        include: true,
      }));
      setItems(fallback);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!items) return;
    const chosen = items.filter((i) => i.include);
    if (chosen.length === 0) {
      toast('Не выбрано ни одного продукта');
      return;
    }

    const today = todayISO();
    const toSave: InventoryItem[] = chosen.map((c) =>
      makeItem({
        name: c.name,
        productKey: c.productKey,
        qty: c.qty,
        unit: c.unit,
        location: c.location,
        purchasedAt: today,
        source: 'text',
      })
    );

    await saveItems(toSave);
    toast(`Добавлено в холодильник: ${toSave.length}`);
    setItems(null);
    setTranscript('');
  }

  return (
    <div className="stack-lg">
      {/* Крупная кнопка микрофона с пульсацией */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'var(--surface)',
          borderRadius: 24,
          border: '1px solid var(--line)',
          textAlign: 'center',
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={toggleListen}
          style={{
            width: 84,
            height: 84,
            borderRadius: 999,
            border: 'none',
            background: listening ? '#E53935' : 'var(--brand)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: listening
              ? '0 0 0 10px rgba(229, 57, 53, 0.25), 0 8px 24px rgba(229, 57, 53, 0.4)'
              : '0 8px 20px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.25s ease',
            animation: listening ? 'pulse 1.5s infinite' : 'none',
          }}
          aria-label={listening ? 'Остановить запись' : 'Начать запись голоса'}
        >
          <IconMicrophone width={38} height={38} />
        </button>

        <div>
          <b style={{ fontSize: '1.1rem', display: 'block' }}>
            {listening ? 'Слушаю вас… Называйте продукты' : 'Нажмите микрофон и надиктуйте'}
          </b>
          <span className="small muted" style={{ display: 'block', marginTop: 4 }}>
            Например: «Молоко, две пачки творога, килограмм яблок и сыр»
          </span>
        </div>

        {!supported && (
          <div className="notice" style={{ maxWidth: 360, fontSize: 13 }}>
            На вашем устройстве прямой голосовой ввод браузером ограничен. Нажмите на текстовое поле ниже и воспользуйтесь значком микрофона на клавиатуре iPhone.
          </div>
        )}
      </div>

      {/* Поле живой расшифровки / ручного ввода */}
      <div className="stack" style={{ gap: 8 }}>
        <textarea
          className="textarea"
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Здесь появится надиктованный текст (можно также вставить или написать руками)..."
          style={{ fontSize: 15 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          {transcript && (
            <button
              type="button"
              className="btn quiet small"
              onClick={() => {
                setTranscript('');
                setItems(null);
              }}
            >
              Очистить
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            disabled={busy || !transcript.trim()}
            onClick={() => handleParse(transcript)}
          >
            {busy ? <><Spinner /> Распознаю…</> : 'Разобрать продукты'}
          </button>
        </div>
      </div>

      {/* Результат разбора списка */}
      {note && <div className="notice">{note}</div>}

      {items && items.length > 0 && (
        <div className="card flat stack" style={{ gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Распознано продуктов: {items.filter((i) => i.include).length} из {items.length}</b>
            <span className="small muted">Отметьте нужные</span>
          </div>

          <div className="list">
            {items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)',
                  opacity: it.include ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={it.include}
                  onChange={(e) =>
                    setItems(items.map((x, i) => (i === idx ? { ...x, include: e.target.checked } : x)))
                  }
                  style={{ width: 22, height: 22, accentColor: 'var(--brand)', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15 }}>{it.name}</b>
                  <span className="small muted">
                    {LOCATION_LABELS[it.location]} · {formatQty(it.qty, it.unit)}
                  </span>
                </div>
                <Stepper
                  value={it.qty}
                  step={it.unit === 'g' || it.unit === 'ml' ? 50 : 1}
                  onChange={(val) =>
                    setItems(items.map((x, i) => (i === idx ? { ...x, qty: val } : x)))
                  }
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn primary block"
            disabled={items.filter((i) => i.include).length === 0}
            onClick={handleSave}
            style={{ marginTop: 8 }}
          >
            Добавить в холодильник ({items.filter((i) => i.include).length})
          </button>
        </div>
      )}

      {items && items.length === 0 && !busy && (
        <Empty title="Не удалось распознать продукты">
          Попробуйте сказать иначе или введите названия через запятую.
        </Empty>
      )}
    </div>
  );
}
