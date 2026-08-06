export interface PqrsFile {
  id: number;
  pqrsId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
}

export interface PqrsResponse {
  id: number;
  pqrsId: number;
  response: string;
  userId: number;
  userName: string;
  createdAt: string;
}

export type PqrsType = 'QUEJA' | 'PETICION' | 'RECLAMO' | 'SUGERENCIA';
export type PqrsStatus = 'PENDIENTE' | 'EN_PROCESO' | 'RESPONDIDO' | 'CERRADO' | 'RECHAZADO';

export interface PQRS {
  id: number;
  type: PqrsType;
  subject: string;
  description: string;
  status: PqrsStatus;
  userId: number;
  userName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  responses: PqrsResponse[];
  files: PqrsFile[];
  createdAt: string;
  updatedAt: string;
}
