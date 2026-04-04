import { Document } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FileText, ExternalLink } from 'lucide-react'
import CategoryBadge from '@/components/CategoryBadge'

interface Props {
  document: Document
}

export default function DocumentCard({ document: doc }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {doc.provider_name || doc.file_name}
              </p>
              <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
            </div>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-300 hover:text-primary-600 flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {doc.support_category ? (
              <CategoryBadge code={doc.support_category} />
            ) : (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                Needs review
              </span>
            )}
            {doc.amount && (
              <span className="text-xs font-semibold text-gray-700">
                {formatCurrency(doc.amount)}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {formatDate(doc.doc_date || doc.created_at)}
            </span>
            {doc.ai_extracted && (
              <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                🤖 AI extracted
              </span>
            )}
          </div>

          {doc.description && (
            <p className="mt-2 text-xs text-gray-500 line-clamp-2">{doc.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
