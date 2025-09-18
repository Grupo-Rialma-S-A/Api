export class UserCodeGenerator {
  static async generateUniqueCodUsu(
    checkExistsFn: (code: string) => Promise<boolean>,
    getCountFn?: () => Promise<number>,
  ): Promise<number> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let codUsu = await this.generateCode(attempts, getCountFn);

      codUsu = Math.abs(codUsu);
      if (codUsu > 2147483647) {
        codUsu = codUsu % 1000000;
      }

      const exists = await checkExistsFn(codUsu.toString());
      if (!exists) {
        return codUsu;
      }
      attempts++;
    }

    throw new Error(
      'Não foi possível gerar um código único para o usuário após várias tentativas',
    );
  }

  private static async generateCode(
    attempt: number,
    getCountFn?: () => Promise<number>,
  ): Promise<number> {
    if (attempt < 3) {
      const timestamp = Date.now().toString().slice(-6);
      return parseInt(timestamp);
    } else if (attempt < 6 && getCountFn) {
      const total = await getCountFn();
      const base = total + 1000;
      const random = Math.floor(Math.random() * 1000);
      return base + random + attempt;
    } else {
      return Math.floor(Math.random() * 900000) + 100000;
    }
  }
}
