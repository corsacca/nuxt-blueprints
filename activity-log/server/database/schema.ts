import type { ColumnType, Generated } from 'kysely'
import type { Database as BaseDatabase } from '~/server/database/schema'

export interface ActivityLogsTable {
  id: Generated<string>
  timestamp: ColumnType<Date, Date | string | undefined, Date | string>
  event_type: string
  table_name: string | null
  record_id: string | null
  user_id: string | null
  user_agent: string | null
  metadata: Generated<Record<string, any>>
}

export interface Database extends BaseDatabase {
  activity_logs: ActivityLogsTable
}
