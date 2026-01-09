"use client"

import { useEffect, useMemo, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"

import { UserRole } from "@/lib/auth-types"
import { useAuth } from "@/components/auth-context"

type AdminUser = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  teamName?: string | null
}

export function AdminView() {
  const { refresh } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>(UserRole.Consultor)
  const [createTeamName, setCreateTeamName] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState<UserRole>(UserRole.Consultor)
  const [editTeamName, setEditTeamName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setError(data?.message || "Falha ao carregar usuários.")
          return
        }
        const data = (await res.json().catch(() => null)) as { items?: AdminUser[] } | null
        if (cancelled) return
        setUsers(Array.isArray(data?.items) ? data!.items! : [])
      } catch {
        if (!cancelled) setError("Falha ao carregar usuários.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [users])

  const supervisorTeams = useMemo(
    () => {
      const byTeam = new Map<string, AdminUser>()
      for (const u of sortedUsers) {
        if (u.role !== UserRole.Supervisor) continue
        if (!u.teamName) continue
        if (!byTeam.has(u.teamName)) byTeam.set(u.teamName, u)
      }
      return Array.from(byTeam.entries()).map(([teamName, supervisor]) => ({ teamName, supervisor }))
    },
    [sortedUsers],
  )

  const deleteTarget = useMemo(() => {
    if (!deleteUserId) return null
    return users.find((u) => u.id === deleteUserId) ?? null
  }, [deleteUserId, users])

  const editTarget = useMemo(() => {
    if (!editUserId) return null
    return users.find((u) => u.id === editUserId) ?? null
  }, [editUserId, users])

  const handleCreate = async () => {
    setError(null)
    setSuccess(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName) {
      setError("Informe o nome.")
      return
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Informe um e-mail válido.")
      return
    }

    if (!password || password.length < 4) {
      setError("A senha deve ter pelo menos 4 caracteres.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          role,
          // apenas consultor pode ser vinculado a equipe na criação
          teamName: role === UserRole.Consultor ? createTeamName : null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message || "Falha ao cadastrar usuário.")
        return
      }

      setName("")
      setEmail("")
      setPassword("")
      setRole(UserRole.Consultor)
      setCreateTeamName(null)

      if (data?.user) {
        setUsers((prev) => [
          {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            createdAt: data.user.createdAt,
            teamName: data.user.teamName ?? null,
          },
          ...prev,
        ])
      }

      setSuccess("Usuário cadastrado com sucesso.")
    } catch {
      setError("Falha ao cadastrar usuário.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeam = async (teamName: string) => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const members = users.filter((u) => u.teamName === teamName)

      for (const member of members) {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            teamName: null,
          }),
        })

        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(data?.message || "Falha ao excluir equipe.")
          return
        }
      }

      setUsers((prev) => prev.map((u) => (u.teamName === teamName ? { ...u, teamName: null } : u)))
      setSuccess("Equipe excluída e consultores desvinculados.")
    } catch {
      setError("Falha ao excluir equipe.")
    } finally {
      setLoading(false)
    }
  }

  const handleAssignTeam = async (user: AdminUser, teamName: string | null) => {
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamName,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message || "Falha ao atualizar equipe do usuário.")
        return
      }

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, teamName } : u)))
      setSuccess(
        teamName
          ? `Usuário atribuído à equipe ${teamName}.`
          : "Usuário removido de qualquer equipe.",
      )
    } catch {
      setError("Falha ao atualizar equipe do usuário.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message || "Falha ao excluir usuário.")
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== id))
      setSuccess("Usuário excluído.")
    } catch {
      setError("Falha ao excluir usuário.")
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (id: string) => {
    setError(null)
    setSuccess(null)
    const target = users.find((u) => u.id === id)
    if (!target) return
    setEditUserId(id)
    setEditName(target.name)
    setEditEmail(target.email)
    setEditPassword("")
    setEditRole(target.role)
    setEditTeamName(target.teamName ?? null)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return

    setError(null)
    setSuccess(null)

    const nextName = editName.trim()
    const nextEmail = editEmail.trim().toLowerCase()

    if (!nextName) {
      setError("Informe o nome.")
      return
    }

    if (!nextEmail || !nextEmail.includes("@")) {
      setError("Informe um e-mail válido.")
      return
    }

    const emailTaken = users.some((u) => u.id !== editTarget.id && u.email.toLowerCase() === nextEmail)
    if (emailTaken) {
      setError("Já existe um usuário com este e-mail.")
      return
    }

    const nextTeamName = editRole === UserRole.Consultor ? editTeamName : null

    setLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          name: nextName,
          email: nextEmail,
          role: editRole,
          password: editPassword ? editPassword : undefined,
          teamName: nextTeamName,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message || "Falha ao atualizar usuário.")
        return
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id !== editTarget.id
            ? u
            : { ...u, name: nextName, email: nextEmail, role: editRole, teamName: nextTeamName },
        ),
      )
      setEditUserId(null)
      setSuccess("Usuário atualizado com sucesso.")
    } catch {
      setError("Falha ao atualizar usuário.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white/90 p-6 shadow-sm">
        <div className="text-lg font-semibold text-slate-900">Administração</div>
        <div className="mt-1 text-sm text-slate-600">Cadastro de usuários</div>

        {(error || success) && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || success}
          </div>
        )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="Nome do usuário"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="email@dominio.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="••••••"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Cargo</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value={UserRole.Consultor}>Consultor</option>
              <option value={UserRole.Supervisor}>Supervisor</option>
              <option value={UserRole.Gerente}>Gerente</option>
              <option value={UserRole.Admin}>Admin</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Adicionar a uma equipe</label>
            <select
              value={createTeamName ?? ""}
              onChange={(e) => setCreateTeamName(e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Nenhuma equipe</option>
              {supervisorTeams.map(({ teamName, supervisor }) => (
                <option key={teamName} value={teamName}>
                  {teamName} ({supervisor.name || supervisor.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Este campo só será aplicado se o cargo for Consultor.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cadastrar usuário
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white/90 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">Usuários cadastrados</div>
          <div className="text-xs text-slate-500">{sortedUsers.length} no total</div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
            Carregando...
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
            Nenhum usuário cadastrado ainda.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <div className="col-span-3">Nome</div>
              <div className="col-span-3">E-mail</div>
              <div className="col-span-2">Cargo</div>
              <div className="col-span-2">Equipe</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>
            {sortedUsers.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-12 items-center border-t border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <div className="col-span-3 truncate font-medium text-slate-900">{u.name}</div>
                <div className="col-span-3 truncate text-slate-600">{u.email}</div>
                <div className="col-span-2 truncate text-slate-600">{u.role}</div>
                <div className="col-span-2 truncate text-slate-600">
                  {u.teamName ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {u.teamName}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Sem equipe</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(u.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDeleteUserId(u.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setDeleteUserId(u.id)
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      aria-label={`Excluir usuário ${u.name}`}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {supervisorTeams.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {supervisorTeams.map(({ teamName, supervisor }) => {
            const teamConsultants = sortedUsers.filter(
              (u) => u.teamName === teamName && u.role === UserRole.Consultor,
            )

            return (
              <div key={teamName} className="rounded-xl bg-white/90 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {teamName.replace(/^Equipe do\s+/i, "Equipe ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Supervisor: <span className="font-medium">{supervisor.name || supervisor.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500">{teamConsultants.length} consultores</div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(teamName)}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
                    >
                      Excluir equipe
                    </button>
                  </div>
                </div>

                {teamConsultants.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    Nenhum consultor atribuído a esta equipe ainda.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {teamConsultants.map((u: AdminUser) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="truncate font-medium text-slate-900">{u.name || u.email}</span>
                        <button
                          type="button"
                          onClick={() => handleAssignTeam(u, null)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700"
                        >
                          Remover da equipe
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setDeleteUserId(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-slate-900">Excluir usuário</div>
            <div className="mt-2 text-sm text-slate-600">
              Você tem certeza que deseja excluir <span className="font-semibold text-slate-900">{deleteTarget.name}</span>?
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteUserId(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemove(deleteTarget.id)
                  setDeleteUserId(null)
                  setSuccess("Usuário excluído.")
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setEditUserId(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">Editar usuário</div>
                <div className="mt-1 text-xs text-slate-500">Atualize os dados e clique em salvar.</div>
              </div>
              <button
                type="button"
                onClick={() => setEditUserId(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">E-mail</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Cargo</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value={UserRole.Consultor}>Consultor</option>
                  <option value={UserRole.Supervisor}>Supervisor</option>
                  <option value={UserRole.Gerente}>Gerente</option>
                  <option value={UserRole.Admin}>Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Nova senha (opcional)</label>
                <input
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  placeholder="Deixe em branco para manter"
                />
              </div>

              {editRole === UserRole.Consultor && (
                <div>
                  <label className="text-xs font-medium text-slate-600">Adicionar a uma equipe</label>
                  <select
                    value={editTeamName ?? ""}
                    onChange={(e) => setEditTeamName(e.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Nenhuma equipe</option>
                    {supervisorTeams.map(({ teamName, supervisor }) => (
                      <option key={teamName} value={teamName}>
                        {teamName} ({supervisor.name || supervisor.email})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Este campo só será aplicado se o cargo for Consultor.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditUserId(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
