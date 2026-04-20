<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { ROLES, type RoleDefinition } from '~~/app/utils/role-definitions'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

interface AdminUserRow {
  id: string
  display_name: string
  email: string
  verified: boolean
  created: string
  last_login: string | null
  roles: string[]
}

interface AssignableRole {
  name: string
  description: string
  source: 'static' | 'custom'
  permissions: string[]
}

interface CustomRolesResponse {
  roles: { id: string; name: string; description: string; permissions: string[] }[]
}

const staticRoles = Object.values(ROLES) as RoleDefinition[]

const { data: customRolesData } = await useFetch<CustomRolesResponse>('/api/admin/custom-roles', {
  default: () => ({ roles: [] })
})

const availableRoles = computed<AssignableRole[]>(() => [
  ...staticRoles.map(r => ({
    name: r.name,
    description: r.description,
    source: 'static' as const,
    permissions: [...r.permissions]
  })),
  ...(customRolesData.value?.roles ?? []).map(r => ({
    name: r.name,
    description: r.description,
    source: 'custom' as const,
    permissions: [...r.permissions]
  }))
])

const { permissions: myPermissions, hasPermission } = usePermissions()

const canManageUsers = computed(() => hasPermission('users.manage'))

const canAssignRole = (role: AssignableRole) => {
  const mine = new Set(myPermissions.value)
  return role.permissions.every(p => mine.has(p))
}

const missingPermsForRole = (role: AssignableRole) => {
  const mine = new Set(myPermissions.value)
  return role.permissions.filter(p => !mine.has(p))
}

interface UsersResponse {
  rows: AdminUserRow[]
  total: number
  page: number
  pageSize: number
}

const UIcon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const toast = useToast()
const { user: currentUser } = useAuth()

const page = ref(1)
const pageSize = ref(50)
const search = ref('')
const sortField = ref<'display_name' | 'email' | 'verified' | 'created' | 'last_login'>('created')
const sortDir = ref<'asc' | 'desc'>('desc')

const searchDebounced = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchDebounced.value = val
    page.value = 1
  }, 250)
})

const queryKey = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  q: searchDebounced.value,
  sort: sortField.value,
  dir: sortDir.value
}))

const { data, pending, error } = await useFetch<UsersResponse>('/api/admin/users', {
  query: queryKey,
  watch: [queryKey],
  default: () => ({ rows: [], total: 0, page: 1, pageSize: 50 })
})

const toggleSort = (field: typeof sortField.value) => {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  page.value = 1
}

const sortIcon = (field: typeof sortField.value) => {
  if (sortField.value !== field) return 'i-lucide-chevrons-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

const formatTimestamp = (input: string | number | null | undefined) => {
  if (!input) return '—'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

const relativeTime = (input: string | number | Date | null | undefined) => {
  if (!input) return null
  const d = input instanceof Date
    ? input
    : new Date(typeof input === 'string' ? input : Number(input))
  if (Number.isNaN(d.getTime())) return null
  const diffMs = Date.now() - d.getTime()
  const abs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const sign = diffMs >= 0 ? -1 : 1
  if (abs < minute) return rtf.format(sign * Math.round(abs / 1000), 'second')
  if (abs < hour) return rtf.format(sign * Math.round(abs / minute), 'minute')
  if (abs < day) return rtf.format(sign * Math.round(abs / hour), 'hour')
  if (abs < week) return rtf.format(sign * Math.round(abs / day), 'day')
  if (abs < month) return rtf.format(sign * Math.round(abs / week), 'week')
  if (abs < year) return rtf.format(sign * Math.round(abs / month), 'month')
  return rtf.format(sign * Math.round(abs / year), 'year')
}

const initialsOf = (name: string | undefined | null, email: string | undefined | null) => {
  const source = (name || email || '').trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

const sortableHeader = (label: string, field: typeof sortField.value) => {
  return () => h(UButton, {
    variant: 'ghost',
    color: 'neutral',
    size: 'xs',
    class: '-mx-2',
    trailingIcon: sortIcon(field),
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      toggleSort(field)
    }
  }, () => label)
}

const columns: TableColumn<AdminUserRow>[] = [
  {
    accessorKey: 'display_name',
    header: sortableHeader('Name', 'display_name'),
    cell: ({ row }) => row.original.display_name || '—'
  },
  {
    accessorKey: 'email',
    header: sortableHeader('Email', 'email')
  },
  {
    accessorKey: 'verified',
    header: sortableHeader('Verified', 'verified'),
    cell: ({ row }) => row.original.verified
      ? h(UIcon, { name: 'i-lucide-check', class: 'size-5 text-(--ui-success)' })
      : h('span', { class: 'text-(--ui-text-muted)' }, '—')
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.original.roles ?? []
      if (roles.length === 0) {
        return h('span', { class: 'text-(--ui-text-muted) text-sm' }, '—')
      }
      return h('div', { class: 'flex flex-wrap gap-1' },
        roles.map(r => h(UBadge, {
          key: r,
          color: r === 'admin' ? 'warning' : 'neutral',
          variant: 'subtle',
          size: 'sm'
        }, () => r))
      )
    }
  },
  {
    accessorKey: 'created',
    header: sortableHeader('Created', 'created'),
    cell: ({ row }) => formatDate(row.original.created)
  },
  {
    accessorKey: 'last_login',
    header: sortableHeader('Last login', 'last_login'),
    cell: ({ row }) => formatTimestamp(row.original.last_login)
  }
]

const total = computed(() => data.value?.total ?? 0)
const rows = computed(() => data.value?.rows ?? [])

// Edit slideover state
const selectedUser = ref<AdminUserRow | null>(null)
const editName = ref('')
const editRoles = ref<string[]>([])
const saving = ref(false)
const savingRoles = ref(false)

const slideoverOpen = computed({
  get: () => selectedUser.value !== null,
  set: (val: boolean) => {
    if (!val) selectedUser.value = null
  }
})

const trimmedName = computed(() => editName.value.trim())
const nameValid = computed(() => trimmedName.value.length >= 2)
const nameChanged = computed(() =>
  selectedUser.value !== null && trimmedName.value !== selectedUser.value.display_name
)
const canSave = computed(() => nameValid.value && nameChanged.value && !saving.value)

const openRow = (row: AdminUserRow) => {
  selectedUser.value = row
  editName.value = row.display_name
  editRoles.value = [...(row.roles ?? [])]
}

const toggleRole = (name: string) => {
  const idx = editRoles.value.indexOf(name)
  if (idx === -1) {
    editRoles.value = [...editRoles.value, name]
  } else {
    editRoles.value = editRoles.value.filter(r => r !== name)
  }
}

const rolesChanged = computed(() => {
  if (!selectedUser.value) return false
  const a = [...(selectedUser.value.roles ?? [])].sort()
  const b = [...editRoles.value].sort()
  return a.length !== b.length || a.some((r, i) => r !== b[i])
})

const handleSaveRoles = async () => {
  if (!selectedUser.value || !rolesChanged.value) return
  savingRoles.value = true
  try {
    const response = await $fetch<{ user: { id: string; roles: string[] } }>(
      `/api/admin/users/${selectedUser.value.id}/roles`,
      { method: 'PUT', body: { roles: editRoles.value } }
    )

    const updatedRoles = response.user.roles
    if (data.value) {
      data.value = {
        ...data.value,
        rows: data.value.rows.map(r =>
          r.id === response.user.id ? { ...r, roles: updatedRoles } : r
        )
      }
    }
    if (selectedUser.value) {
      selectedUser.value = { ...selectedUser.value, roles: updatedRoles }
    }

    toast.add({ title: 'Roles updated', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Update failed',
      description: err?.data?.statusMessage || err?.message || 'Failed to update roles',
      color: 'error'
    })
  } finally {
    savingRoles.value = false
  }
}

const handleRowSelect = (_event: Event, row: { original: AdminUserRow }) => {
  if (!canManageUsers.value) return
  openRow(row.original)
}

const tableMeta = computed(() => ({
  class: {
    tr: (row: { original: AdminUserRow }) =>
      selectedUser.value?.id === row.original.id ? 'bg-(--ui-bg-accented)' : ''
  }
}))

const handleSave = async () => {
  if (!selectedUser.value || !canSave.value) return
  saving.value = true
  try {
    const response = await $fetch<{ user: AdminUserRow }>(`/api/admin/users/${selectedUser.value.id}`, {
      method: 'PATCH',
      body: { display_name: trimmedName.value }
    })

    if (data.value) {
      data.value = {
        ...data.value,
        rows: data.value.rows.map(r => r.id === response.user.id ? response.user : r)
      }
    }

    toast.add({ title: 'User updated', color: 'success' })
    selectedUser.value = null
  } catch (err: any) {
    toast.add({
      title: 'Update failed',
      description: err?.data?.statusMessage || err?.message || 'Failed to update user',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

// Delete flow
const deleteModalOpen = ref(false)
const deleting = ref(false)

const isSelf = computed(() =>
  !!(selectedUser.value && currentUser.value && selectedUser.value.id === currentUser.value.id)
)

const requestDelete = () => {
  if (!selectedUser.value || isSelf.value) return
  deleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!selectedUser.value || isSelf.value) return
  deleting.value = true
  try {
    const userId = selectedUser.value.id
    await $fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })

    if (data.value) {
      data.value = {
        ...data.value,
        rows: data.value.rows.filter(r => r.id !== userId),
        total: Math.max(0, data.value.total - 1)
      }
    }

    toast.add({ title: 'User deleted', color: 'success' })
    deleteModalOpen.value = false
    selectedUser.value = null
  } catch (err: any) {
    toast.add({
      title: 'Delete failed',
      description: err?.data?.statusMessage || err?.message || 'Failed to delete user',
      color: 'error'
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-3xl font-bold">Users</h1>
      <UInput
        v-model="search"
        placeholder="Search name or email..."
        icon="i-lucide-search"
        class="w-full sm:w-80"
      />
    </div>

    <UAlert v-if="error" color="error" :title="error.statusMessage || 'Failed to load users'" class="mb-4" />

    <div class="border border-(--ui-border) rounded-lg overflow-hidden bg-(--ui-bg-elevated)">
      <UTable
        :data="rows"
        :columns="columns"
        :loading="pending"
        :empty-state="{ icon: 'i-lucide-users', label: 'No users found' }"
        :on-select="handleRowSelect"
        :meta="tableMeta"
        :ui="{ tr: canManageUsers ? 'transition-colors cursor-pointer' : 'transition-colors' }"
      />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 mt-4">
      <p class="text-sm text-(--ui-text-muted)">
        {{ total }} {{ total === 1 ? 'user' : 'users' }}
      </p>
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
      />
    </div>

    <USlideover
      v-model:open="slideoverOpen"
      side="right"
      :title="selectedUser?.display_name || ''"
      :ui="{ content: 'w-screen max-w-full sm:max-w-none sm:w-[50vw]' }"
    >
      <template #actions>
        <UTooltip :text="isSelf ? 'Cannot delete your own account' : 'Delete user'">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            :disabled="isSelf"
            aria-label="Delete user"
            @click="requestDelete"
          />
        </UTooltip>
      </template>
      <template #body>
        <div v-if="selectedUser" class="space-y-8">
          <!-- Identity hero -->
          <section class="flex items-start gap-4">
            <div class="shrink-0 size-16 rounded-full bg-gradient-to-br from-(--ui-primary) to-(--ui-primary)/60 text-white flex items-center justify-center text-xl font-semibold ring-1 ring-(--ui-border) shadow-sm">
              {{ initialsOf(selectedUser.display_name, selectedUser.email) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-xl font-semibold truncate">{{ selectedUser.display_name }}</h2>
                <UBadge
                  v-for="role in selectedUser.roles ?? []"
                  :key="role"
                  :color="role === 'admin' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  <UIcon v-if="role === 'admin'" name="i-lucide-shield" class="size-3 mr-1" />
                  {{ role }}
                </UBadge>
              </div>
              <a
                :href="`mailto:${selectedUser.email}`"
                class="text-sm text-(--ui-text-muted) hover:text-(--ui-text) transition-colors inline-flex items-center gap-1.5 mt-0.5 truncate"
              >
                <UIcon name="i-lucide-mail" class="size-3.5 shrink-0" />
                <span class="truncate">{{ selectedUser.email }}</span>
              </a>
              <div class="mt-2.5">
                <UBadge
                  :color="selectedUser.verified ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  <UIcon
                    :name="selectedUser.verified ? 'i-lucide-badge-check' : 'i-lucide-circle-dashed'"
                    class="size-3 mr-1"
                  />
                  {{ selectedUser.verified ? 'Verified' : 'Unverified' }}
                </UBadge>
              </div>
            </div>
          </section>

          <!-- Stat cards -->
          <section class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4">
              <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-(--ui-text-muted)">
                <UIcon name="i-lucide-calendar-plus" class="size-3.5" />
                <span>Created</span>
              </div>
              <p class="mt-1.5 text-sm font-medium">{{ formatDate(selectedUser.created) }}</p>
              <p class="text-xs text-(--ui-text-muted) mt-0.5">{{ relativeTime(selectedUser.created) || '—' }}</p>
            </div>
            <div class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4">
              <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-(--ui-text-muted)">
                <UIcon name="i-lucide-log-in" class="size-3.5" />
                <span>Last login</span>
              </div>
              <p class="mt-1.5 text-sm font-medium">
                {{ selectedUser.last_login ? formatTimestamp(selectedUser.last_login) : 'Never' }}
              </p>
              <p class="text-xs text-(--ui-text-muted) mt-0.5">
                {{ selectedUser.last_login ? relativeTime(selectedUser.last_login) : '—' }}
              </p>
            </div>
          </section>

          <!-- Edit form -->
          <section>
            <div class="flex items-center gap-2 mb-4">
              <UIcon name="i-lucide-pencil" class="size-4 text-(--ui-text-muted)" />
              <h3 class="text-sm font-semibold uppercase tracking-wide text-(--ui-text-muted)">Edit details</h3>
              <div class="flex-1 h-px bg-(--ui-border)" />
            </div>

            <form class="space-y-5" @submit.prevent="handleSave">
              <UFormField
                label="Display name"
                :hint="`${trimmedName.length} / 2+ characters`"
                :error="editName && !nameValid ? 'Must be at least 2 characters' : undefined"
              >
                <UInput
                  v-model="editName"
                  size="lg"
                  icon="i-lucide-user"
                  :disabled="saving"
                  placeholder="Display name"
                  class="w-full"
                />
              </UFormField>

              <div class="flex items-center gap-3 pt-2">
                <UButton
                  type="submit"
                  size="lg"
                  icon="i-lucide-save"
                  :loading="saving"
                  :disabled="!canSave"
                >
                  Save changes
                </UButton>
                <UButton
                  type="button"
                  variant="ghost"
                  color="neutral"
                  size="lg"
                  :disabled="saving"
                  @click="slideoverOpen = false"
                >
                  Cancel
                </UButton>
              </div>
            </form>
          </section>

          <!-- Roles editor -->
          <section>
            <div class="flex items-center gap-2 mb-4">
              <UIcon name="i-lucide-shield" class="size-4 text-(--ui-text-muted)" />
              <h3 class="text-sm font-semibold uppercase tracking-wide text-(--ui-text-muted)">Roles</h3>
              <div class="flex-1 h-px bg-(--ui-border)" />
            </div>

            <div class="space-y-2">
              <label
                v-for="role in availableRoles"
                :key="role.name"
                class="flex items-start gap-3 p-3 rounded-lg border border-(--ui-border) transition-colors"
                :class="canAssignRole(role)
                  ? 'hover:bg-(--ui-bg-accented) cursor-pointer'
                  : 'opacity-60 cursor-not-allowed'"
              >
                <UTooltip
                  :text="!canAssignRole(role)
                    ? `You lack: ${missingPermsForRole(role).join(', ')}`
                    : ''"
                  :disabled="canAssignRole(role)"
                >
                  <UCheckbox
                    :model-value="editRoles.includes(role.name)"
                    :disabled="savingRoles || !canAssignRole(role)"
                    @update:model-value="toggleRole(role.name)"
                  />
                </UTooltip>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium">{{ role.name }}</span>
                    <UBadge
                      v-if="role.source === 'custom'"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    >
                      Custom
                    </UBadge>
                    <UBadge
                      v-if="!canAssignRole(role)"
                      color="warning"
                      variant="subtle"
                      size="sm"
                    >
                      Cannot assign
                    </UBadge>
                  </div>
                  <div v-if="role.description" class="text-sm text-(--ui-text-muted) mt-0.5">
                    {{ role.description }}
                  </div>
                </div>
              </label>
            </div>

            <div class="flex items-center gap-3 pt-4">
              <UButton
                size="lg"
                icon="i-lucide-save"
                :loading="savingRoles"
                :disabled="!rolesChanged || savingRoles"
                @click="handleSaveRoles"
              >
                Save roles
              </UButton>
              <p v-if="rolesChanged" class="text-sm text-(--ui-text-muted)">
                {{ editRoles.length }} {{ editRoles.length === 1 ? 'role' : 'roles' }} selected
              </p>
            </div>
          </section>
        </div>
      </template>
    </USlideover>

    <UModal v-model:open="deleteModalOpen" :dismissible="!deleting">
      <template #content>
        <div class="p-6 space-y-5">
          <div class="flex items-start gap-3">
            <div class="shrink-0 size-10 rounded-full bg-(--ui-error)/10 flex items-center justify-center">
              <UIcon name="i-lucide-triangle-alert" class="size-5 text-(--ui-error)" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold">Delete user?</h3>
              <p class="text-sm text-(--ui-text-muted) mt-1">
                This will permanently delete
                <span class="font-medium text-(--ui-text)">{{ selectedUser?.display_name }}</span>
                ({{ selectedUser?.email }}) and their password reset records. Activity history is retained. This cannot be undone.
              </p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="deleting"
              @click="deleteModalOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              :loading="deleting"
              @click="handleDelete"
            >
              Delete user
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
