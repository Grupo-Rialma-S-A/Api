export class UserQueryBuilder {
  static buildGetAllUsersQuery(
    search?: string,
    page?: number,
    limit?: number,
  ): {
    query: string;
    params: any[];
    countQuery?: string;
    countParams?: any[];
  } {
    let query = `
      SELECT 
        CodUsu,
        NomeUsu,
        Email,
        Tel,
        Ramal,
        Cel,
        TrocarSenha,
        DataInc,
        DataAlt,
        DataBloqueado,
        Logado
      FROM Usuario
    `;

    const params: any[] = [];
    let paramIndex = 0;

    if (search?.trim()) {
      query += ` WHERE (CodUsu LIKE @${paramIndex} OR NomeUsu LIKE @${paramIndex + 1} OR Email LIKE @${paramIndex + 2})`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
      paramIndex += 3;
    }

    query += ` ORDER BY NomeUsu ASC`;

    if (page && limit) {
      const offset = (page - 1) * limit;
      query += ` OFFSET @${paramIndex} ROWS FETCH NEXT @${paramIndex + 1} ROWS ONLY`;
      params.push(offset, limit);
    }

    let countQuery: string | undefined;
    let countParams: any[] | undefined;

    if (page && limit) {
      countQuery = `SELECT COUNT(*) as Total FROM Usuario`;
      countParams = [];

      if (search?.trim()) {
        countQuery += ` WHERE (CodUsu LIKE @0 OR NomeUsu LIKE @1 OR Email LIKE @2)`;
        const searchTerm = `%${search.trim()}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }
    }

    return { query, params, countQuery, countParams };
  }

  static buildLoginQuery(email: string, senha: string): string {
    return `
      DECLARE @Result INT;
      EXEC @Result = SpLogin 
        '${email.trim().toLowerCase().replace(/'/g, "''")}',
        '${senha.replace(/'/g, "''")}';
      SELECT @Result AS LoginResult;
    `;
  }

  static buildLogoutQuery(codUsu: number): string {
    return `
      DECLARE @Result INT;
      EXEC @Result = SpLogout ${codUsu};
      SELECT @Result AS LogoutResult;
    `;
  }

  static buildCreateUserQuery(userData: any, codUsu: number): string {
    return `
      EXEC SpGrUsuario 
        ${codUsu},
        '${userData.nomeUsu.trim().replace(/'/g, "''")}',
        '${userData.email.trim().toLowerCase()}',
        ${userData.tel ? `'${userData.tel.trim()}'` : 'NULL'},
        ${userData.ramal ? `'${userData.ramal.trim()}'` : 'NULL'},
        ${userData.cel ? `'${userData.cel.trim()}'` : 'NULL'},
        '${userData.senha.replace(/'/g, "''")}',
        '${userData.trocarSenha || 'N'}'
    `;
  }

  static buildGetUserQuery(): string {
    return `
      SELECT 
        CodUsu,
        NomeUsu,
        Email,
        Tel,
        Ramal,
        Cel,
        TrocarSenha,
        DataInc,
        DataAlt,
        DataBloqueado,
        Logado
      FROM Usuario 
      WHERE CodUsu = @0
    `;
  }

  static buildCheckEmailExistsQuery(): string {
    return `
      SELECT COUNT(*) as EmailCount
      FROM Usuario 
      WHERE Email = @0
    `;
  }

  static buildCheckUserExistsQuery(): string {
    return `
      SELECT COUNT(*) as UserCount
      FROM Usuario 
      WHERE CodUsu = @0
    `;
  }

  static buildGetUserDataQuery(): string {
    return `
      SELECT 
        CodUsu,
        NomeUsu,
        Email,
        TrocarSenha
      FROM Usuario 
      WHERE CodUsu = @0
    `;
  }

  /**
   * Query para verificar se usuário existe usando SpSeUsuario
   */
  static buildCheckUserExistsForLoginQuery(): string {
    return `
      DECLARE @NomeUsu varchar(100) = '';
      EXEC SpSeUsuario @NomeUsu
    `;
  }

  /**
   * Query para verificar dados específicos do usuário usando SpSe1Usuario
   */
  static buildGetUserByIdQuery(codUsu: number): string {
    return `
      DECLARE @CodUsu int = ${codUsu};
      EXEC SpSe1Usuario @CodUsu
    `;
  }

  static buildGetUsersCountQuery(): string {
    return `SELECT COUNT(*) as Total FROM Usuario`;
  }

  static buildGetStoredProcedureParametersQuery(): string {
    return `
      SELECT 
        p.name as parameter_name,
        p.parameter_id,
        t.name as data_type,
        p.max_length,
        p.precision,
        p.scale,
        p.is_output
      FROM sys.procedures pr
      INNER JOIN sys.parameters p ON pr.object_id = p.object_id
      INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
      WHERE pr.name = @0
      ORDER BY p.parameter_id
    `;
  }
}
