<script setup lang="ts">
// "Connected apps" UCard. Drops into any consumer page (typically
// the user's profile). Self-contained: fetches, lists, confirms,
// revokes, refetches. Consumer integration is one tag: <OauthConnectedApps />.
//
// English-only by design — matches the consumer's existing email
// templates and profile page. Localising is a separate later pass.

import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { PERMISSION_META } from '~~/app/utils/permissions'

interface ConnectedApp {
  client_id: string
  client_name: string
  dynamic: boolean
  scope: string
  granted_at: string
  last_used_at: string | null
  has_active_tokens: boolean
}

interface ConnectedAppsResponse {
  apps: ConnectedApp[]
}

const UBadge = resolveComponent('UBadge')
const UIcon = resolveComponent('UIcon')
const UTooltip = resolveComponent('UTooltip')

function describeScope(scope: string): string {
  const meta = (PERMISSION_META as Record<string, { title: string, description: string }>)[scope]
  return meta?.title || scope
}

const toast = useToast()

const { data, pending, error, refresh } = await useFetch<ConnectedAppsResponse>(
  '/api/oauth/connected-apps',
  {
    // Re-fetch when the page is re-entered; the user expects fresh
    // data after granting/revoking elsewhere (e.g. an MCP client
    // just authorized in another tab).
    server: false,
    lazy: true,
    default: () => ({ apps: [] })
  }
)

const apps = computed<ConnectedApp[]>(() => data.value?.apps ?? [])

// ── Revoke modal state ──────────────────────────────────────────────
const revokeTarget = ref<ConnectedApp | null>(null)
const revoking = ref(false)
const revokeOpen = computed({
  get: () => revokeTarget.value !== null,
  set: (val: boolean) => {
    if (!val && !revoking.value) revokeTarget.value = null
  }
})

const requestRevoke = (app: ConnectedApp) => {
  revokeTarget.value = app
}

const handleRevoke = async () => {
  if (!revokeTarget.value) return
  revoking.value = true
  const target = revokeTarget.value
  try {
    await $fetch(`/api/oauth/connected-apps/${encodeURIComponent(target.client_id)}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Access revoked',
      description: `${target.client_name} can no longer access your account.`,
      color: 'success'
    })
    await refresh()
    revokeTarget.value = null
  } catch (err: unknown) {
    const message = (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage
      || (err as { statusMessage?: string })?.statusMessage
      || 'Failed to revoke access'
    toast.add({ title: 'Error', description: message, color: 'error' })
  } finally {
    revoking.value = false
  }
}

// ── Formatting helpers ──────────────────────────────────────────────
const formatRelative = (iso: string | null): string => {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'Just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

const scopeChips = (scope: string): string[] =>
  scope.split(/\s+/).filter(Boolean)

// ── Table columns ───────────────────────────────────────────────────
const columns: TableColumn<ConnectedApp>[] = [
  {
    accessorKey: 'client_name',
    header: 'App',
    cell: ({ row }) => h('div', { class: 'flex flex-col gap-1' }, [
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'font-medium' }, row.original.client_name),
        row.original.dynamic
          ? h(UBadge, { color: 'neutral', variant: 'subtle', size: 'sm' }, () => 'DCR')
          : null
      ]),
      !row.original.has_active_tokens
        ? h('span', { class: 'text-xs text-(--ui-text-muted)' }, 'No active session')
        : null
    ])
  },
  {
    accessorKey: 'scope',
    header: 'Permissions',
    // Show only the count — listing every permission inline blows the
    // row height out for clients that hold many scopes. The full list
    // is one hover away via the tooltip's `text` prop. Newlines render
    // because we override `content.class` with `whitespace-pre-line`.
    cell: ({ row }) => {
      const scopes = scopeChips(row.original.scope)
      const count = scopes.length
      const label = `${count} permission${count === 1 ? '' : 's'}`
      const tooltipText = scopes.map(s => `• ${describeScope(s)}`).join('\n')
      return h(UTooltip, {
        text: tooltipText,
        delayDuration: 100,
        ui: { text: 'whitespace-pre-line text-left block' }
      }, () => h(UBadge, {
        color: 'neutral',
        variant: 'subtle',
        size: 'sm',
        class: 'cursor-help'
      }, () => label))
    }
  },
  {
    accessorKey: 'last_used_at',
    header: 'Last used',
    cell: ({ row }) => h('span', { class: 'text-sm text-(--ui-text-muted)' },
      formatRelative(row.original.last_used_at))
  },
  {
    accessorKey: 'granted_at',
    header: 'Granted',
    cell: ({ row }) => h('span', { class: 'text-sm text-(--ui-text-muted)' },
      formatDate(row.original.granted_at))
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
      h(resolveComponent('UButton'), {
        color: 'error',
        variant: 'soft',
        size: 'sm',
        icon: 'i-lucide-shield-off',
        'aria-label': `Revoke access for ${row.original.client_name}`,
        onClick: () => requestRevoke(row.original)
      }, () => 'Revoke')
    ])
  }
]
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-xl font-semibold">Connected apps</h2>
        <p class="text-sm text-(--ui-text-muted) mt-1">
          Apps and AI agents that have access to your account via OAuth.
          Revoking access immediately ends any active sessions.
        </p>
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      :title="(error as { statusMessage?: string }).statusMessage || 'Failed to load connected apps'"
      class="mb-4"
    />

    <div
      v-if="!pending && apps.length === 0"
      class="flex flex-col items-center justify-center py-8 text-center"
    >
      <UIcon name="i-lucide-link-2-off" class="size-8 text-(--ui-text-muted) mb-2" />
      <p class="text-sm text-(--ui-text-muted)">No apps have been connected to your account.</p>
    </div>

    <div
      v-else
      class="border border-(--ui-border) rounded-lg overflow-hidden bg-(--ui-bg-elevated)"
    >
      <UTable
        :data="apps"
        :columns="columns"
        :loading="pending"
        :empty-state="{ icon: 'i-lucide-link-2-off', label: 'No apps connected' }"
      />
    </div>

    <UModal v-model:open="revokeOpen" :dismissible="!revoking">
      <template #content>
        <div class="p-6 space-y-5">
          <div class="flex items-start gap-3">
            <div class="shrink-0 size-10 rounded-full bg-(--ui-error)/10 flex items-center justify-center">
              <UIcon name="i-lucide-triangle-alert" class="size-5 text-(--ui-error)" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold">Revoke access?</h3>
              <p class="text-sm text-(--ui-text-muted) mt-1">
                <span class="font-medium text-(--ui-text)">{{ revokeTarget?.client_name }}</span>
                will be locked out immediately. Any active sessions or tokens it holds will stop working.
                It can request access again, but you will be asked to consent.
              </p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="revoking"
              @click="revokeTarget = null"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-shield-off"
              :loading="revoking"
              @click="handleRevoke"
            >
              Revoke access
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
