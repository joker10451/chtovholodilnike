/** Ошибка с HTTP-статусом и понятным пользователю сообщением */
export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiError';
  }
}
