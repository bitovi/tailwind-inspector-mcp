interface TutorialSectionProps {
  step: number
  title: string
  completed: boolean
  onMarkComplete: () => void
  children?: React.ReactNode
  instructions: React.ReactNode
  playgroundClassName?: string
}

export function TutorialSection({
  step,
  title,
  completed,
  onMarkComplete,
  children,
  instructions,
  playgroundClassName,
}: TutorialSectionProps) {
  return (
    <section className={`rounded-lg shadow-sm border overflow-hidden ${
      completed
        ? 'bg-green-100 border-green-300'
        : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        {/* Step badge */}
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
            completed
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {completed ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </span>

        <h2 className="text-lg font-semibold text-gray-900 flex-1">{title}</h2>

        {completed && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
            Done
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {/* Instructions */}
        <div className="text-sm text-gray-600 leading-relaxed mb-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mt-2 [&_ol]:space-y-1 [&_strong]:text-gray-900 [&_em]:text-gray-500">
          {instructions}
        </div>

        {/* Playground */}
        {children && (
          <div className={playgroundClassName ?? "border border-gray-200 rounded-lg p-6 bg-gray-50"}>
            {children}
          </div>
        )}

        {/* Fallback button */}
        {!completed && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onMarkComplete}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Mark complete
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
