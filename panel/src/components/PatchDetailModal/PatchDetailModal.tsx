import { useEffect, useMemo } from "react";
import { marked } from "marked";
import type { Commit } from "../../../../shared/types";
import { buildContentParts, type ContentPart } from "../../../../shared/mcp-format";

interface PatchDetailModalProps {
	commit: Commit | null;
	remainingCount: number;
	onClose: () => void;
}

export function PatchDetailModal({ commit, remainingCount, onClose }: PatchDetailModalProps) {
	// Close on Escape
	useEffect(() => {
		if (!commit) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [commit, onClose]);

	const parts = useMemo(() => {
		if (!commit) return null;
		return buildContentParts(commit, remainingCount);
	}, [commit, remainingCount]);

	if (!commit || !parts) return null;

	const jsonPart = parts.find((p): p is ContentPart & { type: "text" } => p.type === "text");
	const imageParts = parts.filter((p): p is ContentPart & { type: "image"; data: string; mimeType: string } => p.type === "image");
	const textParts = parts.filter((p): p is ContentPart & { type: "text" } => p.type === "text");
	const markdownPart = textParts.length > 1 ? textParts[textParts.length - 1] : null;

	const renderedMarkdown = markdownPart ? marked.parse(markdownPart.text, { async: false }) as string : "";

	return (
		<div
			className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="relative w-[calc(100%-24px)] max-w-3xl max-h-[calc(100%-24px)] bg-bit-surface border border-bit-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-2.5 border-b border-bit-border shrink-0">
					<div className="text-[13px] font-semibold text-bit-text">
						MCP Response Preview
						<span className="ml-2 text-[11px] font-normal text-bit-text-mid">
							{commit.patches.length} patch{commit.patches.length === 1 ? "" : "es"}
						</span>
					</div>
					<button
						className="text-bit-muted hover:text-bit-text bg-transparent border-none cursor-pointer text-lg leading-none p-1"
						onClick={onClose}
						type="button"
						title="Close"
					>
						✕
					</button>
				</div>

				{/* Scrollable content */}
				<div className="flex-1 overflow-auto p-4 space-y-4">
					{/* Section 1: JSON Data */}
					{jsonPart && (
						<section>
							<h3 className="text-[11px] font-semibold text-bit-text-mid uppercase tracking-wide mb-2">
								JSON Data
							</h3>
							<pre className="text-[11px] font-mono bg-bit-bg border border-bit-border rounded-lg p-3 overflow-auto max-h-[300px] text-bit-text whitespace-pre-wrap break-words">
								{jsonPart.text}
							</pre>
						</section>
					)}

					{/* Section 2: Images (only if present) */}
					{imageParts.length > 0 && (
						<section>
							<h3 className="text-[11px] font-semibold text-bit-text-mid uppercase tracking-wide mb-2">
								Images ({imageParts.length})
							</h3>
							<div className="flex flex-wrap gap-3">
								{imageParts.map((img, i) => (
									<img
										key={i}
										src={`data:${img.mimeType};base64,${img.data}`}
										alt={`Attachment ${i + 1}`}
										className="max-w-full max-h-[200px] object-contain rounded-lg border border-bit-border bg-white"
									/>
								))}
							</div>
						</section>
					)}

					{/* Section 3: Agent Instructions (rendered markdown) */}
					{markdownPart && (
						<section>
							<h3 className="text-[11px] font-semibold text-bit-text-mid uppercase tracking-wide mb-2">
								Agent Instructions
							</h3>
							<div
								className="patch-detail-markdown text-[12px] text-bit-text bg-bit-bg border border-bit-border rounded-lg p-4 overflow-auto"
								dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
							/>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
