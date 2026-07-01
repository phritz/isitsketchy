"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDisclosure } from "@mantine/hooks";
import {
  Anchor,
  Badge,
  Button,
  Collapse,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  getAnalysis,
  type AnalysisRunData,
  type AnalysisSubjectData,
  type ResultStatus,
  type RiskScore,
} from "@/app/api/analysis/client";

const POLL_INTERVAL_MS: number = 1500;

// A single signal result flattened out of its subject, ready to render one per
// row in the red / yellow flag tables.
type Flag = {
  key: string;
  subject: AnalysisSubjectData;
  signalName: string;
  comment: string;
};

type Buckets = {
  red: Flag[];
  yellow: Flag[];
  greenCount: number;
  evaluatedCount: number;
  repoCount: number;
  packageCount: number;
};

function bucketFlags(run: AnalysisRunData): Buckets {
  const red: Flag[] = [];
  const yellow: Flag[] = [];
  let greenCount: number = 0;
  let repoCount: number = 0;
  let packageCount: number = 0;

  for (const subject of run.subjects) {
    if (subject.type === "repo") {
      repoCount += 1;
    } else {
      packageCount += 1;
    }
    for (const result of subject.results) {
      const flag: Flag = {
        key: result.id,
        subject,
        signalName: result.name,
        comment: result.comment ?? "",
      };
      if (result.riskScore === "red") {
        red.push(flag);
      } else if (result.riskScore === "yellow") {
        yellow.push(flag);
      } else if (result.riskScore === "green") {
        greenCount += 1;
      }
    }
  }

  return {
    red,
    yellow,
    greenCount,
    evaluatedCount: red.length + yellow.length + greenCount,
    repoCount,
    packageCount,
  };
}

// Live progress while a run is still discovering subjects / computing signals.
// Drives the prominent status panel shown before results are ready.
type Progress = {
  repoCount: number;
  packageCount: number;
  totalSignals: number;
  analyzedSignals: number;
};

function computeProgress(run: AnalysisRunData): Progress {
  let repoCount: number = 0;
  let packageCount: number = 0;
  let totalSignals: number = 0;
  let analyzedSignals: number = 0;

  for (const subject of run.subjects) {
    if (subject.type === "repo") {
      repoCount += 1;
    } else {
      packageCount += 1;
    }
    for (const result of subject.results) {
      totalSignals += 1;
      if (result.status === "completed" || result.status === "failed") {
        analyzedSignals += 1;
      }
    }
  }

  return { repoCount, packageCount, totalSignals, analyzedSignals };
}

// Both subject kinds resolve to a canonical public URL derived from `name`
// (repo names are `owner/repo`; package names are the npm package id).
function subjectWebUrl(subject: AnalysisSubjectData): string {
  if (subject.type === "repo") {
    return `https://github.com/${subject.name}`;
  }
  return `https://www.npmjs.com/package/${subject.name}`;
}

function isTerminal(status: ResultStatus): boolean {
  return status === "completed" || status === "failed";
}

function riskColor(risk: RiskScore): string {
  switch (risk) {
    case "green":
      return "green";
    case "yellow":
      return "yellow";
    case "red":
    default:
      return "red";
  }
}

function SubjectLink({ subject }: { subject: AnalysisSubjectData }) {
  return (
    <Anchor href={subjectWebUrl(subject)} target="_blank" rel="noreferrer">
      {subject.name}
    </Anchor>
  );
}

// Status must read differently from the green/yellow/red flag bubbles, so it is
// rendered as plain (dimmed) text with a spinner for in-flight work.
function StatusText({ status }: { status: ResultStatus }) {
  if (status === "running") {
    return (
      <Group gap={6} align="center" wrap="nowrap">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          running
        </Text>
      </Group>
    );
  }
  const label: string =
    status === "completed"
      ? "✓ done"
      : status === "failed"
        ? "✗ error"
        : "pending";
  return (
    <Text size="sm" c="dimmed">
      {label}
    </Text>
  );
}

// A single labeled count for the progress panel.
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2} align="center" miw={90}>
      <Text fw={700} fz={28} lh={1}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
    </Stack>
  );
}

// Prominent status shown while the run is pending/running. Deliberately the
// only thing on screen until the run reaches a terminal state — no partial
// results, just what has been discovered and how far along the signals are.
function ProgressPanel({
  run,
  progress,
}: {
  run: AnalysisRunData;
  progress: Progress;
}) {
  const running: boolean = run.status === "running";
  const pct: number =
    progress.totalSignals === 0
      ? 0
      : Math.round((progress.analyzedSignals / progress.totalSignals) * 100);
  return (
    <Paper withBorder p="xl" radius="md" shadow="xs">
      <Stack gap="lg" align="center">
        <Loader size="lg" />
        <Title order={2}>Analyzing…</Title>
        <Text c="dimmed" ta="center">
          {running
            ? "Evaluating trustworthiness signals…"
            : "Gathering metadata…"}
        </Text>

        {running ? (
          <Stack gap={6} w="100%" maw={380}>
            <Progress value={pct} size="lg" radius="xl" animated />
            <Text size="sm" c="dimmed" ta="center">
              {progress.analyzedSignals} of {progress.totalSignals} signals
              analyzed
            </Text>
          </Stack>
        ) : null}

        <Group gap="xl" justify="center">
          <Stat label="Repositories" value={progress.repoCount} />
          <Stat label="Packages" value={progress.packageCount} />
          <Stat label="Signals" value={progress.totalSignals} />
        </Group>
      </Stack>
    </Paper>
  );
}

function FlagTable({ flags }: { flags: Flag[] }) {
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Subject</Table.Th>
          <Table.Th>Signal</Table.Th>
          <Table.Th>Detail</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {flags.map((flag) => (
          <Table.Tr key={flag.key}>
            <Table.Td>
              <SubjectLink subject={flag.subject} />
            </Table.Td>
            <Table.Td>{flag.signalName}</Table.Td>
            <Table.Td>{flag.comment}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function FlagSection({
  title,
  color,
  flags,
}: {
  title: string;
  color: string;
  flags: Flag[];
}) {
  if (flags.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Title order={3}>{title}</Title>
        <Badge color={color} variant="filled">
          {flags.length}
        </Badge>
      </Group>
      <FlagTable flags={flags} />
    </Stack>
  );
}

function GreenSummary({ buckets }: { buckets: Buckets }) {
  const repoLabel: string =
    buckets.repoCount === 1 ? "repository" : "repositories";
  const packageLabel: string =
    buckets.packageCount === 1 ? "package" : "packages";
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" align="center">
        <Title order={3}>Signals passed</Title>
        <Badge color="green" variant="filled">
          {buckets.greenCount}
        </Badge>
      </Group>
      <Text mt="xs" c="dimmed">
        Analyzed {buckets.repoCount} {repoLabel} and {buckets.packageCount}{" "}
        {packageLabel}. {buckets.greenCount} of {buckets.evaluatedCount} signals
        passed.
      </Text>
    </Paper>
  );
}

// Flatten every subject into result rows for the (hidden by default) full
// table. Subjects with no results still get one row so failures are visible.
function fullResultRows(run: AnalysisRunData): React.ReactNode[] {
  const rows: React.ReactNode[] = [];
  for (const subject of run.subjects) {
    if (subject.results.length === 0) {
      rows.push(
        <Table.Tr key={subject.id}>
          <Table.Td>
            <SubjectLink subject={subject} />
          </Table.Td>
          <Table.Td>{subject.type}</Table.Td>
          <Table.Td c="dimmed">—</Table.Td>
          <Table.Td c="dimmed">—</Table.Td>
          <Table.Td>
            <StatusText status={subject.status} />
          </Table.Td>
          <Table.Td c={subject.error ? "red" : "dimmed"}>
            {subject.error
              ? `${subject.error.code}: ${subject.error.message}`
              : "No signals"}
          </Table.Td>
        </Table.Tr>,
      );
      continue;
    }
    for (const result of subject.results) {
      rows.push(
        <Table.Tr key={result.id}>
          <Table.Td>
            <SubjectLink subject={subject} />
          </Table.Td>
          <Table.Td>{subject.type}</Table.Td>
          <Table.Td>{result.name}</Table.Td>
          <Table.Td style={{ whiteSpace: "nowrap" }}>
            {result.riskScore ? (
              <Badge size="sm" color={riskColor(result.riskScore)}>
                {result.riskScore}
              </Badge>
            ) : (
              <Text c="dimmed">—</Text>
            )}
          </Table.Td>
          <Table.Td>
            <StatusText status={result.status} />
          </Table.Td>
          <Table.Td>{result.comment ?? ""}</Table.Td>
        </Table.Tr>,
      );
    }
  }
  return rows;
}

function FullResults({ run }: { run: AnalysisRunData }) {
  const [opened, { toggle }] = useDisclosure(true);
  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        size="compact-sm"
        onClick={toggle}
        w="fit-content"
      >
        {opened ? "Hide full results" : "Show full results"}
      </Button>
      <Collapse expanded={opened}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped withTableBorder fz="sm" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Signal</Table.Th>
                <Table.Th w={90}>Risk</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Detail</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{fullResultRows(run)}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Collapse>
    </Stack>
  );
}

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const id: string = params.id;
  const [run, setRun] = useState<AnalysisRunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A transient refresh failure after we already have data (e.g. a timed-out
  // poll). We keep polling and surface this softly rather than tearing down the
  // live view for a blip.
  const [stale, setStale] = useState<boolean>(false);

  useEffect(() => {
    let active: boolean = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let loaded: boolean = false;

    async function poll(): Promise<void> {
      try {
        const data = await getAnalysis(id);
        if (!active) {
          return;
        }
        loaded = true;
        setRun(data);
        setError(null);
        setStale(false);
        if (!isTerminal(data.status)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (!active) {
          return;
        }
        const message: string =
          e instanceof Error ? e.message : "Failed to load analysis";
        if (!loaded) {
          // Initial load failed: there is nothing to show, so surface a hard
          // error and stop.
          setError(message);
          return;
        }
        // We already have data and the run was still in progress: keep polling
        // so a transient failure doesn't permanently freeze the live view.
        setStale(true);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      active = false;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [id]);

  const buckets: Buckets | null = run === null ? null : bucketFlags(run);
  const progress: Progress | null = run === null ? null : computeProgress(run);
  const terminal: boolean = run !== null && isTerminal(run.status);
  const hasFlags: boolean =
    buckets !== null && (buckets.red.length > 0 || buckets.yellow.length > 0);

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Anchor href="/ui">← Home</Anchor>
          <Anchor href="/ui/signals">What do these signals mean?</Anchor>
        </Group>

        <Title order={1}>Analysis</Title>

        {error ? <Text c="red">{error}</Text> : null}

        {run === null || buckets === null || progress === null ? (
          <Text c="dimmed">Loading…</Text>
        ) : (
          <Stack gap="xl">
            <Group gap="xs" align="center">
              <Anchor
                href={run.repoUrl}
                target="_blank"
                rel="noreferrer"
                fw={600}
              >
                {run.repoUrl}
              </Anchor>
              {terminal ? <StatusText status={run.status} /> : null}
              {stale ? (
                <Text size="sm" c="dimmed">
                  Reconnecting…
                </Text>
              ) : null}
            </Group>

            {run.error ? (
              <Text c="red">
                {run.error.code}: {run.error.message}
              </Text>
            ) : !terminal ? (
              <ProgressPanel run={run} progress={progress} />
            ) : run.subjects.length === 0 ? (
              <Text c="dimmed">No subjects were analyzed.</Text>
            ) : (
              <>
                {hasFlags ? null : (
                  <Text c="dimmed">No red or yellow flags found.</Text>
                )}
                <FlagSection title="Red flags" color="red" flags={buckets.red} />
                <FlagSection
                  title="Yellow flags"
                  color="yellow"
                  flags={buckets.yellow}
                />
                <GreenSummary buckets={buckets} />
                <FullResults run={run} />
              </>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
