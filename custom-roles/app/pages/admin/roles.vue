<script setup lang="ts">
import { ROLES, type RoleDefinition } from '~~/app/utils/role-definitions'
import { PERMISSIONS, PERMISSION_META, type Permission } from '~~/app/utils/permissions'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

interface CustomRole {
  id: string
  name: string
  description: string
  permissions: string[]
  created: string
  updated: string
}

interface CustomRolesResponse {
  roles: CustomRole[]
}

const toast = useToast()

const staticRoles = computed<RoleDefinition[]>(() => Object.values(ROLES))

const { data: customRolesData, refresh: refreshCustomRoles, pending: customRolesPending } =
  await useFetch<CustomRolesResponse>('/api/admin/custom-roles', {
    default: () => ({ roles: [] })
  })

const customRoles = computed<CustomRole[]>(() => customRolesData.value?.roles ?? [])

const roleIcons: Record<string, string> = {
  admin: 'i-lucide-shield',
  member: 'i-lucide-user'
}

const expandedRole = ref<string | null>(null)
const toggleExpandedRole = (key: string) => {
  expandedRole.value = expandedRole.value === key ? null : key
}

interface PermissionLine {
  perm: Permission
  granted: boolean
  title: string
  description: string
}
interface PermissionGroup {
  resource: string
  permissions: PermissionLine[]
}

const groupByResource = (granted: readonly string[]): PermissionGroup[] => {
  const grantedSet = new Set(granted)
  const groups = new Map<string, PermissionLine[]>()
  for (const perm of PERMISSIONS) {
    const resource = perm.includes('.') ? perm.split('.', 1)[0]! : 'general'
    if (!groups.has(resource)) groups.set(resource, [])
    const meta = PERMISSION_META[perm]
    groups.get(resource)!.push({
      perm,
      granted: grantedSet.has(perm),
      title: meta?.title ?? perm,
      description: meta?.description ?? ''
    })
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, permissions]) => ({ resource, permissions }))
}

// Edit/create modal state
const editOpen = ref(false)
const editing = ref<CustomRole | null>(null)
const form = reactive({
  name: '',
  description: '',
  permissions: [] as string[]
})
const saving = ref(false)

const openCreate = () => {
  editing.value = null
  form.name = ''
  form.description = ''
  form.permissions = []
  editOpen.value = true
}

const openEdit = (role: CustomRole) => {
  editing.value = role
  form.name = role.name
  form.description = role.description
  form.permissions = [...role.permissions]
  editOpen.value = true
}

const togglePermission = (perm: Permission) => {
  const idx = form.permissions.indexOf(perm)
  if (idx === -1) form.permissions = [...form.permissions, perm]
  else form.permissions = form.permissions.filter(p => p !== perm)
}

const editPermissionGroups = computed(() => groupByResource(form.permissions))

const trimmedName = computed(() => form.name.trim())
const nameValid = computed(() => trimmedName.value.length >= 2)
const collidesWithStatic = computed(() =>
  nameValid.value && staticRoles.value.some(r => r.name === trimmedName.value)
)
const collisionError = computed(() =>
  collidesWithStatic.value ? `"${trimmedName.value}" is a built-in role name` : undefined
)
const canSave = computed(() => nameValid.value && !collidesWithStatic.value && !saving.value)

const handleSave = async () => {
  if (!canSave.value) return
  saving.value = true
  try {
    const body = {
      name: trimmedName.value,
      description: form.description,
      permissions: form.permissions
    }
    if (editing.value) {
      await $fetch(`/api/admin/custom-roles/${editing.value.id}`, { method: 'PUT', body })
      toast.add({ title: 'Role updated', color: 'success' })
    } else {
      await $fetch('/api/admin/custom-roles', { method: 'POST', body })
      toast.add({ title: 'Role created', color: 'success' })
    }
    editOpen.value = false
    await refreshCustomRoles()
  } catch (err: any) {
    toast.add({
      title: editing.value ? 'Update failed' : 'Create failed',
      description: err?.data?.statusMessage || err?.message,
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

// Delete confirmation state
const deleteOpen = ref(false)
const deleteTarget = ref<CustomRole | null>(null)
const deleting = ref(false)

const requestDelete = (role: CustomRole) => {
  deleteTarget.value = role
  deleteOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const response = await $fetch<{ success: boolean; users_affected: number }>(
      `/api/admin/custom-roles/${deleteTarget.value.id}`,
      { method: 'DELETE' }
    )
    toast.add({
      title: 'Role deleted',
      description: response.users_affected > 0
        ? `${response.users_affected} user(s) previously had this role — their assignments now resolve to no permissions until edited.`
        : undefined,
      color: 'success'
    })
    deleteOpen.value = false
    deleteTarget.value = null
    await refreshCustomRoles()
  } catch (err: any) {
    toast.add({
      title: 'Delete failed',
      description: err?.data?.statusMessage || err?.message,
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
      <h1 class="text-3xl font-bold">Roles</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="openCreate">
        Create role
      </UButton>
    </div>

    <!-- Built-in roles -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-(--ui-text-muted) mb-3">
        Built-in
      </h2>
      <div class="space-y-3">
        <div
          v-for="role in staticRoles"
          :key="'static-' + role.name"
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) overflow-hidden"
        >
          <button
            class="w-full flex items-center justify-between p-4 hover:bg-(--ui-bg-accented)/50 transition-colors text-left"
            :aria-expanded="expandedRole === 'static-' + role.name"
            @click="toggleExpandedRole('static-' + role.name)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UIcon
                :name="roleIcons[role.name] || 'i-lucide-user'"
                class="size-5 text-(--ui-text-muted) shrink-0"
              />
              <div class="min-w-0">
                <p class="text-sm font-medium capitalize">{{ role.name }}</p>
                <p class="text-xs text-(--ui-text-muted) truncate">{{ role.description }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <UBadge color="neutral" variant="outline" size="sm">
                {{ role.permissions.length }} / {{ PERMISSIONS.length }} permissions
              </UBadge>
              <UIcon
                :name="expandedRole === 'static-' + role.name ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4 text-(--ui-text-muted)"
              />
            </div>
          </button>

          <div
            v-if="expandedRole === 'static-' + role.name"
            class="border-t border-(--ui-border) p-4 space-y-5"
          >
            <div
              v-for="group in groupByResource(role.permissions)"
              :key="group.resource"
            >
              <p class="text-xs font-medium text-(--ui-text-muted) uppercase tracking-wider mb-2">
                {{ group.resource }}
              </p>
              <div class="space-y-1">
                <div
                  v-for="p in group.permissions"
                  :key="p.perm"
                  class="flex items-start gap-2 py-1 px-2"
                >
                  <UIcon
                    :name="p.granted ? 'i-lucide-check' : 'i-lucide-x'"
                    :class="p.granted
                      ? 'size-4 text-(--ui-success) shrink-0 mt-0.5'
                      : 'size-4 text-(--ui-text-muted)/50 shrink-0 mt-0.5'"
                  />
                  <div class="min-w-0 flex-1">
                    <span
                      class="text-sm"
                      :class="p.granted ? '' : 'text-(--ui-text-muted)'"
                    >
                      {{ p.title }}
                    </span>
                    <span
                      v-if="p.description"
                      class="text-xs text-(--ui-text-muted) ml-2"
                    >
                      — {{ p.description }}
                    </span>
                    <code class="ml-2 text-xs text-(--ui-text-muted)/70 font-mono">{{ p.perm }}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Custom roles -->
    <section>
      <h2 class="text-sm font-semibold uppercase tracking-wider text-(--ui-text-muted) mb-3">
        Custom
      </h2>

      <div v-if="customRolesPending && customRoles.length === 0" class="py-8 text-center text-sm text-(--ui-text-muted)">
        Loading...
      </div>

      <div
        v-else-if="customRoles.length === 0"
        class="rounded-lg border border-dashed border-(--ui-border) p-8 text-center"
      >
        <p class="text-sm text-(--ui-text-muted) mb-3">
          No custom roles yet.
        </p>
        <UButton icon="i-lucide-plus" size="sm" variant="soft" @click="openCreate">
          Create your first role
        </UButton>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="role in customRoles"
          :key="'custom-' + role.id"
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) overflow-hidden"
        >
          <div class="flex items-center justify-between p-4 gap-3">
            <button
              class="flex items-center gap-3 min-w-0 flex-1 text-left"
              :aria-expanded="expandedRole === 'custom-' + role.id"
              @click="toggleExpandedRole('custom-' + role.id)"
            >
              <UIcon name="i-lucide-sparkles" class="size-5 text-(--ui-text-muted) shrink-0" />
              <div class="min-w-0">
                <p class="text-sm font-medium">{{ role.name }}</p>
                <p v-if="role.description" class="text-xs text-(--ui-text-muted) truncate">
                  {{ role.description }}
                </p>
              </div>
            </button>
            <div class="flex items-center gap-2 shrink-0">
              <UBadge color="neutral" variant="outline" size="sm">
                {{ role.permissions.length }} / {{ PERMISSIONS.length }} permissions
              </UBadge>
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Edit role"
                @click.stop="openEdit(role)"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="sm"
                aria-label="Delete role"
                @click.stop="requestDelete(role)"
              />
              <button
                class="p-1 -m-1"
                :aria-expanded="expandedRole === 'custom-' + role.id"
                aria-label="Toggle details"
                @click="toggleExpandedRole('custom-' + role.id)"
              >
                <UIcon
                  :name="expandedRole === 'custom-' + role.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="size-4 text-(--ui-text-muted)"
                />
              </button>
            </div>
          </div>

          <div
            v-if="expandedRole === 'custom-' + role.id"
            class="border-t border-(--ui-border) p-4 space-y-5"
          >
            <div
              v-for="group in groupByResource(role.permissions)"
              :key="group.resource"
            >
              <p class="text-xs font-medium text-(--ui-text-muted) uppercase tracking-wider mb-2">
                {{ group.resource }}
              </p>
              <div class="space-y-1">
                <div
                  v-for="p in group.permissions"
                  :key="p.perm"
                  class="flex items-start gap-2 py-1 px-2"
                >
                  <UIcon
                    :name="p.granted ? 'i-lucide-check' : 'i-lucide-x'"
                    :class="p.granted
                      ? 'size-4 text-(--ui-success) shrink-0 mt-0.5'
                      : 'size-4 text-(--ui-text-muted)/50 shrink-0 mt-0.5'"
                  />
                  <div class="min-w-0 flex-1">
                    <span
                      class="text-sm"
                      :class="p.granted ? '' : 'text-(--ui-text-muted)'"
                    >
                      {{ p.title }}
                    </span>
                    <span
                      v-if="p.description"
                      class="text-xs text-(--ui-text-muted) ml-2"
                    >
                      — {{ p.description }}
                    </span>
                    <code class="ml-2 text-xs text-(--ui-text-muted)/70 font-mono">{{ p.perm }}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Edit/Create modal -->
    <UModal v-model:open="editOpen" :title="editing ? `Edit role: ${editing.name}` : 'Create role'">
      <template #body>
        <div class="space-y-5">
          <UFormField
            label="Name"
            required
            :error="collisionError"
          >
            <UInput
              v-model="form.name"
              placeholder="e.g. content_editor"
              :disabled="saving"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              :rows="2"
              placeholder="What does this role do?"
              :disabled="saving"
            />
          </UFormField>

          <div>
            <p class="text-sm font-medium mb-2">Permissions</p>
            <p class="text-xs text-(--ui-text-muted) mb-3">
              {{ form.permissions.length }} of {{ PERMISSIONS.length }} granted
            </p>
            <div class="space-y-4 max-h-96 overflow-y-auto pr-1">
              <div
                v-for="group in editPermissionGroups"
                :key="group.resource"
              >
                <p class="text-xs font-medium text-(--ui-text-muted) uppercase tracking-wider mb-1.5">
                  {{ group.resource }}
                </p>
                <div class="space-y-1">
                  <label
                    v-for="p in group.permissions"
                    :key="p.perm"
                    class="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-(--ui-bg-accented)/50 cursor-pointer"
                  >
                    <UCheckbox
                      :model-value="form.permissions.includes(p.perm)"
                      :disabled="saving"
                      @update:model-value="togglePermission(p.perm)"
                    />
                    <div class="min-w-0 flex-1">
                      <span class="text-sm">{{ p.title }}</span>
                      <span v-if="p.description" class="text-xs text-(--ui-text-muted) ml-2">
                        — {{ p.description }}
                      </span>
                      <code class="ml-2 text-xs text-(--ui-text-muted)/70 font-mono">{{ p.perm }}</code>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton variant="ghost" color="neutral" :disabled="saving" @click="editOpen = false">
            Cancel
          </UButton>
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            :disabled="!canSave"
            @click="handleSave"
          >
            {{ editing ? 'Save changes' : 'Create role' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal v-model:open="deleteOpen" :dismissible="!deleting">
      <template #content>
        <div class="p-6 space-y-5">
          <div class="flex items-start gap-3">
            <div class="shrink-0 size-10 rounded-full bg-(--ui-error)/10 flex items-center justify-center">
              <UIcon name="i-lucide-triangle-alert" class="size-5 text-(--ui-error)" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold">Delete role?</h3>
              <p class="text-sm text-(--ui-text-muted) mt-1">
                Delete
                <span class="font-medium text-(--ui-text)">{{ deleteTarget?.name }}</span>?
                Any user currently assigned this role will keep the role name in their array, but it will resolve to no permissions until you either reassign them or recreate a role with this name.
              </p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton variant="ghost" color="neutral" :disabled="deleting" @click="deleteOpen = false">
              Cancel
            </UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="handleDelete">
              Delete role
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
