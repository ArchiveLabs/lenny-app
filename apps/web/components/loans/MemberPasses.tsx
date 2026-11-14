"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Ticket, UserX } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { ErrorState } from "@/components/ErrorState"
import { Pager } from "@/components/import/Pager"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { STATS, timeLeft } from "@/lib/subscriptions"
import { ApiError, SubscriptionPass, SubscriptionPassList, SubscriptionPassListSchema } from "@/types/api"

const PAGE_SIZE = 20
const KEY = ["subscription-passes"]

/** Ghost members' active passes: they read without loans, so this is where an admin sees and ends their access. */
export function MemberPasses({ leaseHours, header }: { leaseHours: number; header: ReactNode }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const { data, isLoading, error } = useQuery({
    queryKey: [...KEY, page],
    queryFn: async () =>
      handleApiResponse<SubscriptionPassList>(
        await fetchAdmin(`subscriptions?${new URLSearchParams({ page: String(page + 1), page_size: String(PAGE_SIZE) })}`),
        SubscriptionPassListSchema,
      ),
    placeholderData: keepPreviousData,
  })

  let body
  if (isLoading) body = <Skeleton className="h-64 rounded-xl" aria-label={t("Loading")} />
  else if (!data) {
    const unsupported = error instanceof ApiError && error.status === 404
    body = (
      <ErrorState
        message={unsupported ? t("This Lenny server can't list member passes yet. Update Lenny, then reload this page.") : error?.message || t("Couldn't load the member passes.")}
      />
    )
  } else if (data.total === 0) {
    body = (
      <Alert role="status">
        <Ticket aria-hidden />
        <AlertTitle>{t("No member has an active pass")}</AlertTitle>
        <AlertDescription>{t("A pass starts when a paid member opens a book from your Ghost site.")}</AlertDescription>
      </Alert>
    )
  } else {
    body = (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t("Member")}</TableHead>
                <TableHead>{t("Tier")}</TableHead>
                <TableHead>{t("Ends")}</TableHead>
                <TableHead>{t("Last renewed")}</TableHead>
                <TableHead className="pr-4 text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <PassRow key={p.id} pass={p} />
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-2 md:p-6 lg:p-8">
      {header}
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t("Ghost members don't borrow. Opening a subscription book from your Ghost site gives them a {{hours}}-hour pass, renewed each time they open one while they're still paid. Members are shown by a short anonymous ID; Lenny never keeps their email.", { hours: leaseHours })}{" "}
        <Link href={STATS.route} className="font-medium text-foreground underline underline-offset-4">
          {t("See what they read")}
        </Link>
      </p>
      {body}
    </div>
  )
}

function PassRow({ pass }: { pass: SubscriptionPass }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const end = useMutation({
    mutationFn: async () => handleApiResponse(await fetchAdmin(`subscriptions/${pass.id}`, { method: "DELETE" })),
    onSuccess: () => {
      toast.success(t("Pass ended for member {{member}}.", { member: pass.member }))
      queryClient.invalidateQueries({ queryKey: KEY })
    },
    onError: (err: Error) => toast.error(err.message || t("Couldn't end this pass.")),
  })
  return (
    <TableRow>
      <TableCell className="pl-4 font-mono text-xs">{pass.member}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {pass.tier_ids.length ? (
            pass.tier_ids.map((id) => (
              <Badge key={id} variant="outline" className="font-mono">{id}</Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{t("Paid member")}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="tabular-nums">{t(timeLeft(pass.expires_at))}</TableCell>
      <TableCell className="text-muted-foreground">{relativeTime(pass.renewed_at) || "—"}</TableCell>
      <TableCell className="pr-4 text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={end.isPending}>
              {end.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
              {t("End pass")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("End the pass for member {{member}}?", { member: pass.member })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Their books close now. If they are still a paid member, they get a new pass the next time they open a book from your Ghost site. To stop that, change their plan in Ghost.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => end.mutate()}>{t("End pass")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
