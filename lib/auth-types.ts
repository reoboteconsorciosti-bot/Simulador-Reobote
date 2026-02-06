export enum UserRole {
  Consultor = "Consultor",
  Supervisor = "Supervisor",
  Gerente = "Gerente",
  Admin = "Admin",
}

export interface Profile {
  name: string
  photoUrl?: string
  role: UserRole
  teamId?: string
}

export interface User {
  uid: string
  email: string
  profile: Profile
}
