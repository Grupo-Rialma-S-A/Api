export class UserDataCleaner {
  static cleanUserData(userData: any): any {
    if (!userData) return userData;

    if (Array.isArray(userData)) {
      return userData.map((user) => this.cleanUserData(user));
    }

    const cleaned = { ...userData };
    const stringFields = [
      'NomeUsu',
      'Email',
      'Tel',
      'Ramal',
      'Cel',
      'TrocarSenha',
    ];

    stringFields.forEach((field) => {
      if (cleaned[field] && typeof cleaned[field] === 'string') {
        cleaned[field] = cleaned[field].trim();
      }
    });

    return cleaned;
  }
}
