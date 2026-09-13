import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconMicrophone } from '../components/icons';
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
      <div className="voice-hero">
        <button
          type="button"
          className={`voice-mic${listening ? ' on' : ''}`}
          onClick={toggleListen}
          disabled={!supported}
          aria-label={listening ? 'Остановить запись' : 'Начать запись голоса'}
        >
          <IconMicrophone />
        </button>
        <div className="stack" style={{ gap: 4 }}>
          <b>{!supported ? 'Диктуйте с клавиатуры' : listening ? 'Слушаю — называйте продукты' : 'Нажмите и надиктуйте продукты'}</b>
          <span className="small muted">
            {!supported
              ? 'Коснитесь поля ниже и нажмите микрофон на клавиатуре iPhone'
              : '«Молоко, две пачки творога, килограмм яблок и сыр»'}
          </span>
        </div>
      </div>

      <div className="stack">
        <textarea
          className="textarea"
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Молоко, 10 яиц, полкило фарша…"
        />
        <div className="row-gap">
          {transcript && (
            <button type="button" className="btn quiet small" onClick={() => { setTranscript(''); setItems(null); setNote(null); }}>
              Очистить
            </button>
          )}
          <button type="button" className="btn grow" disabled={busy || !transcript.trim()} onClick={() => handleParse(transcript)}>
            {busy ? <><Spinner /> Разбираю…</> : 'Разобрать список'}
          </button>
        </div>
      </div>

      {note && <div className="notice">{note}</div>}

      {items && items.length > 0 && (
        <section className="stack">
          <div className="section-label">Выбрано {items.filter((i) => i.include).length} из {items.length}</div>
          <div className="list">
            {items.map((it, idx) => (
              <div key={idx} className={`voice-row${it.include ? '' : ' off'}`}>
                <button
                  type="button"
                  className={`round-check${it.include ? ' on' : ''}`}
                  aria-pressed={it.include}
                  aria-label={it.include ? `Не добавлять ${it.name}` : `Добавить ${it.name}`}
                  onClick={() => setItems(items.map((x, i) => (i === idx ? { ...x, include: !x.include } : x)))}
                >
                  {it.include && <IconCheck />}
                </button>
                <span className="nm">
                  <b>{it.name}</b>
                  <small>{LOCATION_LABELS[it.location]}</small>
                </span>
                <div className="voice-qty">
                  <Stepper
                    label={`Количество: ${it.name}`}
                    value={it.qty}
                    step={it.unit === 'g' || it.unit === 'ml' ? 50 : 1}
                    onChange={(val) => setItems(items.map((x, i) => (i === idx ? { ...x, qty: val } : x)))}
                  />
                  <small>{formatQty(it.qty, it.unit).replace(/^[\d.,½\s]+/, '')}</small>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn block" disabled={items.filter((i) => i.include).length === 0} onClick={handleSave}>
            Добавить в холодильник: {items.filter((i) => i.include).length}
          </button>
        </section>
      )}

      {items && items.length === 0 && !busy && (
        <Empty title="Продукты не распознались">Скажите иначе или перечислите названия через запятую.</Empty>
      )}
    </div>
  );
}
