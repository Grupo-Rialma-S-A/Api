export interface Grupo {
  CodGrupoUsu: string;
  DescrGrupoUsu: string;
}

export interface ListGruposResponse {
  codUsu?: number;
  grupos: Grupo[];
}
