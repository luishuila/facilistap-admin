// Mismos valores y nombres que el backend (ComplaintTypeEnum / ComplaintStatusEnum, entidad Complaint).
export type ComplaintType = 'petition' | 'complaint' | 'claim' | 'suggestion' | 'report';
export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export interface ComplaintNote {
  id: number;
  note: string;
  authorName: string | null;
  authorRole: string;
  createdAt: string;
}

export interface ComplaintUser {
  id: string;
  name: string;
  lastname: string;
  username?: string;
  email?: string;
}

export interface Complaint {
  id: number;
  type: ComplaintType;
  reason: string;
  description: string;
  images: string[];
  status: ComplaintStatus;
  adminNote: string | null;
  user: ComplaintUser | null;
  /** Super administrador que tomo la PQRS (la puso En proceso). */
  assignedTo?: ComplaintUser | null;
  assignedAt?: string | null;
  notes: ComplaintNote[];
  createdAt: string;
  updatedAt: string;
  /** Derivado en el cliente para la tabla: nombre completo del usuario. */
  userName?: string;
  /** Nombre legible del motivo (maestra COMPLAINT_REASON_*); `reason` es el codigo. */
  reasonLabel?: string;
  /** Derivado: el ultimo mensaje es del usuario y la PQRS no esta resuelta. */
  awaitingReply?: 'YES' | 'NO';
}

/** GET /complaints/admins/list: posibles responsables. */
export interface ComplaintAdmin {
  id: string;
  name: string;
  email: string;
}
