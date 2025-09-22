export interface PermissionsResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface UserPermissions {
  codUsu: number;
  sistemas: Sistema[];
}

export interface Sistema {
  codSis: string;
  descrSis: string;
  descrMenu: string;
  telas?: Tela[];
}

export interface Tela {
  codTela: string;
  descrTela: string;
  descrMenu: string;
  linhaChamada: string;
}

export interface GrupoUsuario {
  codGrupoUsu: string;
  descrGrupoUsu: string;
}
