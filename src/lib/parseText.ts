// Разбор фразы без интернета: «молоко 1 л, 10 яиц, полкило фарша».
// С интернетом ту же фразу разбирает нейросеть — она понимает свободную речь лучше.
import { getProduct, guessProductKey } from '../shared/products';
import type { BaseUnit } from '../shared/units';

export interface ParsedLine {
  name: string;
  productKey: string | null;
  qty: number;
  unit: BaseUnit;
}

const WORD_NUMBERS: Record<string, number> = {
  один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8,
  девять: 9, десять: 10, десяток: 10, дюжина: 12, пара: 2, пару: 2, половина: 0.5, пол: 0.5,
};

const UNIT_RE = /(кг|килограмм\w*|г|гр|грамм\w*|л|литр\w*|мл|миллилитр\w*|шт|штук\w*|пачк\w*|упаковк\w*|бутылк\w*|банк\w*)\.?/;

function unitOf(token: string | undefined): { unit: BaseUnit | 'pack'; mult: number } | null {
  if (!token) return null;
  if (/^кг|^килограмм/.test(token)) return { unit: 'g', mult: 1000 };
  if (/^г$|^гр$|^грамм/.test(token)) return { unit: 'g', mult: 1 };
  if (/^л$|^литр/.test(token)) return { unit: 'ml', mult: 1000 };
  if (/^мл$|^миллилитр/.test(token)) return { unit: 'ml', mult: 1 };
  if (/^шт/.test(token)) return { unit: 'pcs', mult: 1 };
  return { unit: 'pack', mult: 1 };
}

export function parseProductsText(text: string): ParsedLine[] {
  return text
    .split(/[,;\n]|\sи\s/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => {
      let rest = part.replace(/^полкило\s+/, '500 г ').replace(/^пол-?литра\s+/, '500 мл ');
      let qty: number | null = null;
      const num = rest.match(/(\d+(?:[.,]\d+)?)/);
      if (num) {
        qty = parseFloat(num[1].replace(',', '.'));
        rest = rest.replace(num[1], ' ');
      } else {
        const word = Object.keys(WORD_NUMBERS).find((w) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(rest));
        if (word) {
          qty = WORD_NUMBERS[word];
          rest = rest.replace(new RegExp(`(^|\\s)${word}(\\s|$)`), ' ');
        }
      }
      const unitMatch = rest.match(new RegExp(`(^|\\s)${UNIT_RE.source}(\\s|$)`));
      const u = unitOf(unitMatch?.[2]);
      if (unitMatch) rest = rest.replace(unitMatch[0], ' ');
      const name = rest.replace(/\s+/g, ' ').trim();
      const productKey = guessProductKey(name);
      const product = getProduct(productKey);

      let unit: BaseUnit = product?.unit ?? 'pcs';
      let amount = qty ?? 1;
      if (u && u.unit !== 'pack') {
        unit = u.unit;
        amount = (qty ?? 1) * u.mult;
      } else if (product?.pack && (u?.unit === 'pack' || qty === null) && product.unit !== 'pcs') {
        amount = (qty ?? 1) * product.pack;
      }
      const displayName = product?.name ?? name.charAt(0).toUpperCase() + name.slice(1);
      return { name: displayName, productKey, qty: amount, unit };
    })
    .filter((l) => l.name.length > 1);
}
