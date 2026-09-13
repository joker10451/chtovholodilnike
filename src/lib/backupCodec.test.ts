import { describe, expect, it } from 'vitest';
import { BackupCodeError, openBackup, sealBackup } from './backupCodec';

describe('облачная копия', () => {
  const json = JSON.stringify({ app: 'holodilnik', records: Array.from({ length: 200 }, (_, i) => ({ id: `item-${i}`, name: 'Кефир 3,2%' })) });

  it('расшифровывается тем же кодом, даже кириллическим', async () => {
    const sealed = await sealBackup(json, 'Борщ2026');
    expect(await openBackup(sealed, ' Борщ2026 ')).toBe(json);
  });

  it('сжата и не содержит открытого текста', async () => {
    const sealed = await sealBackup(json, 'код');
    expect(sealed.length).toBeLessThan(json.length / 2);
    expect(atob(sealed)).not.toContain('holodilnik');
  });

  it('с другим кодом — понятная ошибка', async () => {
    const sealed = await sealBackup(json, 'первый');
    await expect(openBackup(sealed, 'второй')).rejects.toBeInstanceOf(BackupCodeError);
  });
});
