import { useState, useRef, type ChangeEvent } from 'react';
import { IconCamera, IconClose, IconPlus, IconTrash } from '../components/icons';
import { Sheet, toast } from '../components/ui';
import { newId } from '../data/db';
import { saveRecipe } from '../data/repo';
import { blobToDataUrl, shrinkPhoto } from '../lib/image';
import { guessProductKey } from '../shared/products';
import type { Ingredient, Recipe, Role, Step } from '../shared/recipeTypes';
import { UNIT_LABELS, type RecipeUnit } from '../shared/units';

const TAG_OPTIONS = [
  'завтрак', 'обед', 'ужин', 'суп', 'салат', 'выпечка', 'десерт', 'напиток', 'впрок',
];

const COLOR_OPTIONS = [
  '#4A8B66', '#E05A47', '#D97736', '#3D7EAA', '#7D5BA6', '#5C6B73',
];

const UNITS: RecipeUnit[] = ['g', 'ml', 'pcs', 'tbsp', 'tsp', 'pinch'];

export function CustomRecipeSheet({
  open,
  onClose,
  initialRecipe,
}: {
  open: boolean;
  onClose: () => void;
  initialRecipe?: Recipe | null;
}) {
  const [title, setTitle] = useState(initialRecipe?.title ?? '');
  const [time, setTime] = useState(initialRecipe?.time ?? 30);
  const [servings, setServings] = useState(initialRecipe?.servings ?? 4);
  const [color, setColor] = useState(initialRecipe?.color ?? COLOR_OPTIONS[0]);
  const [image, setImage] = useState<string | undefined>(initialRecipe?.image);
  const [tags, setTags] = useState<string[]>(initialRecipe?.tags ?? ['ужин']);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialRecipe?.ingredients.length
      ? initialRecipe.ingredients
      : [{ key: null, name: '', qty: 0, unit: 'g', role: 'key' }],
  );
  const [steps, setSteps] = useState<Step[]>(
    initialRecipe?.steps.length
      ? initialRecipe.steps
      : [{ text: '', timer: undefined }],
  );
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const shrunk = await shrinkPhoto(file);
      const dataUrl = await blobToDataUrl(shrunk);
      setImage(dataUrl);
    } catch {
      toast('Не удалось загрузить фото');
    }
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { key: null, name: '', qty: 0, unit: 'g', role: 'secondary' }]);
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], ...patch };
      if ('name' in patch && patch.name !== undefined) {
        item.key = guessProductKey(patch.name);
      }
      copy[index] = item;
      return copy;
    });
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps((prev) => [...prev, { text: '', timer: undefined }]);
  }

  function updateStep(index: number, patch: Partial<Step>) {
    setSteps((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast('Введите название блюда');
      return;
    }
    const cleanIngredients = ingredients
      .filter((i) => (i.name && i.name.trim()) || i.key)
      .map((i) => ({
        key: i.key ?? guessProductKey(i.name || ''),
        name: i.name?.trim() || undefined,
        qty: Number(i.qty) || 0,
        unit: i.unit,
        role: i.role,
      }));

    if (cleanIngredients.length === 0) {
      toast('Добавьте хотя бы один ингредиент');
      return;
    }

    const cleanSteps = steps
      .filter((s) => s.text.trim())
      .map((s) => ({
        text: s.text.trim(),
        timer: s.timer && s.timer > 0 ? Math.round(s.timer) : undefined,
      }));

    if (cleanSteps.length === 0) {
      toast('Добавьте хотя бы один шаг приготовления');
      return;
    }

    setSaving(true);
    try {
      const recipe: Recipe = {
        id: initialRecipe?.id ?? newId(),
        title: trimmedTitle,
        time: Math.max(5, Math.round(time)),
        servings: Math.max(1, Math.round(servings)),
        tags: tags.length ? tags : ['ужин'],
        color,
        ingredients: cleanIngredients,
        steps: cleanSteps,
        source: 'custom',
        image,
      };

      await saveRecipe(recipe);
      toast(initialRecipe ? 'Рецепт обновлён' : 'Семейный рецепт сохранён');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initialRecipe ? 'Редактировать рецепт' : 'Новый семейный рецепт'}
      footer={
        <div className="field-row">
          <button type="button" className="btn ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn" disabled={saving || !title.trim()} onClick={handleSave}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <div className="stack-lg">
        {/* Фото и базовые поля */}
        <div className="stack">
          <label className="field-label">Название блюда</label>
          <input
            className="input"
            placeholder="Например: Бабушкин борщ или Запеканка"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Загрузка фото */}
        <div className="card flat row-gap" style={{ alignItems: 'center' }}>
          {image ? (
            <div style={{ position: 'relative', width: 68, height: 68, borderRadius: 14, overflow: 'hidden', flex: '0 0 auto' }}>
              <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                className="row-remove"
                style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', width: 24, height: 24 }}
                onClick={() => setImage(undefined)}
                aria-label="Удалить фото"
              >
                <IconClose />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 68, height: 68, borderRadius: 14, background: 'var(--surface-2)', border: '1px dashed var(--line)' }}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Добавить фото блюда"
            >
              <IconCamera width={24} height={24} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
          <div className="grow">
            <b>Фото блюда</b>
            <div className="small muted">
              {image ? 'Фото прикреплено к карточке' : 'Сфотографируйте или выберите из галереи'}
            </div>
          </div>
        </div>

        {/* Время и базовые порции */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card flat stack" style={{ gap: 4 }}>
            <label className="field-label">Время (мин)</label>
            <input
              className="input mono"
              type="number"
              min={5}
              max={360}
              value={time}
              onChange={(e) => setTime(Math.max(5, Number(e.target.value) || 30))}
            />
          </div>
          <div className="card flat stack" style={{ gap: 4 }}>
            <label className="field-label">Порций по умолч.</label>
            <input
              className="input mono"
              type="number"
              min={1}
              max={24}
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 4))}
            />
          </div>
        </div>

        {/* Теги / категории */}
        <div className="stack" style={{ gap: 6 }}>
          <label className="field-label">Категории</label>
          <div className="wrap-gap">
            {TAG_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${tags.includes(t) ? ' on' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Цвет тарелки */}
        <div className="stack" style={{ gap: 6 }}>
          <label className="field-label">Цвет карточки</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid var(--brand)' : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: color === c ? '0 0 0 2px var(--surface)' : undefined,
                  cursor: 'pointer',
                }}
                aria-label={`Выбрать цвет ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Ингредиенты */}
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-label">Ингредиенты ({ingredients.length})</div>
            <button type="button" className="btn small quiet" onClick={addIngredient}>
              <IconPlus width={16} height={16} /> Добавить
            </button>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {ingredients.map((ing, idx) => (
              <div key={idx} className="card flat stack" style={{ gap: 8, padding: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input grow"
                    placeholder="Название (например, Картофель)"
                    value={ing.name ?? ''}
                    onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => removeIngredient(idx)}
                    aria-label="Удалить ингредиент"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px', gap: 6 }}>
                  <input
                    className="input mono"
                    type="number"
                    min={0}
                    placeholder="Кол-во"
                    value={ing.qty || ''}
                    onChange={(e) => updateIngredient(idx, { qty: parseFloat(e.target.value) || 0 })}
                  />
                  <select
                    className="select"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(idx, { unit: e.target.value as RecipeUnit })}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={ing.role}
                    onChange={(e) => updateIngredient(idx, { role: e.target.value as Role })}
                  >
                    <option value="key">Главный</option>
                    <option value="secondary">Второй</option>
                    <option value="basic">Базовый</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Шаги готовки */}
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-label">Шаги приготовления ({steps.length})</div>
            <button type="button" className="btn small quiet" onClick={addStep}>
              <IconPlus width={16} height={16} /> Шаг
            </button>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {steps.map((st, idx) => (
              <div key={idx} className="card flat stack" style={{ gap: 8, padding: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span className="mono" style={{ fontWeight: 700, paddingTop: 8, color: 'var(--brand)', width: 22 }}>
                    {idx + 1}.
                  </span>
                  <textarea
                    className="textarea grow"
                    rows={2}
                    placeholder="Что делать на этом шаге..."
                    value={st.text}
                    onChange={(e) => updateStep(idx, { text: e.target.value })}
                  />
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => removeStep(idx)}
                    aria-label="Удалить шаг"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="small muted">Таймер (мин):</span>
                  <input
                    className="input mono"
                    style={{ width: 80 }}
                    type="number"
                    min={0}
                    placeholder="—"
                    value={st.timer ? Math.round(st.timer / 60) : ''}
                    onChange={(e) => {
                      const mins = parseFloat(e.target.value);
                      updateStep(idx, { timer: mins && mins > 0 ? Math.round(mins * 60) : undefined });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
