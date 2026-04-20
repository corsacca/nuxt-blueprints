<script setup lang="ts">
import { ROLES, type RoleDefinition } from '~~/app/utils/role-definitions'
import { PERMISSIONS, PERMISSION_META, type Permission } from '~~/app/utils/permissions'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const roles = computed<RoleDefinition[]>(() => Object.values(ROLES))

const roleIcons: Record<string, string> = {
  admin: 'i-lucide-shield',
  member: 'i-lucide-user'
}

const expandedRole = ref<string | null>(null)
const toggleExpandedRole = (name: string) => {
  expandedRole.value = expandedRole.value === name ? null : name
}

interface PermissionGroup {
  resource: string
  permissions: { perm: Permission; granted: boolean; title: string; description: string }[]
}

const getPermissionGroups = (role: RoleDefinition): PermissionGroup[] => {
  const groups = new Map<string, PermissionGroup['permissions']>()
  for (const perm of PERMISSIONS) {
    const resource = perm.includes('.') ? perm.split('.', 1)[0]! : 'general'
    if (!groups.has(resource)) groups.set(resource, [])
    const meta = PERMISSION_META[perm]
    groups.get(resource)!.push({
      perm,
      granted: (role.permissions as readonly string[]).includes(perm),
      title: meta?.title ?? perm,
      description: meta?.description ?? ''
    })
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, permissions]) => ({ resource, permissions }))
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-3xl font-bold">Roles</h1>
    </div>

    <div class="space-y-3">
      <div
        v-for="role in roles"
        :key="role.name"
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) overflow-hidden"
      >
        <button
          class="w-full flex items-center justify-between p-4 hover:bg-(--ui-bg-accented)/50 transition-colors text-left"
          :aria-expanded="expandedRole === role.name"
          @click="toggleExpandedRole(role.name)"
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
              :name="expandedRole === role.name ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="size-4 text-(--ui-text-muted)"
            />
          </div>
        </button>

        <div
          v-if="expandedRole === role.name"
          class="border-t border-(--ui-border) p-4 space-y-5"
        >
          <div
            v-for="group in getPermissionGroups(role)"
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
  </div>
</template>
