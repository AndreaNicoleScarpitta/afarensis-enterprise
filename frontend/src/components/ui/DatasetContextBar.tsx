import { Database, Clock, Hash, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatasetContextBarProps {
  /** The active dataset info, typically from project.processing_config or a datasets API call */
  dataset?: {
    name?: string
    records_count?: number
    upload_timestamp?: string
    hash?: string
    status?: string
    compliance_status?: string
    source_type?: string
    n_by_arm?: Record<string, number>
  }
  /** Analysis results, if available */
  analysisResults?: {
    data_source?: string
    column_detection?: {
      n_records_input?: number
      n_records_analyzed?: number
      n_records_dropped?: number
      n_events?: number
      groups?: {
        control?: string
        treated?: string
      }
    }
    analysis_timestamp?: string
  }
  /** Optional click handler to navigate to data provenance */
  onClick?: () => void
}

export default function DatasetContextBar({ dataset, analysisResults, onClick }: DatasetContextBarProps) {
  // Nothing to show if no dataset and no analysis
  if (!dataset && !analysisResults) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm text-gray-600">
          No dataset loaded. Upload patient data via Data Provenance to begin analysis.
        </span>
      </div>
    )
  }

  const name = dataset?.name || 'Uploaded Dataset'
  const rowCount = analysisResults?.column_detection?.n_records_analyzed || dataset?.records_count || 0
  const droppedRows = analysisResults?.column_detection?.n_records_dropped || 0
  const nEvents = analysisResults?.column_detection?.n_events || 0
  const timestamp = analysisResults?.analysis_timestamp || dataset?.upload_timestamp || null
  const groups = analysisResults?.column_detection?.groups || null
  const status = dataset?.compliance_status || dataset?.status || 'active'
  const isUploaded = analysisResults?.data_source === 'uploaded'

  const statusColor = status === 'CLEARED'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'BLOCKED'
      ? 'bg-red-100 text-red-700'
      : 'bg-blue-100 text-blue-700'

  return (
    <div
      className={cn(
        'border rounded-lg px-4 py-2.5 mb-4 flex items-center gap-4 flex-wrap',
        isUploaded
          ? 'bg-emerald-50/50 border-emerald-200'
          : 'bg-blue-50/50 border-blue-200',
        onClick && 'cursor-pointer hover:bg-emerald-50 transition-colors'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{name}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-600">
        <Users className="w-3.5 h-3.5" />
        <span className="font-mono">{rowCount.toLocaleString()}</span>
        <span>patients</span>
        {droppedRows > 0 && (
          <span className="text-amber-600 ml-1">
            ({droppedRows} excluded)
          </span>
        )}
      </div>

      {nEvents > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <span className="font-mono">{nEvents}</span>
          <span>events</span>
        </div>
      )}

      {groups && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <span>{groups.treated || '?'} vs {groups.control || '?'}</span>
        </div>
      )}

      {timestamp && (
        <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {new Date(timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
      )}

      {dataset?.hash && (
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            <Hash className="w-2.5 h-2.5" />
            {dataset.hash.slice(0, 12)}...
          </span>
        </div>
      )}

      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase', statusColor)}>
        {status === 'CLEARED' || status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {isUploaded ? 'Uploaded' : status}
      </span>
    </div>
  )
}
