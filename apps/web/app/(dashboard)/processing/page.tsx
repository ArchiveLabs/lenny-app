"use client"

import { useUploadJobs, type UploadJob, type JobStatus } from "@/hooks/use-upload-jobs"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Trash2,
  UploadCloud,
  FileType,
  StopCircle,
} from "lucide-react"
import Link from "next/link"

function StatusBadge({ status, error }: { status: JobStatus; error?: string }) {
  switch (status) {
    case "queued":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          Queued
        </span>
      )
    case "uploading":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          Uploading
        </span>
      )
    case "success":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          Done
        </span>
      )
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full" title={error}>
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      )
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
          <Ban className="w-3 h-3" />
          Cancelled
        </span>
      )
  }
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl border bg-card shadow-sm min-w-[80px]">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}

function timeAgo(ts?: number): string {
  if (!ts) return ""
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 0) return "just now"
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ProcessingQueuePage() {
  const { jobs, stats, isUploading, cancelUpload, clearJobs } = useUploadJobs()

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Processing Queue</h2>
          <p className="text-muted-foreground text-base max-w-2xl">
            Track the status of your book uploads in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUploading && (
            <Button
              variant="destructive"
              size="sm"
              onClick={cancelUpload}
              className="font-semibold shadow-sm"
            >
              <StopCircle className="w-3.5 h-3.5 mr-1.5" />
              Cancel Remaining
            </Button>
          )}
          {!isUploading && jobs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearJobs}
              className="font-semibold shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear History
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {stats.uploading > 0 && <StatCard label="Uploading" value={stats.uploading} color="text-blue-600 dark:text-blue-400" />}
          {stats.queued > 0 && <StatCard label="Queued" value={stats.queued} color="text-muted-foreground" />}
          <StatCard label="Done" value={stats.success} color="text-green-600 dark:text-green-400" />
          {stats.failed > 0 && <StatCard label="Failed" value={stats.failed} color="text-red-600 dark:text-red-400" />}
          {stats.cancelled > 0 && <StatCard label="Cancelled" value={stats.cancelled} color="text-amber-600 dark:text-amber-400" />}
        </div>
      )}

      {/* Job Table */}
      {jobs.length > 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[50px]" />
              <col />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
            </colgroup>
            <TableHeader className="bg-muted/50 border-b">
              <TableRow className="hover:bg-transparent cursor-default">
                <TableHead className="text-center pl-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Book</TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Edition</TableHead>
                <TableHead className="hidden md:table-cell text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">Time</TableHead>
                <TableHead className="text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider pr-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job, idx) => (
                <TableRow
                  key={job.id}
                  className={`transition-colors duration-200 ${
                    job.status === "uploading"
                      ? "bg-blue-500/5 border-l-2 border-l-blue-500"
                      : job.status === "success"
                      ? "bg-green-500/5 border-l-2 border-l-green-500"
                      : job.status === "failed"
                      ? "bg-red-500/5 border-l-2 border-l-red-500"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  <TableCell className="text-center pl-3">
                    <span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>
                  </TableCell>
                  <TableCell className="py-3 whitespace-normal">
                    <div className="flex items-center gap-3 min-w-0">
                      {job.coverUrl ? (
                        <img src={job.coverUrl} className="h-[42px] w-[29px] shrink-0 object-cover rounded shadow-sm hidden sm:block border" alt={`${job.title} cover`} />
                      ) : (
                        <div className="h-[42px] w-[29px] shrink-0 rounded bg-muted/60 hidden sm:flex items-center justify-center border">
                          <FileType className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] leading-snug truncate font-semibold text-foreground/90" title={job.title}>
                          {job.title}
                        </span>
                        <span className="text-muted-foreground font-normal text-[11px] mt-0.5 truncate">
                          {job.author}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px] tracking-wider uppercase font-bold bg-muted px-2 py-1 rounded text-muted-foreground">
                      {job.editionKey}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    <span className="text-[11px] text-muted-foreground">
                      {job.status === "uploading" ? "now" : timeAgo(job.completedAt || job.startedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center pr-3">
                    <StatusBadge status={job.status} error={job.error} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-2">
              <UploadCloud className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold">No uploads yet</h3>
            <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed">
              Head to the Upload page to attach files to your books and start uploading.
            </p>
            <Button variant="secondary" className="mt-4 font-semibold" asChild>
              <Link href="/">
                <UploadCloud className="w-4 h-4 mr-2" />
                Go to Upload
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

