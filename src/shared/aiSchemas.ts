// Контракт между приложением и серверной функцией /api/ai.
// Одни и те же схемы задают формат ответа нейросети и проверяют его на клиенте.
import { z } from 'zod';
import { CATEGORIES, LOCATIONS, type Category, type Location } from './products.js';

const categoryEnum = z.enum(CATEGORIES as [Category, ...Category[]]);
const locationEnum = z.enum(LOCATIONS as [Location, ...Location[]]);

export const BoxSchema = z.object({
  x: z.number().describe('Левый край, доля ширины фото 0..1'),
  y: z.number().describe('Верхний край, доля высоты фото 0..1'),
  w: z.number().describe('Ширина, доля 0..1'),
  h: z.number().describe('Высота, доля 0..1'),
});

export const RecognizedItemSchema = z.object({
  name: z.string().describe('Короткое название по-русски, например «Кефир 2,5%»'),
  product_key: z.string().nullable().describe('Ключ из справочника или null'),
  category: categoryEnum,
  qty: z.number().describe('Количество в единицах unit'),
  unit: z.enum(['g', 'ml', 'pcs']),
  fill: z.number().nullable().describe('Остаток в открытой таре 0..1, иначе null'),
  location: locationEnum,
  expires_at: z.string().nullable().describe('YYYY-MM-DD, только если дата чётко видна'),
  confidence: z.number().describe('Уверенность 0..1'),
  photo_index: z.number().describe('Номер фото, начиная с 0'),
  box: BoxSchema.nullable(),
  question: z
    .object({
      text: z.string(),
      options: z.array(z.string()).describe('2–4 варианта ответа'),
    })
    .nullable()
    .describe('Вопрос пользователю, если не уверен, что это за продукт'),
});

export const RecognitionSchema = z.object({
  items: z.array(RecognizedItemSchema),
  purchase_date: z.string().nullable().describe('Дата покупки с чека YYYY-MM-DD, иначе null'),
});

export const GeneratedRecipeSchema = z.object({
  title: z.string(),
  time_min: z.number(),
  servings: z.number(),
  kcal_per_serving: z.number().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      product_key: z.string().nullable(),
      name: z.string(),
      qty: z.number().describe('0 — по вкусу'),
      unit: z.enum(['g', 'ml', 'pcs', 'tbsp', 'tsp', 'pinch']),
      role: z.enum(['key', 'secondary', 'basic']),
    }),
  ),
  steps: z.array(
    z.object({
      text: z.string(),
      timer_min: z.number().nullable(),
    }),
  ),
  note: z.string().nullable().describe('Одно предложение: какие продукты блюдо помогает доесть'),
});

/** Карточка одного товара, прочитанная с упаковки */
export const PackageSchema = z.object({
  found: z.boolean().describe('false — на фото нет упаковки продукта'),
  name: z.string().describe('Понятное название без бренда: «Молоко ультрапастеризованное 3,2%»'),
  brand: z.string().nullable(),
  product_key: z.string().nullable(),
  category: categoryEnum,
  qty: z.number().describe('Вес или объём всей упаковки в unit; для штучного — число штук'),
  unit: z.enum(['g', 'ml', 'pcs']),
  fat_percent: z.number().nullable(),
  kcal: z.number().nullable().describe('ккал на 100 г/мл'),
  proteins: z.number().nullable().describe('г на 100 г/мл'),
  fat: z.number().nullable().describe('г на 100 г/мл'),
  carbs: z.number().nullable().describe('г на 100 г/мл'),
  expires_at: z.string().nullable().describe('Дата «годен до» YYYY-MM-DD, если напечатана'),
  manufactured_at: z.string().nullable().describe('Дата изготовления YYYY-MM-DD, если напечатана'),
  shelf_life_days: z.number().nullable().describe('Срок годности в днях из текста «хранить N суток»'),
  after_opening_days: z.number().nullable().describe('Сколько дней хранится после вскрытия, если написано'),
  storage: z.string().nullable().describe('Условия хранения коротко: «при +2…+6 °C»'),
  location: locationEnum,
  barcode: z.string().nullable().describe('Цифры штрихкода, если читаются под полосками'),
  composition: z.string().nullable().describe('Состав одной короткой строкой, до 120 символов'),
  confidence: z.number(),
});
export type PackageInfo = z.infer<typeof PackageSchema>;

export type RecognizedItem = z.infer<typeof RecognizedItemSchema>;
export type Recognition = z.infer<typeof RecognitionSchema>;
export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;

export const ImagePartSchema = z.object({
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z.string().describe('base64 без префикса data:'),
});
export type ImagePart = z.infer<typeof ImagePartSchema>;

const today = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AiRequestSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('shelf'), today, images: z.array(ImagePartSchema).min(1).max(6) }),
  z.object({ task: z.literal('receipt'), today, images: z.array(ImagePartSchema).min(1).max(4) }),
  z.object({ task: z.literal('text'), today, text: z.string().min(1).max(2000) }),
  z.object({
    task: z.literal('package'),
    today,
    images: z.array(ImagePartSchema).min(1).max(3),
    barcode: z.string().max(32).nullable(),
    hint: z.string().max(200).nullable().describe('Что уже известно о товаре, например из базы штрихкодов'),
  }),
  z.object({
    task: z.literal('import'),
    today,
    text: z.string().max(30000).nullable(),
    url: z.string().url().max(2000).nullable(),
    images: z.array(ImagePartSchema).max(4),
  }),
  z.object({
    task: z.literal('recipe'),
    today,
    wish: z.string().max(500),
    servings: z.number().min(1).max(20),
    staples: z.array(z.string()).max(100),
    inventory: z
      .array(
        z.object({
          name: z.string().max(120),
          product_key: z.string().nullable(),
          qty: z.number(),
          unit: z.string().max(10),
          days_left: z.number().nullable(),
        }),
      )
      .max(300),
  }),
]);
export type AiRequest = z.infer<typeof AiRequestSchema>;
